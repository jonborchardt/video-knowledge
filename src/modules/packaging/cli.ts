// npm run video -- package <topic> <story-id>   (spawns: tsx src/modules/packaging/cli.ts package <topic> <story-id>)
//   package <topic> <story-id>   the review package in video/review/: the mp4 (copied), working title, description with
//                                measured chapters and sources, provenance, captions, checklist; a Short is also recorded
//                                as an output of its parent's publish.json
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReviewPackage } from './package';
import { readJson, REVIEW_DIR, ROOT, scriptDir, shortOf } from '../../shared/io';
import { type BuildReport, type Timeline, VIDEO_FILES, loadSegment, videoDir } from '../video';

const [cmd, topic, storyId] = process.argv.slice(2);
if (cmd !== 'package' || !topic || !storyId) {
  console.error(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 5)
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'),
  );
  process.exit(1);
}
const dir = videoDir(topic, storyId);
const p = (name: string) => join(dir, name);
const rel = (f: string) =>
  f
    .replace(ROOT, '')
    .replace(/^[\\/]/, '')
    .replaceAll('\\', '/');

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
  // A Short is an output of its parent's ledger (short:<slug>, derived from the main video, its folder the source);
  // the ledger is publishing's, so it is written through its CLI (tsx, no shell), never by importing a write.
  const short = shortOf(storyId);
  if (short) {
    const id = `short:${short.slug}`;
    const r = spawnSync(
      process.execPath,
      [
        join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        join('src', 'modules', 'publishing', 'cli.ts'),
        'add',
        topic,
        short.parent,
        id,
        '--kind',
        'youtube-short',
        '--from',
        'youtube',
        '--source',
        rel(scriptDir(topic, storyId)),
      ],
      { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' },
    );
    const out = `${r.stderr ?? ''}${r.stdout ?? ''}`;
    if (r.status === 0) console.log(`recorded ${id} in ${short.parent}'s publish.json`);
    else if (!/exists/.test(out)) throw new Error(out.trim() || `publish add failed (${r.status})`);
  }
}

try {
  stagePackage();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(2);
}
