#!/usr/bin/env node
// A stand-in for the research CLIs in topic-runner tests: the watcher's fetch (records and cached transcripts from
// the list files), the evidence verbs (groups writes the group files; the checks pass), merge-claims, record (the
// store's assertions and claims, with an optional failure mid-batch once), record-sources (source verdicts, or a
// refusal), report (report.json and public-record.json with open revisions), report note, stories discover (the
// mode the config names), brand, topics claim. Run as `node fake-research-cli.mjs <cli> <args...>` in the root;
// FAKE_RESEARCH_CONFIG names a JSON file: { recordFailAt?, refuseCited?, storiesMode?, openRevisions? }.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [cli, ...args] = process.argv.slice(2);
const root = process.cwd();
const cfg = process.env.FAKE_RESEARCH_CONFIG ? JSON.parse(readFileSync(process.env.FAKE_RESEARCH_CONFIG, 'utf8')) : {};
const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const write = (p, x) => {
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, JSON.stringify(x, null, 1) + '\n');
};
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
const topicOf = (storeRel) => storeRel.split('/')[1];
const storeDir = (topic) => join(root, 'topics', topic, 'store');
const claimsOf = (topic) => {
  const t = read(join(storeDir(topic), 'topics.json'));
  return t ? t.topics[0].claims : [];
};
const saveClaims = (topic, claims) =>
  write(join(storeDir(topic), 'topics.json'), { topics: [{ id: topic, label: 'T', known: false, claims }] });
const records = (topic) =>
  existsSync(join(storeDir(topic), 'videos'))
    ? readdirSync(join(storeDir(topic), 'videos')).map((f) => read(join(storeDir(topic), 'videos', f)))
    : [];
const saveRecord = (topic, r) => write(join(storeDir(topic), 'videos', `${r.id}.json`), r);
const verb = args[0];

