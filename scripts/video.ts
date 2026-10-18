// npm run video -- <command> <topic> <story-id> [...]
//   narrate <topic> <story-id> [--regenerate]   synthesise the segment's narration (cached by voice, rate and text); writes video/narration.json
//   timeline <topic> <story-id>                 tile the scenes by the measured audio; writes video/timeline.json
//   render <topic> <story-id>                   render video/segment.mp4 from timeline.json
//   qa <topic> <story-id> [--no-frames]         check the mp4, extract inspection frames, write video/build-report.json and .md
//   spike <topic> <story-id> [--regenerate]     narrate, timeline, render, qa
//   preview <topic> <story-id>                  open the Remotion studio on the same composition and timeline
// Inputs: the validated script, storyboard and evidence package in <topic>/scripts/<slug>/ and video/render.json
// (scenes, voice, cues). Media is written to <topic>/scripts/<slug>/video/ and is not committed.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, toJson } from '../src/lib/script';
import { probe } from '../src/video/ffmpeg';
import { narrate } from '../src/video/narration';
import { qaSegment } from '../src/video/qa';
import { ENTRY, renderTimeline } from '../src/video/render';
import { buildReport, renderReportMd } from '../src/video/report';
import { VIDEO_FILES, loadSegment, videoDir } from '../src/video/select';
import { buildTimeline } from '../src/video/timeline';
import type { NarrationManifest, Timeline } from '../src/video/types';

const [cmd, topic, storyId, ...rest] = process.argv.slice(2);
const usage = () => {
  console.error(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 9)
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'),
  );
  process.exit(1);
};
if (!cmd || !topic || !storyId) usage();
const dir = videoDir(topic, storyId);
const p = (name: string) => join(dir, name);
const rel = (f: string) =>
  f
    .replace(process.cwd(), '')
    .replace(/^[\\/]/, '')
    .replaceAll('\\', '/');
const command = `npm run video -- ${cmd} ${topic} ${storyId}${rest.length ? ' ' + rest.join(' ') : ''}`;

function stageNarrate() {
  const seg = loadSegment(topic, storyId);
  const m = narrate(seg, dir, { force: rest.includes('--regenerate'), log: (l) => console.log(`  ${l}`) });
  const total = m.sentences.reduce((n, s) => n + s.duration, 0);
  console.log(
    `wrote ${rel(p(VIDEO_FILES.narration))}: ${m.provider}/${m.voice}, ${m.sentences.length} sentences, ${total.toFixed(1)}s`,
  );
  return { seg, m };
}

function stageTimeline(seg = loadSegment(topic, storyId), m = readJson<NarrationManifest>(p(VIDEO_FILES.narration))) {
  if (!m) throw new Error(`no ${rel(p(VIDEO_FILES.narration))}; run narrate first`);
  const tl = buildTimeline(seg, m);
  writeFileSync(p(VIDEO_FILES.timeline), toJson(tl));
  console.log(
    `wrote ${rel(p(VIDEO_FILES.timeline))}: ${tl.scenes.length} scenes, ${tl.durationInFrames} frames (${(tl.durationInFrames / tl.fps).toFixed(2)}s at ${tl.fps} fps)`,
  );
  for (const s of tl.scenes)
    console.log(
      `  ${s.id} ${s.kind} ${(s.start / tl.fps).toFixed(2)}-${((s.start + s.duration) / tl.fps).toFixed(2)}s${
        Object.keys(s.cues).length
          ? ' cues ' +
            Object.entries(s.cues)
              .map(([k, v]) => `${k}@${(v / tl.fps).toFixed(2)}`)
              .join(' ')
          : ''
      }`,
    );
  return { seg, m, tl };
}

async function stageRender(tl = readJson<Timeline>(p(VIDEO_FILES.timeline))) {
  if (!tl) throw new Error(`no ${rel(p(VIDEO_FILES.timeline))}; run timeline first`);
  const out = p(VIDEO_FILES.mp4);
  const t0 = Date.now();
  let shown = -1;
  await renderTimeline(tl, dir, out, (f) => {
    const pct = Math.floor(f * 10) * 10;
    if (pct > shown) process.stdout.write(`  rendering ${(shown = pct)}%\r`);
  });
  const seconds = (Date.now() - t0) / 1000;
  console.log(`wrote ${rel(out)} in ${seconds.toFixed(1)}s`);
  return { out, seconds };
}

function stageQa(
  seg = loadSegment(topic, storyId),
  m = readJson<NarrationManifest>(p(VIDEO_FILES.narration)),
  tl = readJson<Timeline>(p(VIDEO_FILES.timeline)),
  renderSeconds = 0,
) {
  if (!m || !tl) throw new Error('run narrate and timeline first');
  const out = p(VIDEO_FILES.mp4);
  const qa = qaSegment(out, dir, tl, seg, m, { frames: !rest.includes('--no-frames') });
  const r = buildReport(
    seg,
    tl,
    m,
    { file: rel(out), probe: existsSync(out) ? probe(out) : null, renderSeconds },
    qa,
    command,
  );
  writeFileSync(p(VIDEO_FILES.report), toJson(r));
  writeFileSync(p(VIDEO_FILES.reportMd), renderReportMd(r));
  for (const c of qa.checks) if (!c.ok) console.log(`  FAIL ${c.name}: ${c.detail}`);
  console.log(
    `${qa.ok ? 'passed' : 'FAILED'}: ${qa.checks.filter((c) => c.ok).length} of ${qa.checks.length} checks, ${qa.frames.length} frames in ${rel(join(dir, VIDEO_FILES.frames))}; wrote ${rel(p(VIDEO_FILES.reportMd))}`,
  );
  if (!qa.ok) process.exitCode = 2;
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
      stageNarrate();
      break;
    case 'timeline':
      stageTimeline();
      break;
    case 'render':
      await stageRender();
      break;
    case 'qa':
      stageQa();
      break;
    case 'spike': {
      const { seg, m } = stageNarrate();
      const { tl } = stageTimeline(seg, m);
      const { seconds } = await stageRender(tl);
      stageQa(seg, m, tl, seconds);
      break;
    }
    case 'preview':
      preview();
      break;
    default:
      usage();
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(2);
}
