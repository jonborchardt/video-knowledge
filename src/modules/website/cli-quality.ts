// The web-quality gate's runner (.claude/skills/web-quality/SKILL.md).
//   npm run quality                 changed-code check: build, static gate, browser suite on one page per template (Chromium)
//   npm run quality -- --audit      full audit: every page, Chromium + Firefox + WebKit, plus npm audit of shipped deps
//   --no-build                      reuse dist/ (it must have been built from the current tree)
// Machine-readable results land in .web-quality/ (gitignored); the last line is RESULT: PASSED or RESULT: FAILED (...).
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../../shared/io';

const args = process.argv.slice(2);
const audit = args.includes('--audit');
const out = join(ROOT, '.web-quality');
mkdirSync(out, { recursive: true });

const run = (label: string, cmd: string, env: Record<string, string> = {}) => {
  console.log(`\n== ${label}: ${cmd}`);
  const r = spawnSync(cmd, { cwd: ROOT, stdio: 'inherit', shell: true, env: { ...process.env, ...env } });
  return r.status === 0 ? null : label;
};

const changed = spawnSync('git diff --name-only main...HEAD && git diff --name-only HEAD', {
  cwd: ROOT,
  shell: true,
  encoding: 'utf8',
}).stdout;
const frontend = [...new Set(changed.split(/\r?\n/))].filter((f) =>
  /^(src\/(pages|components|layouts|styles|config)\/|public\/|astro\.config)/.test(f),
);
console.log(`Frontend files changed against main: ${frontend.length ? '\n  ' + frontend.join('\n  ') : 'none'}`);

const failed = [
  args.includes('--no-build') ? null : run('build', 'npm run build'),
  run(
    'static gate',
    `npx vitest run --project unit tests/web-quality.test.ts tests/dist.test.ts --reporter=default --reporter=json --outputFile.json=.web-quality/static.json`,
  ),
  audit ? run('dependency audit', 'npm audit --omit=dev --audit-level=high') : null,
  run(
    'browser suite',
    `npx vitest run --project browser --reporter=default --reporter=json --outputFile.json=.web-quality/browser.json`,
    audit ? { WEB_QUALITY_BROWSERS: 'chromium,firefox,webkit', WEB_QUALITY_FULL: '1' } : {},
  ),
].filter(Boolean);

console.log(`\nResults: .web-quality/static.json, .web-quality/browser.json`);
console.log(failed.length ? `RESULT: FAILED (${failed.join(', ')})` : 'RESULT: PASSED');
process.exit(failed.length ? 1 : 0);
