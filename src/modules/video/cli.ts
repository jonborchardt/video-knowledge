// npm run video -- <command> <topic> <story-id> [...]
//   narrate <topic> <story-id> [--regenerate]        synthesise the narration (cached by voice, rate and text); writes video/narration.json
//   timeline <topic> <story-id>                      tile the scenes by the measured audio; writes video/timeline.json
//   render <topic> <story-id> [--scene <id> | --from <id> --to <id>] [--force]
//                                                    render the scenes (cached chunks in video/scenes/) and assemble them with the narration and,
//                                                    when video/music.json exists, the soundtrack (video/mix.json records the mix):
//                                                    every scene of render.json into video/segment.mp4, or the given range into video/scenes/<range>.mp4
//   qa <topic> <story-id> [--no-frames]              check the mp4, extract inspection frames, write video/build-report.json, .md and the contact sheet
//   spike <topic> <story-id> [--regenerate] [--force] narrate, timeline, render, qa
//   package <topic> <story-id>                       the private review package in video/review/: the mp4 (copied),
//                                                    working title, description with measured chapters and sources, provenance, checklist
//   preview <topic> <story-id>                       open the Remotion studio on the same composition and timeline
//   init <topic> <story-id> [--force]                draft video/render.json from the storyboard (kept unless --force); lists the scenes needing a graphic
//   check <topic> <story-id>                         renderability and graphics approval before the lock: writes video/render-check.json
//   frames <topic> <story-id> --scene <id>           render one scene on its own and write video/frames/<id>-start, -mid, -end.png
//   migrate-keys [--write]                           the one-time graphic approval key migration: a table of every visual review record
//                                                    (old key, new key, migrated | stale); --write moves the migrated ones, writes video/key-migration.json
//   final <topic> <story-id> --approved-by "<name>"  the release build of a packaged story: the same words through Azure Speech
//                                                    (commercial terms; AZURE_SPEECH_KEY and AZURE_SPEECH_REGION from .env), then
//                                                    timeline, render, qa and package again in place; the approver is in the report's command
// Inputs: the validated script, storyboard and evidence package in topics/<topic>/scripts/<slug>/ and video/render.json
// (scenes, voice, cues, kinds, options), plus video/music.json (cues over music/<composition>/ assets) when there is a
// soundtrack. Media is written to topics/<topic>/scripts/<slug>/video/ and is not committed.
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { passageReader, readJson, sha, toJson, ROOT, REVIEW_DIR, scriptDir } from '../../shared/io';
import { currentBuild, recordApproved } from '../publishing';
import { approverProblem } from '../../shared/approver';
import { extractFrame, probe } from '../../shared/ffmpeg';
import { planKeyMigration, writeKeyMigration, writeRenderCheck } from './check';
import { initVideo } from './init';
import { MIX_FILE, type MixReport, loadMusicConfig, resolveCues } from './music';
import { narrate } from './narration';
import { type TtsProvider, provider } from './tts';
import { DECODABLE, type QaResult, extractInspectionFrames, qaSegment } from './qa';
import { assemble } from './assemble';
import { ENTRY, renderContactSheet, renderScenes } from './render';
import { buildReport, renderReportMd } from './report';
import { VIDEO_FILES, videoDir } from './files';
import { checkSegment, loadInputs, loadSegment } from './select';
import { finalRefusal } from './final';
import { buildTimeline } from './timeline';
import type { NarrationManifest, Timeline } from './types';

if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env')); // keys only; never committed
const [cmd, topic, storyId, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const usage = () => {
  console.error(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 23)
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'),
  );
  process.exit(1);
};
if (cmd === 'migrate-keys') {
  // no topic or story: it walks every visual review (kept until the video section's proof; that section deletes it)
  const plan = planKeyMigration();
  const rows = plan.flatMap((x) => x.rows);
  for (const r of rows)
    console.log([r.topic, r.story, r.scene, r.kind ?? '-', r.oldKey ?? '-', r.newKey ?? '-', r.class].join(' '));
  const migrated = rows.filter((r) => r.class === 'migrated').length;
  console.log(`${rows.length} records: ${migrated} migrated, ${rows.length - migrated} stale`);
  if (process.argv.slice(3).includes('--write'))
    for (const w of writeKeyMigration(plan, new Date().toISOString().slice(0, 10))) console.log(`wrote ${w}`);
  process.exit(0);
}
if (!cmd || !topic || !storyId) usage();
const dir = videoDir(topic, storyId);
const p = (name: string) => join(dir, name);
const rel = (f: string) =>
  f
    .replace(ROOT, '')
    .replace(/^[\\/]/, '')
    .replaceAll('\\', '/');
const command = `npm run video -- ${cmd} ${topic} ${storyId}${rest.length ? ' ' + rest.join(' ') : ''}`;
const sec = (frames: number, fps: number) => (frames / fps).toFixed(2);

