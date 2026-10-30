// npm run rehearse -- <topic> <story-id> [--keep]
// A go-live rehearsal (src/lib/rehearsal.ts): copies the working tree (tracked and untracked, not gitignored) into a
// temp folder outside the repo, writes a fixture `published` event into the copy's ledger, and runs the CLAUDE.md
// post-go-live sequence there with WEB_QUALITY_FULL=1 (every page). The real checkout is never written. DEPLOY_TARGET
// passes through, so `DEPLOY_TARGET=pages npm run rehearse -- ...` rehearses the mirror. --keep leaves the copy to
// preview. Exit 0 RESULT: PASSED, 1 RESULT: FAILED (<step>), 2 on a refusal.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { ROOT, toJson } from '../src/shared/io';
import { publishPath } from '../src/modules/publishing';
import { rehearsalDir, rehearsalLedger, rehearsalRefusal, rehearsalSteps, removeRehearsal } from '../src/lib/rehearsal';
import { storyUrlSlug } from '../src/lib/stories';

const args = process.argv.slice(2);
const keep = args.includes('--keep');
const [topic, storyId] = args.filter((a) => !a.startsWith('--'));
if (!topic || !storyId) {
  console.error('usage: npm run rehearse -- <topic> <story-id> [--keep]');
  process.exit(2);
}
const refusal = rehearsalRefusal(topic, storyId);
if (refusal) {
  console.error(`refused: ${refusal}`);
  process.exit(2);
}
const dir = rehearsalDir(topic, storyId);
const rel = relative(ROOT, dir);
if (!rel.startsWith('..') && !isAbsolute(rel)) {
  console.error(`refused: the rehearsal folder ${dir} is inside the repo`);
  process.exit(2);
}

removeRehearsal(dir);
const files = spawnSync('git ls-files -co --exclude-standard -z', { cwd: ROOT, shell: true, encoding: 'utf8' })
  .stdout.split('\0')
  .filter((f) => f && existsSync(join(ROOT, f)));
for (const f of files) {
  mkdirSync(dirname(join(dir, f)), { recursive: true });
  copyFileSync(join(ROOT, f), join(dir, f));
}
symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'junction');
writeFileSync(publishPath(topic, storyId, dir), toJson(rehearsalLedger(topic, storyId, new Date().toISOString())));
console.log(`Rehearsal copy: ${dir} (${files.length} files)`);

// the real checkout's dist/<topic> may exist (a live topic); the rehearsal must not touch it
const realDist = () => (existsSync(join(ROOT, 'dist', topic)) ? statSync(join(ROOT, 'dist', topic)).mtimeMs : null);
const distBefore = realDist();
let failed: string | null = null;
for (const cmd of rehearsalSteps(topic)) {
  console.log(`\n== rehearse: ${cmd}`);
  const r = spawnSync(cmd, { cwd: dir, shell: true, stdio: 'inherit', env: { ...process.env, WEB_QUALITY_FULL: '1' } });
  if (r.status !== 0) {
    failed = cmd;
    break;
  }
}
if (!failed && !existsSync(join(dir, 'dist', topic, storyUrlSlug({ id: storyId }), 'index.html')))
  failed = 'the story page was not built';
if (realDist() !== distBefore) failed = `leak: ${join(ROOT, 'dist', topic)} changed in the real checkout`;

if (keep) console.log(`\nTo review: cd "${dir}" && npm run preview (then stop it: kill the process on port 4321)`);
else removeRehearsal(dir);
console.log(failed ? `RESULT: FAILED (${failed})` : 'RESULT: PASSED');
process.exit(failed ? 1 : 0);