switch (cli) {
  case 'watcher': {
    if (verb !== 'fetch') break;
    const list = args[1];
    const topic = topicOf(args[args.indexOf('--store') + 1]);
    mkdirSync(join(storeDir(topic), 'transcripts'), { recursive: true });
    const lines = readFileSync(join(root, list), 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
    let noCaptions = 0;
    for (const url of lines) {
      const id = /v=([\w-]{11})/.exec(url)?.[1] ?? slug(url.replace(/^https?:\/\//, ''));
      if (existsSync(join(storeDir(topic), 'videos', `${id}.json`))) continue;
      const captions = !(cfg.noCaptions ?? []).includes(id);
      saveRecord(topic, { id, title: `Video ${id}`, channel: 'c', url, transcript: captions ? 'youtube' : 'none' });
      if (captions) writeFileSync(join(storeDir(topic), 'transcripts', `${id}.txt`), 'transcript '.repeat(100));
      else noCaptions++;
    }
    if (!existsSync(join(storeDir(topic), 'topics.json'))) saveClaims(topic, []);
    console.log(`fetched ${lines.length}`);
    process.exit(noCaptions ? 2 : 0);
  }
  // eslint-disable-next-line no-fallthrough -- process.exit above ends the case
  case 'evidence': {
    const topic = args[1];
    if (verb === 'groups') {
      const raw = records(topic).filter((r) => !r.assertions && r.transcript !== 'none');
      mkdirSync(join(root, 'topics', topic, 'work'), { recursive: true });
      writeFileSync(
        join(root, 'topics', topic, 'work', 'grp1.txt'),
        raw.map((r) => `${r.id}\tt\t${r.title}`).join('\n') + '\n',
      );
      writeFileSync(
        join(root, 'topics', topic, 'work', 'claims.txt'),
        claimsOf(topic)
          .map((c) => `${c.id} — ${c.text}`)
          .join('\n') + '\n',
      );
      console.log(`${raw.length ? 1 : 0} group`);
    } else console.log('RESULT: PASSED');
    process.exit(0);
  }
  // eslint-disable-next-line no-fallthrough -- process.exit above ends the case
  case 'merge-claims':
  case 'brand':
    console.log('ok');
    process.exit(0);
  // eslint-disable-next-line no-fallthrough -- process.exit above ends the case
  case 'record': {
    const topic = args[0];
    const file = args[1];
    const from = args.includes('--from') ? args[args.indexOf('--from') + 1] : null;
    const batches = read(join(root, file));
    const claims = claimsOf(topic);
    const byText = new Map(claims.map((c) => [c.text, c.id]));
    let go = !from;
    for (const b of batches) {
      go ||= b.video === from;
      if (!go) continue;
      const flag = join(root, '.fake-record-failed');
      if (cfg.recordFailAt === b.video && !existsSync(flag)) {
        writeFileSync(flag, 'once');
        console.error('watcher: store write failed (planted)');
        process.exit(1);
      }
      const rec = records(topic).find((r) => r.id === b.video);
      if (!rec) throw new Error(`no record ${b.video}`);
      let created = 0;
      rec.assertions = b.as.map((a) => {
        let id;
        if (a.n) {
          id = byText.get(a.n);
          if (!id) {
            id = `${topic}/${slug(a.n)}`;
            claims.push({ id, text: a.n, firstSeen: b.video });
            byText.set(a.n, id);
            created++;
          }
        } else if (a.n2) id = byText.get(a.n2);
        else id = a.c.includes('/') ? a.c : `${topic}/${a.c}`;
        return {
          claim: id,
          stance: a.s === 'd' ? 'denies' : 'asserts',
          quote: a.q,
          verdicts: a.v ? [{ method: 'prior', verdict: a.v[0], confidence: a.v[1], note: a.v[2] }] : [],
        };
      });
      saveRecord(topic, rec);
      saveClaims(topic, claims);
      console.log(`${b.video}: ${rec.assertions.length} claims, ${created} new`);
    }
    process.exit(0);
  }
  // eslint-disable-next-line no-fallthrough -- process.exit above ends the case
  case 'record-sources': {
    const topic = args[0];
    if (cfg.refuseCited) {
      console.error('refused: a verdict would replace one a script cites; pass --replace-cited to replace it');
      process.exit(2);
    }
    for (const f of args.slice(1)) {
      for (const v of read(join(root, f))) {
        for (const r of records(topic)) {
          let hit = false;
          for (const as of r.assertions ?? [])
            if (as.claim === v.claim) {
              (as.verdicts ??= []).push({
                method: 'source',
                verdict: v.verdict,
                confidence: v.confidence,
                note: v.note,
                source: v.source,
              });
              hit = true;
            }
          if (hit) saveRecord(topic, r);
        }
      }
    }
    console.log('recorded');
    process.exit(0);
  }
  // eslint-disable-next-line no-fallthrough -- process.exit above ends the case
  case 'report': {
    if (verb === 'note') {
      const [, topic, claim, note] = args;
      const pr = read(join(root, 'topics', topic, 'public-record.json'));
      for (const r of pr.revisions) if (r.id === claim && !r.note) r.note = note;
      write(join(root, 'topics', topic, 'public-record.json'), pr);
      console.log(`noted ${claim}`);
      process.exit(0);
    }
    for (const topic of readdirSync(join(root, 'topics'))) {
      if (!existsSync(join(storeDir(topic), 'topics.json'))) continue;
      const claims = claimsOf(topic);
      write(join(root, 'topics', topic, 'report.json'), {
        topics: [{ id: topic, label: 'T', claims: claims.map((c) => ({ id: c.id, text: c.text })) }],
      });
      const existing = read(join(root, 'topics', topic, 'public-record.json'));
      if (!existing)
        write(join(root, 'topics', topic, 'public-record.json'), {
          exhibits: {},
          revisions: claims
            .slice(0, cfg.openRevisions ?? 0)
            .map((c) => ({ kind: 'claim', id: c.id, date: '2026-11-01', from: 'unknown', to: 'right', note: '' })),
        });
      console.log(`wrote topics/${topic}/report.json`);
    }
    process.exit(0);
  }
  // eslint-disable-next-line no-fallthrough -- process.exit above ends the case
  case 'stories': {
    const topic = args[1];
    const reviewed = existsSync(join(root, 'topics', topic, 'story-review.json'));
    const claims = claimsOf(topic);
    const mode = cfg.storiesMode ?? 'ready';
    const story = (readiness) => ({
      id: `decision:${slug(claims[0]?.text ?? 'x')}`,
      question: 'Is it true?',
      readiness,
      reviewed,
      blocking: readiness === 'needs-research' ? ['no study decides the central claim'] : [],
      readinessWhy: '',
      partOf: undefined,
      scores: { overall: 0.7, evidence: 0.7 },
    });
    let file;
    if (mode === 'none')
      file = { stories: [], rejected: [], basis: { candidates: 0, claims: claims.length, studies: 0 } };
    else if (mode === 'keptNone')
      file = reviewed
        ? {
            stories: [],
            rejected: [{ id: 'decision:x', reason: 'not a story: a list of loosely related claims' }],
            basis: { candidates: 1, claims: claims.length, studies: 1 },
          }
        : {
            stories: [story('needs-review')],
            rejected: [],
            basis: { candidates: 1, claims: claims.length, studies: 1 },
          };
    else
      file = {
        stories: [story(reviewed ? 'ready' : 'needs-review')],
        rejected: [],
        basis: { candidates: 1, claims: claims.length, studies: 1 },
      };
    write(join(root, 'topics', topic, 'stories.json'), file);
    console.log(`wrote topics/${topic}/stories.json: ${file.stories.length} stories`);
    process.exit(0);
  }
  // eslint-disable-next-line no-fallthrough -- process.exit above ends the case
  default:
    console.error(`fake research cli: no ${cli} ${verb ?? ''}`);
    process.exit(1);
}