async function stageNarrate(tts?: TtsProvider) {
  const seg = loadSegment(topic, storyId);
  const m = await narrate(seg, dir, { force: rest.includes('--regenerate'), tts, log: (l) => console.log(`  ${l}`) });
  const total = m.sentences.reduce((n, s) => n + s.duration, 0);
  const words = seg.sentences.reduce((n, s) => n + s.text.split(/\s+/).length, 0);
  console.log(
    `wrote ${rel(p(VIDEO_FILES.narration))}: ${m.provider}/${m.voice} at ${m.rate} (${m.licence}), ${m.sentences.length} sentences, ${total.toFixed(1)}s, ${Math.round((words / total) * 60)} wpm, cost $${m.cost}`,
  );
  return { seg, m };
}

function stageTimeline(seg = loadSegment(topic, storyId), m = readJson<NarrationManifest>(p(VIDEO_FILES.narration))) {
  if (!m) throw new Error(`no ${rel(p(VIDEO_FILES.narration))}; run narrate first`);
  const tl = buildTimeline(seg, m, undefined, passageReader());
  writeFileSync(p(VIDEO_FILES.timeline), toJson(tl));
  console.log(
    `wrote ${rel(p(VIDEO_FILES.timeline))}: ${tl.scenes.length} scenes, ${tl.durationInFrames} frames (${sec(tl.durationInFrames, tl.fps)}s at ${tl.fps} fps)`,
  );
  for (const s of tl.scenes)
    console.log(
      `  ${s.id} ${s.kind} ${sec(s.start, tl.fps)}-${sec(s.start + s.duration, tl.fps)}s${
        Object.keys(s.cues).length
          ? ' cues ' +
            Object.entries(s.cues)
              .map(([k, v]) => `${k}@${sec(v, tl.fps)}`)
              .join(' ')
          : ''
      }`,
    );
  return { seg, m, tl };
}

/** The scene ids `--scene` or `--from/--to` select, or every scene. */
function range(tl: Timeline): string[] | undefined {
  const one = flag('--scene');
  if (one) return [one];
  const from = flag('--from');
  const to = flag('--to');
  if (!from && !to) return undefined;
  const ids = tl.scenes.map((s) => s.id);
  const a = from ? ids.indexOf(from) : 0;
  const b = to ? ids.indexOf(to) : ids.length - 1;
  if (a < 0 || b < 0 || b < a) throw new Error(`bad range ${from ?? ids[0]} to ${to ?? ids.at(-1)}`);
  return ids.slice(a, b + 1);
}

async function stageRender(
  tl = readJson<Timeline>(p(VIDEO_FILES.timeline)),
  m = readJson<NarrationManifest>(p(VIDEO_FILES.narration)),
) {
  if (!tl || !m) throw new Error(`no ${rel(p(VIDEO_FILES.timeline))}; run timeline first`);
  const only = range(tl);
  const out = only
    ? p(`${VIDEO_FILES.scenes}/${only[0]}${only.length > 1 ? `-${only.at(-1)}` : ''}.mp4`)
    : p(VIDEO_FILES.mp4);
  const t0 = Date.now();
  let shown = '';
  const chunks = await renderScenes(tl, dir, p(VIDEO_FILES.scenes), {
    only,
    force: rest.includes('--force'),
    log: (l) => console.log(`  ${l}`),
    onProgress: (id, f) => {
      const line = `  ${id} ${Math.floor(f * 10) * 10}%`;
      if (line !== shown) process.stdout.write((shown = line) + '\r');
    },
  });
  const rendered = chunks.filter((c) => !c.cached).length;
  // the soundtrack belongs to the full segment: a scene or range render is narration only and leaves mix.json alone
  const config = only ? null : loadMusicConfig(dir);
  const music = config ? { config, cues: resolveCues(config, tl) } : null;
  if (!only && !config && existsSync(p(MIX_FILE))) unlinkSync(p(MIX_FILE)); // it would misdescribe this file
  const mix = assemble(tl, m, chunks, dir, out, true, music);
  const seconds = (Date.now() - t0) / 1000;
  const frames = chunks.reduce((n, c) => n + c.scene.duration, 0);
  console.log(
    `wrote ${rel(out)}: ${chunks.length} scenes (${rendered} rendered, ${chunks.length - rendered} cached), ${frames} frames, ${sec(frames, tl.fps)}s, in ${seconds.toFixed(1)}s`,
  );
  if (mix)
    console.log(
      `  soundtrack: ${mix.cues.length} cues, music ${mix.musicUnderSpeechDb} dB under the voice while it speaks, peak ${mix.peakDb} dB${mix.musicScale < 1 ? ` (music scaled x${mix.musicScale} to stay under ${mix.ceilingDb} dB)` : ''}; wrote ${rel(p(MIX_FILE))}`,
    );
  else if (!only) console.log('  no video/music.json: narration only');
  return { out, seconds, full: !only };
}

