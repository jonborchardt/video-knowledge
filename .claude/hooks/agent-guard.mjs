#!/usr/bin/env node
// PreToolUse hook for unattended agents (spec §4.6, layer 4): a second, runner-controlled check inside the agent
// process. Inert unless the runner set VK_AGENT=1. Denies an Edit/Write outside the role's writable set (VK_WRITABLE,
// gitignore-style patterns relative to the repo, ';'-separated) and any Bash command that is not exactly one allowed
// verb (VK_SHELL, Claude Code Bash rules). It only ever denies; the permission rules decide the rest.
import { isAbsolute, relative } from 'node:path';

if (process.env.VK_AGENT !== '1') process.exit(0);

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
let input = {};
try {
  input = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
} catch {
  process.exit(0);
}
const deny = (reason) => {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }),
  );
  process.exit(0);
};
const toPosix = (p) => p.replaceAll('\\', '/');
const matches = (path, pattern) => {
  const re = new RegExp(
    '^' +
      toPosix(pattern)
        .split('**')
        .map((part) => part.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*'))
        .join('.*') +
      '$',
  );
  return re.test(path);
};
const list = (v) => (v ?? '').split(';').filter(Boolean);
const cwd = input.cwd ?? process.cwd();
const tool = input.tool_name ?? '';

if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
  const file = input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? '';
  const rel = toPosix(isAbsolute(file) ? relative(cwd, file) : file);
  if (!rel || rel.startsWith('..')) deny(`outside the repository: ${file}`);
  if (!list(process.env.VK_WRITABLE).some((p) => matches(rel, p))) deny(`outside the role's files: ${rel}`);
  process.exit(0);
}

if (tool === 'Bash') {
  const cmd = String(input.tool_input?.command ?? '').trim();
  const verbs = list(process.env.VK_SHELL);
  if (verbs.length === 0) deny('this role has no shell');
  if (/[;&|`$<>\n]|--prefix|\s-C\s/.test(cmd)) deny(`not a single plain command: ${cmd}`);
  if (/--force\b|--replace-cited\b/.test(cmd)) deny(`a forbidden flag: ${cmd}`);
  const ok = verbs.some((rule) => {
    const m = /^Bash\((.*)\)$/.exec(rule);
    if (!m) return false;
    const prefix = m[1].replace(/\s*\*$/, '');
    return cmd === prefix || cmd.startsWith(prefix + ' ');
  });
  if (!ok) deny(`not an allowed verb for this role: ${cmd}`);
  process.exit(0);
}
process.exit(0);
