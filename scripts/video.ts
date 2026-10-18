// npm run video -- <command> <topic> <story-id> [...]
//   narrate <topic> <story-id> [--regenerate]        synthesise the narration (cached by voice, rate and text); writes video/narration.json
//   timeline <topic> <story-id>                      tile the scenes by the measured audio; writes video/timeline.json
//   render <topic> <story-id> [--scene <id> | --from <id> --to <id>] [--force]
//                                                    render the scenes (cached chunks in video/scenes/) and assemble them with the narration:
//                                                    every scene of render.json into video/segment.mp4, or the given range into video/scenes/<range>.mp4
//   qa <topic> <story-id> [--no-frames]              check the mp4, extract inspection frames, write video/build-report.json, .md and the contact sheet
//   spike <topic> <story-id> [--regenerate] [--force] narrate, timeline, render, qa
//   preview <topic> <story-id>                       open the Remotion studio on the same composition and timeline
// Inputs: the validated script, storyboard and evidence package in <topic>/scripts/<slug>/ and video/render.json
// (scenes, voice, cues, kinds, options). Media is written to <topic>/scripts/<slug>/video/ and is not committed.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { passageReader } from '../src/lib/evidence';
import { readJson, toJson } from '../src/lib/script';
import { probe } from '../src/video/ffmpeg';
import { narrate } from '../src/video/narration';
import { qaSegment } from '../src/video/qa';
import { ENTRY, assemble, renderContactSheet, renderScenes } from '../src/video/render';
import { buildReport, renderReportMd } from '../src/video/report';
import { VIDEO_FILES, loadSegment, videoDir } from '../src/video/select';
import { buildTimeline } from '../src/video/timeline';
import type { NarrationManifest, Timeline } from '../src/video/types';

const [cmd, topic, storyId, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const usage = () => {
  console.error(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 11)
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
const sec = (frames: number, fps: number) => (frames / fps).toFixed(2);

async function stageNarrate() {
  const seg = loadSegment(topic, storyId);
  const m = await narrate(seg, dir, { force: rest.includes('--regenerate'), log: (l) => console.log(`  ${l}`) });
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
  assemble(tl, m, chunks, dir, out);
  const seconds = (Date.now() - t0) / 1000;
  const frames = chunks.reduce((n, c) => n + c.scene.duration, 0);
  console.log(
    `wrote ${rel(out)}: ${chunks.length} scenes (${rendered} rendered, ${chunks.length - rendered} cached), ${frames} frames, ${sec(frames, tl.fps)}s, in ${seconds.toFixed(1)}s`,
  );
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
  const qa = qaSegment(out, dir, tl, seg, m, { frames: !rest.includes('--no-frames') });
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
    { file: rel(out), probe: existsSync(out) ? probe(out) : null, renderSeconds },
    qa,
    command,
    contact ? rel(contact) : null,
  );
  writeFileSync(p(VIDEO_FILES.report), toJson(r));
  writeFileSync(p(VIDEO_FILES.reportMd), renderReportMd(r));
  for (const c of qa.checks) if (!c.ok) console.log(`  FAIL ${c.name}: ${c.detail}`);
  console.log(
    `${qa.ok ? 'passed' : 'FAILED'}: ${qa.checks.filter((c) => c.ok).length} of ${qa.checks.length} checks, ${qa.frames.length} frames in ${rel(join(dir, VIDEO_FILES.frames))}${contact ? `, ${rel(contact)}` : ''}; wrote ${rel(p(VIDEO_FILES.reportMd))}`,
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