async function stageQa(
  seg = loadSegment(topic, storyId),
  m = readJson<NarrationManifest>(p(VIDEO_FILES.narration)),
  tl = readJson<Timeline>(p(VIDEO_FILES.timeline)),
  renderSeconds = 0,
) {
  if (!m || !tl) throw new Error('run narrate and timeline first');
  const out = p(VIDEO_FILES.mp4);
  const mix = readJson<MixReport>(p(MIX_FILE));
  const verdict = qaSegment(out, tl, seg, m, { mix, music: loadMusicConfig(dir) });
  const decodable = verdict.checks.some((c) => c.name === DECODABLE && c.ok);
  const qa: QaResult = {
    ...verdict,
    frames: decodable && !rest.includes('--no-frames') ? extractInspectionFrames(out, dir, tl) : [],
  };
  let contact: string | null = null;
  if (qa.frames.length) {
    contact = p(VIDEO_FILES.contact);
    await renderContactSheet(
      qa.frames
        .filter((f) => /-mid$|^first$/.test(f.label))
        .map((f) => ({
          file: rel(f.file).replace(rel(dir) + '/', ''),
          label: `${f.label} @ ${sec(f.frame, tl.fps)}s`,
        })),
      dir,
      contact,
    );
  }
  const r = buildReport(
    seg,
    tl,
    m,
    {
      file: rel(out),
      probe: existsSync(out) ? probe(out) : null,
      sha: existsSync(out) ? sha(readFileSync(out)) : null,
      renderSeconds,
    },
    qa,
    command,
    contact ? rel(contact) : null,
    mix,
  );
  writeFileSync(p(VIDEO_FILES.report), toJson(r));
  writeFileSync(p(VIDEO_FILES.reportMd), renderReportMd(r));
  for (const c of qa.checks) if (!c.ok) console.log(`  FAIL ${c.name}: ${c.detail}`);
  const failed = qa.checks.filter((c) => !c.ok).length;
  console.log(
    `${qa.ok ? 'passed' : 'FAILED'}: ${qa.checks.length - failed} of ${qa.checks.length} checks, ${qa.frames.length} frames in ${rel(join(dir, VIDEO_FILES.frames))}${contact ? `, ${rel(contact)}` : ''}; wrote ${rel(p(VIDEO_FILES.reportMd))}`,
  );
  // the last line, whatever ran before it: a reader (or a loop) never has to find the verdict in the log
  console.log(qa.ok ? 'RESULT: PASSED' : `RESULT: FAILED (${failed} of ${qa.checks.length} checks failed)`);
  if (!qa.ok) process.exitCode = 2;
  return qa;
}

/** The review package is packaging's: its own CLI, run as a child so this script never imports it. */
function runPackage(): number {
  const r = spawnSync(
    process.execPath,
    [
      join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      join('src', 'modules', 'packaging', 'cli.ts'),
      'package',
      topic,
      storyId,
    ],
    { cwd: ROOT, stdio: 'inherit' },
  );
  return r.status ?? 1;
}

function stageInit() {
  const r = initVideo(topic, storyId, { force: rest.includes('--force') });
  console.log(`${r.written ? 'wrote' : 'kept existing'} ${rel(p(VIDEO_FILES.config))}`);
  if (r.needsGraphics.length) console.log(`needs a graphic: ${r.needsGraphics.join(',')}`);
}

function stageCheck() {
  const rc = writeRenderCheck(topic, storyId);
  for (const x of rc.problems) console.log(`  PROBLEM ${x}`);
  if (rc.needsGraphics.length) console.log(`  needs a graphic: ${rc.needsGraphics.join(',')}`);
  for (const g of rc.graphics)
    console.log(`  graphic ${g.scene} ${g.kind} key ${g.key}${g.approved ? ' approved' : ''}`);
  console.log(`${rc.ok ? 'ok' : 'NOT OK'}: wrote ${rel(join(dir, 'render-check.json'))}`);
  if (!rc.ok) process.exitCode = 2;
}

/** One scene rendered on its own (its own narration, cached; its own one-scene timeline, not written) and three
 *  frames from it, for the graphics builder and the visual reviewer. Other scenes may still lack a renderer. */
