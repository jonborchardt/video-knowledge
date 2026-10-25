// PostToolUse hook (.claude/settings.json): after the first edit to a site file in a session, remind the agent that the
// web-quality gate applies. It only reminds; the gate itself is `npm run quality`, `npm run validate` and CI.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0); // not hook input: nothing to remind
}
const file = String(input.tool_input?.file_path ?? '').replaceAll('\\', '/');
const site = /\/(src\/(pages|components|layouts|styles|config)\/|public\/|astro\.config\.mjs$)/.test(file);
const marker = join(tmpdir(), `web-quality-reminded-${String(input.session_id ?? 'none').replace(/\W/g, '')}`);
if (site && !existsSync(marker)) {
  writeFileSync(marker, file);
  const additionalContext =
    'web-quality: you edited a public site file. Follow .claude/skills/web-quality/SKILL.md: before calling the change ' +
    'done run `npm run quality` (RESULT line), triage new vs existing findings, fix what the change caused, then ' +
    '`npm run validate`. Report checks not run as not run.';
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext } }));
}
