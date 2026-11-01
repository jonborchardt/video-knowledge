// npm run evidence -- <command> [args]           the deterministic research verbs (spec §5.2); the agents' briefs name
//                                                 the two a collect agent may run (search, fetch-doc); the rest are the
//                                                 topic runner's
//   search "<query>" [--max 40] [--json]          YouTube results for a query (the page's ytInitialData; no API key)
//   fetch-doc <topic> <https url> <file.txt> [--pages a-b]
//                                                 save a study document as text under topics/<topic>/sources/<file.txt>
//                                                 (pdftotext -layout for a PDF, tags stripped otherwise, a Source: header
//                                                 first); refuses (exit 2) a non-https URL, a path or a non-.txt name
//   lists <topic>                                 check videos.txt and blogs.txt: a URL once, a video id in videos.txt,
//                                                 no YouTube URL in blogs.txt (exit 2 with the findings)
//   groups <topic>                                the watcher's extract entries into work/grpN.txt (about 400k characters
//                                                 each) and work/claims.txt; prints the group count
//   check-batch <topic> <work/hN.json>            the extraction batch check (exit 2 with the findings)
//   check-verdicts <work/sv_N.json>               the study-verdict batch check (exit 2 with the findings)
//   dedupe <topic>                                exact cross-file duplicate new claims in work/h*.json become n2 of the
//                                                 first; rewrites the files, prints the count
//   check-merges <topic>                          work/merges.json and work/distinct.json shapes, and the collisions of
//                                                 the new claims with the existing ones not yet merged or marked distinct
//                                                 (exit 2 with the findings)
//   collide <topic> [--resolve]                   sets "f": true on the new claims distinct.json names; prints the rest of
//                                                 the collisions; --resolve merges each remaining one into the existing
//                                                 claim it collides with (merges.json), the runner's last resort
//   scanned <topic> --found <n> --recorded <n> [--at <ISO>] [--model <m>] [--session <id>]
//                                                 records one maintenance scan in topics/<topic>/maintenance.json (idempotent
//                                                 for the same --at)
//   thin <topic> [--json]                         whether the topic is thin (sources with captions, documents, decided
//                                                 claims against automation.json topics.*); exit 0 either way
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadAutomation } from '../../shared/automation';
import { ROOT, loadDotEnv, readJson, toJson, topicDir } from '../../shared/io';
import { Refusal } from '../../shared/refusal';
import { type ExtractionBatch, checkBatches, checkStudyVerdicts } from './batches';
import { type Collision, collisions, similarityFn } from './collide';
import { dedupeBatches } from './dedupe';
import { fetchDoc, fetchDocProblem } from './fetch-doc';
import { splitGroups } from './groups';
import { appendScan, loadMaintenance, maintenancePath } from './maintenance';
import { youtubeSearch } from './search';
import { thinness } from './thin';
import { relTo, watcher } from './watcher.mjs';

loadDotEnv();
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const has = (name: string) => rest.includes(name);
const positional = rest.filter(
  (x, i) =>
    !x.startsWith('--') &&
    !(i > 0 && ['--max', '--pages', '--found', '--recorded', '--at', '--model', '--session'].includes(rest[i - 1])),
);
const usage = () => {
  console.error(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 28)
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'),
  );
  process.exit(1);
};
if (!cmd) usage();
const root = ROOT;
const work = (topic: string) => {
  const d = join(topicDir(topic, root), 'work');
  mkdirSync(d, { recursive: true });
  return d;
};
const store = (topic: string) => relTo(join(topicDir(topic, root), 'store'));
const storeClaims = (topic: string): { id: string; text: string }[] =>
  readJson<{ topics: { id: string; claims: { id: string; text: string }[] }[] }>(
    join(topicDir(topic, root), 'store', 'topics.json'),
  )?.topics.find((t) => t.id === topic)?.claims ?? [];
const batchFiles = (topic: string) =>
  readdirSync(work(topic))
    .filter((f) => /^h\d+\.json$/.test(f))
    .sort((x, y) => Number(x.slice(1, -5)) - Number(y.slice(1, -5)));
const newClaimTexts = (topic: string): { text: string; file: string; forced: boolean }[] =>
  batchFiles(topic).flatMap((f) =>
    (readJson<ExtractionBatch[]>(join(work(topic), f)) ?? []).flatMap((b) =>
      b.as.flatMap((a) => ('n' in a && a.n ? [{ text: a.n, file: f, forced: !!(a as { f?: boolean }).f }] : [])),
    ),
  );
