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
// Inputs: the validated script, storyboard and evidence package in <topic>/scripts/<slug>/ and video/render.json
// (scenes, voice, cues, kinds, options), plus video/music.json (cues over music/<composition>/ assets) when there is a
// soundtrack. Media is written to <topic>/scripts/<slug>/video/ and is not committed.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { passageReader } from '../src/lib/evidence';
import { readJson, sha, toJson } from '../src/lib/io';
import { probe } from '../src/video/ffmpeg';
import { MIX_FILE, type MixReport, loadMusicConfig, resolveCues } from '../src/video/music';
import { narrate } from '../src/video/narration';
import { REVIEW_DIR, buildReviewPackage } from '../src/video/package';
import { qaSegment } from '../src/video/qa';
import { ENTRY, assemble, renderContactSheet, renderScenes } from '../src/video/render';
import { type BuildReport, buildReport, renderReportMd } from '../src/video/report';
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
      .slice(0, 14)
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
  const qa = qaSegment(out, dir, tl, seg, m, {
    frames: !rest.includes('--no-frames'),
    mix,
    music: loadMusicConfig(dir),
  });
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
  console.log(
    `${qa.ok ? 'passed' : 'FAILED'}: ${qa.checks.filter((c) => c.ok).length} of ${qa.checks.length} checks, ${qa.frames.length} frames in ${rel(join(dir, VIDEO_FILES.frames))}${contact ? `, ${rel(contact)}` : ''}; wrote ${rel(p(VIDEO_FILES.reportMd))}`,
  );
  if (!qa.ok) process.exitCode = 2;
}

function stagePackage() {
  const seg = loadSegment(topic, storyId);
  const tl = readJson<Timeline>(p(VIDEO_FILES.timeline));
  const report = readJson<BuildReport>(p(VIDEO_FILES.report));
  if (!tl || !report) throw new Error('run render and qa first');
  if (
    report.fingerprints.script !== seg.fingerprints.script ||
    report.fingerprints.storyboard !== seg.fingerprints.storyboard
  )
    throw new Error('the build report is from another script or storyboard; run qa again');
  const r = buildReviewPackage(seg, tl, report, dir, (l) => console.log(`  ${l}`));
  console.log(
    `wrote ${rel(p(REVIEW_DIR))}: ${r.title}, ${r.chapters.length} chapters, ${r.sources.studies.length} studies, ${r.sources.sources.length} sources; ${r.provenance.clearance.publishable ? 'cleared' : 'public release BLOCKED: ' + r.provenance.clearance.why.join('; ')}`,
  );
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
      stagePackage();
      break;
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