async function stageFrames() {
  const id = flag('--scene');
  if (!id) throw new Error('--scene <id> is required');
  const inp = loadInputs(topic, storyId);
  const seg = checkSegment({ ...inp, release: null, config: { ...inp.config, scenes: [id] } });
  if (seg.problems.length) throw new Error(`cannot render ${id}:\n  ${seg.problems.join('\n  ')}`);
  const old = readJson<NarrationManifest>(p(VIDEO_FILES.narration));
  const v = seg.config.voice;
  const cached =
    old?.provider === v.provider &&
    old.voice === v.voice &&
    old.rate === v.rate &&
    seg.sentences.every((s) => old.sentences.some((o) => o.id === s.id && o.text === s.text && existsSync(p(o.file))));
  let m = old!;
  if (!cached) {
    m = await narrate(seg, dir, { log: (l) => console.log(`  ${l}`) });
    if (old?.provider === v.provider && old.voice === v.voice && old.rate === v.rate) {
      // narrate wrote only this scene's sentences; keep the rest of the manifest (same voice), in script order
      const order = new Map(inp.script.sections.flatMap((x) => x.sentences).map((s, i) => [s.id, i]));
      const mine = new Set(m.sentences.map((s) => s.id));
      m.sentences = [...old.sentences.filter((s) => !mine.has(s.id)), ...m.sentences].sort(
        (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
      );
      writeFileSync(p(VIDEO_FILES.narration), toJson(m));
    }
  }
  const tl = buildTimeline(seg, m, undefined, passageReader());
  const [chunk] = await renderScenes(tl, dir, p(VIDEO_FILES.scenes), { log: (l) => console.log(`  ${l}`) });
  const s = chunk.scene;
  mkdirSync(p(VIDEO_FILES.frames), { recursive: true });
  for (const [label, frame] of [
    ['start', Math.min(15, s.duration - 1)],
    ['mid', Math.round(s.duration / 2)],
    ['end', s.duration - 2],
  ] as const) {
    const out = p(`${VIDEO_FILES.frames}/${id}-${label}.png`);
    extractFrame(chunk.file, frame / tl.fps, out);
    console.log(`wrote ${rel(out)} (${sec(frame, tl.fps)}s into the scene)`);
  }
}

function preview() {
  const tl = p(VIDEO_FILES.timeline);
  if (!existsSync(tl)) throw new Error(`no ${rel(tl)}; run timeline first`);
  const r = spawnSync('npx', ['remotion', 'studio', ENTRY, '--props', tl, '--public-dir', dir], {
    stdio: 'inherit',
    shell: true,
  });
  process.exitCode = r.status ?? 1;
}

try {
  switch (cmd) {
    case 'narrate':
      await stageNarrate();
      break;
    case 'timeline':
      stageTimeline();
      break;
    case 'render':
      await stageRender();
      break;
    case 'qa':
      await stageQa();
      break;
    case 'spike': {
      const { seg, m } = await stageNarrate();
      const { tl } = stageTimeline(seg, m);
      const { seconds, full } = await stageRender(tl, m);
      if (full) await stageQa(seg, m, tl, seconds);
      break;
    }
    case 'package':
      process.exitCode = runPackage();
      break;
    case 'final': {
      // The release build: a person accepted the draft package, so the same words go through the commercial voice.
      const problem = approverProblem(flag('--approved-by'));
      if (problem) throw new Error(problem);
      const refusal = finalRefusal(topic, storyId, ROOT); // the board, asked through its CLI
      if (refusal) throw new Error(refusal);
      const draft = currentBuild(scriptDir(topic, storyId)); // the build this run accepts, before the release build replaces it
      const { seg, m } = await stageNarrate(provider('azure'));
      const { tl } = stageTimeline(seg, m);
      const { seconds } = await stageRender(tl, m);
      const qa = await stageQa(seg, m, tl, seconds);
      if (!qa.ok) throw new Error('QA failed; the draft package stands');
      if (runPackage() !== 0) throw new Error('package failed');
      // the acceptance goes into the publishing ledger too, so the audit trail shows who accepted which draft
      if (draft?.status === 'draft')
        recordApproved(topic, storyId, {
          by: flag('--approved-by')!,
          build: draft.sha,
          accepted: true,
          note: 'draft accepted by final',
        });
      // the run report is the produce agent's prose and named the draft voice as a blocker: say what settled it
      const runReport = p(`${REVIEW_DIR}/run-report.md`);
      if (existsSync(runReport) && !readFileSync(runReport, 'utf8').includes('## Release build'))
        appendFileSync(
          runReport,
          `\n## Release build\n\n- ${new Date().toISOString().slice(0, 10)}: \`${command}\` re-narrated the same words with Azure Speech (commercial terms) and packaged the release build; the blockers above are history.\n`,
        );
      break;
    }
    case 'preview':
      preview();
      break;
    case 'init':
      stageInit();
      break;
    case 'check':
      stageCheck();
      break;
    case 'frames':
      await stageFrames();
      break;
    default:
      usage();
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  if (['qa', 'spike', 'render', 'final'].includes(cmd)) console.log('RESULT: FAILED (stopped with an error, above)');
  process.exit(2);
}