const VIDEO_ID = /(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/;

function listProblems(topic: string): string[] {
  const dir = topicDir(topic, root);
  const out: string[] = [];
  const seen = new Map<string, string>();
  for (const name of ['videos.txt', 'blogs.txt']) {
    const p = join(dir, name);
    if (!existsSync(p)) {
      if (name === 'videos.txt') out.push('no videos.txt');
      continue;
    }
    readFileSync(p, 'utf8')
      .split(/\r?\n/)
      .forEach((line, i) => {
        const l = line.trim();
        if (!l || l.startsWith('#')) return;
        if (!/^https?:\/\/\S+$/.test(l)) return void out.push(`${name}:${i + 1}: not a URL: ${l}`);
        const key = l
          .replace(/^http:/, 'https:')
          .replace(/\/+$/, '')
          .toLowerCase();
        const where = seen.get(key);
        if (where) out.push(`${name}:${i + 1}: ${l} is listed already (${where})`);
        seen.set(key, `${name}:${i + 1}`);
        const yt = /youtube\.com|youtu\.be/.test(l);
        if (name === 'videos.txt' && !VIDEO_ID.test(l)) out.push(`${name}:${i + 1}: no YouTube video id in ${l}`);
        if (name === 'blogs.txt' && yt) out.push(`${name}:${i + 1}: a YouTube URL belongs in videos.txt: ${l}`);
      });
  }
  return out;
}

function mergesProblems(topic: string): string[] {
  const out: string[] = [];
  const merges = readJson<unknown>(join(work(topic), 'merges.json'));
  if (merges !== null) {
    if (!merges || typeof merges !== 'object' || Array.isArray(merges)) out.push('merges.json is not an object');
    else
      for (const [k, v] of Object.entries(merges as Record<string, unknown>))
        if (typeof v !== 'string' || !v.trim()) out.push(`merges.json: "${k}" must map to a slug or "=canonical text"`);
  }
  const distinct = readJson<unknown>(join(work(topic), 'distinct.json'));
  if (distinct !== null && (!Array.isArray(distinct) || distinct.some((x) => typeof x !== 'string')))
    out.push('distinct.json is not an array of claim texts');
  return out;
}

async function openCollisions(topic: string): Promise<{ open: Collision[]; from: string }> {
  const { similarity, from } = await similarityFn(root);
  const merges = readJson<Record<string, string>>(join(work(topic), 'merges.json')) ?? {};
  const distinct = new Set(readJson<string[]>(join(work(topic), 'distinct.json')) ?? []);
  const fresh = newClaimTexts(topic).filter((c) => !c.forced && !distinct.has(c.text) && !(c.text in merges));
  const texts = [...new Set(fresh.map((c) => c.text))];
  const all = collisions(texts, storeClaims(topic), similarity);
  return { open: all.filter((c) => !distinct.has(c.claim) && !(c.claim in merges)), from };
}

async function main() {
  switch (cmd) {
    case 'search': {
      const q = positional[0];
      if (!q) throw new Refusal('search needs a query');
      const hits = await youtubeSearch(q, Number(flag('--max') ?? 40));
      if (has('--json')) console.log(JSON.stringify(hits, null, 1));
      else
        for (const h of hits)
          console.log(
            `https://www.youtube.com/watch?v=${h.id}\t${h.title}\t${h.channel}\t${h.seconds ?? '?'} s\t${h.views ?? '?'} views`,
          );
      break;
    }
    case 'fetch-doc': {
      const [topic, url, file] = positional;
      if (!topic || !url || !file) throw new Refusal('fetch-doc needs <topic> <https url> <file.txt>');
      const problem = fetchDocProblem(topic, url, file, root);
      if (problem) throw new Refusal(problem);
      const r = await fetchDoc(topic, url, file, { pages: flag('--pages'), root });
      console.log(`wrote ${relTo(r.path)} (${r.kind}, ${r.lines} lines)`);
      break;
    }
    case 'lists': {
      const topic = positional[0];
      if (!topic) throw new Refusal('lists needs a topic');
      const problems = listProblems(topic);
      if (problems.length) throw new Refusal(problems.join('\n'));
      console.log(`RESULT: PASSED (topics/${topic}/videos.txt and blogs.txt)`);
      break;
    }
    case 'groups': {
      const topic = positional[0];
      if (!topic) throw new Refusal('groups needs a topic');
      // the same entries and sizes topicNext derives: fetched records without assertions and with a transcript, sized
      // by the cached transcript (topics/<topic>/store/transcripts/<id>.txt)
      const videosDir = join(topicDir(topic, root), 'store', 'videos');
      const recs = existsSync(videosDir)
        ? readdirSync(videosDir).map((f) =>
            readJson<{ id: string; title?: string; transcript?: string; assertions?: unknown }>(join(videosDir, f))!,
          )
        : [];
      const entries = recs
        .filter((r) => !r.assertions && r.transcript !== 'none')
        .map((r) => {
          const transcript = relTo(join(topicDir(topic, root), 'store', 'transcripts', `${r.id}.txt`));
          return {
            id: r.id,
            title: r.title,
            transcript,
            chars: existsSync(join(root, transcript)) ? statSync(join(root, transcript)).size : 50_000,
          };
        });
      const groups = splitGroups(entries);
      const dir = work(topic);
      for (const f of readdirSync(dir)) if (/^grp\d+\.txt$/.test(f)) writeFileSync(join(dir, f), ''); // stale groups emptied
      groups.forEach((g, i) =>
        writeFileSync(
          join(dir, `grp${i + 1}.txt`),
          g.map((e) => `${e.id}\t${e.transcript}\t${e.title ?? ''}`).join('\n') + '\n',
        ),
      );
      let claims: string;
      try {
        claims = watcher(['claims', 'list', '--topic', topic, '--store', store(topic)]);
      } catch {
        claims = ''; // the topic exists in the watcher only after the first record
      }
      writeFileSync(join(dir, 'claims.txt'), claims);
      console.log(
        `${groups.length} group${groups.length === 1 ? '' : 's'}: ${groups.map((g) => g.length).join(', ')} sources`,
      );
      break;
    }
    case 'check-batch': {
      const [topic, file] = positional;
      if (!topic || !file) throw new Refusal('check-batch needs <topic> <work/hN.json>');
      const p = join(root, file);
      if (!existsSync(p)) throw new Refusal(`no ${file}`);
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(p, 'utf8'));
      } catch (e) {
        throw new Refusal(`${file}: not JSON: ${(e as Error).message}`);
      }
      // claims created by earlier batch files count as existing texts for n2
      const earlier = batchFiles(topic).filter((f) => f < file.split('/').pop()!);
      const texts = earlier.flatMap((f) =>
        (readJson<ExtractionBatch[]>(join(work(topic), f)) ?? []).flatMap((b) =>
          b.as.flatMap((a) => ('n' in a && a.n ? [{ id: `${topic}/new`, text: a.n }] : [])),
        ),
      );
      const problems = checkBatches(parsed, topic, [...storeClaims(topic), ...texts]);
      if (problems.length) throw new Refusal(problems.join('\n'));
      console.log(`RESULT: PASSED (${file})`);
      break;
    }
    case 'check-verdicts': {
      const file = positional[0];
      if (!file) throw new Refusal('check-verdicts needs <work/sv_N.json>');
      const p = join(root, file);
      if (!existsSync(p)) throw new Refusal(`no ${file}`);
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(p, 'utf8'));
      } catch (e) {
        throw new Refusal(`${file}: not JSON: ${(e as Error).message}`);
      }
      const problems = checkStudyVerdicts(parsed);
      if (problems.length) throw new Refusal(problems.join('\n'));
      console.log(`RESULT: PASSED (${file})`);
      break;
    }
    case 'dedupe': {
      const topic = positional[0];
      if (!topic) throw new Refusal('dedupe needs a topic');
      const files = Object.fromEntries(
        batchFiles(topic).map((f) => [f, readJson<ExtractionBatch[]>(join(work(topic), f)) ?? []]),
      );
      const { batches, converted } = dedupeBatches(files);
      for (const [f, b] of Object.entries(batches)) writeFileSync(join(work(topic), f), toJson(b));
      console.log(
        `${converted} duplicate new claim${converted === 1 ? '' : 's'} converted to n2 across ${Object.keys(files).length} files`,
      );
      break;
    }
    case 'check-merges': {
      const topic = positional[0];
      if (!topic) throw new Refusal('check-merges needs a topic');
      const problems = mergesProblems(topic);
      if (!problems.length) {
        const { open, from } = await openCollisions(topic);
        for (const c of open)
          problems.push(
            `collision (${c.score.toFixed(2)}, ${from}): "${c.claim}" is close to ${c.against}; add it to merges.json (the same claim) or distinct.json (a different one)`,
          );
      }
      if (problems.length) throw new Refusal(problems.join('\n'));
      console.log(`RESULT: PASSED (topics/${topic}/work/merges.json, distinct.json, no open collision)`);
      break;
    }
    case 'collide': {
      const topic = positional[0];
      if (!topic) throw new Refusal('collide needs a topic');
      const distinct = new Set(readJson<string[]>(join(work(topic), 'distinct.json')) ?? []);
      let forced = 0;
      for (const f of batchFiles(topic)) {
        const batches = readJson<ExtractionBatch[]>(join(work(topic), f)) ?? [];
        let changed = false;
        for (const b of batches)
          for (const a of b.as)
            if ('n' in a && a.n && distinct.has(a.n) && !(a as { f?: boolean }).f) {
              (a as { f?: boolean }).f = true;
              forced++;
              changed = true;
            }
        if (changed) writeFileSync(join(work(topic), f), toJson(batches));
      }
      const { open, from } = await openCollisions(topic);
      if (has('--resolve') && open.length) {
        const mergesPath = join(work(topic), 'merges.json');
        const merges = readJson<Record<string, string>>(mergesPath) ?? {};
        for (const c of open)
          if (!(c.claim in merges) && c.against.includes('/')) merges[c.claim] = c.against.replace(`${topic}/`, '');
        writeFileSync(mergesPath, toJson(merges));
      }
      console.log(
        `${forced} new claim${forced === 1 ? '' : 's'} forced as distinct; ${open.length} open collision${open.length === 1 ? '' : 's'} (${from})${has('--resolve') ? ', merged into the existing claims' : ''}`,
      );
      for (const c of open) console.log(`  ${c.score.toFixed(2)}  "${c.claim}"  ~  ${c.against}`);
      break;
    }
    case 'scanned': {
      const topic = positional[0];
      if (!topic) throw new Refusal('scanned needs a topic');
      if (!existsSync(topicDir(topic, root))) throw new Refusal(`no topic ${topic}`);
      const found = Number(flag('--found'));
      const recorded = Number(flag('--recorded'));
      if (!Number.isInteger(found) || !Number.isInteger(recorded) || found < 0 || recorded < 0)
        throw new Refusal('scanned needs --found <n> and --recorded <n>');
      const at = flag('--at') ?? new Date().toISOString();
      if (Number.isNaN(Date.parse(at))) throw new Refusal(`--at is not a date: ${at}`);
      const before = loadMaintenance(topic, root);
      const next = appendScan(before, {
        at,
        found,
        recorded,
        ...(flag('--model') && { model: flag('--model') }),
        ...(flag('--session') && { session: flag('--session') }),
      });
      if (next === before) {
        console.log(`${topic}: the scan at ${at} is recorded already`);
        break;
      }
      writeFileSync(maintenancePath(topic, root), toJson(next));
      console.log(
        `${topic}: scan at ${at} recorded (${found} found, ${recorded} recorded); last scan ${next.lastScan}`,
      );
      break;
    }
    case 'thin': {
      const topic = positional[0];
      if (!topic) throw new Refusal('thin needs a topic');
      const a = loadAutomation(root);
      const dir = topicDir(topic, root);
      const videosDir = join(dir, 'store', 'videos');
      const recs = existsSync(videosDir)
        ? readdirSync(videosDir).map((f) =>
            readJson<{
              transcript?: string;
              assertions?: { claim: string; verdicts?: { method: string; verdict: string }[] }[];
            }>(join(videosDir, f))!,
          )
        : [];
      const decided = new Set<string>();
      for (const r of recs)
        for (const as of r.assertions ?? [])
          if (
            (as.verdicts ?? []).some((v) => v.method === 'source' && ['right', 'wrong', 'partly'].includes(v.verdict))
          )
            decided.add(as.claim);
      const counts = {
        sources: recs.length,
        withCaptions: recs.filter((r) => r.transcript && r.transcript !== 'none').length,
        documents: existsSync(join(dir, 'sources'))
          ? readdirSync(join(dir, 'sources')).filter((f) => f.endsWith('.txt')).length
          : 0,
        claims: storeClaims(topic).length,
        decided: decided.size,
      };
      const t = thinness(counts, a.topics);
      if (has('--json')) console.log(JSON.stringify({ ...counts, ...t }, null, 1));
      else
        console.log(
          t.thin
            ? `THIN: ${t.why}`
            : `SUFFICIENT: ${counts.withCaptions} sources with captions, ${counts.documents} documents, ${counts.decided}/${counts.claims} claims decided`,
        );
      break;
    }
    default:
      usage();
  }
}

main().catch((e) => {
  if (e instanceof Refusal) {
    console.error(`refused: ${e.message}`);
    process.exit(2);
  }
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
