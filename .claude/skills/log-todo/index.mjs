// log-todo index: reads todo/NNNN-*.md, validates the frontmatter, rewrites todo/INDEX.md.
//   node .claude/skills/log-todo/index.mjs            rewrite INDEX.md (seeds areas.md when missing)
//   node .claude/skills/log-todo/index.mjs --json     print todos, areas and warnings; write nothing
//   node .claude/skills/log-todo/index.mjs --self-test
// No dependencies. Deterministic: a rerun is byte-identical.
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const KEYS = ['id', 'title', 'status', 'type', 'area', 'priority', 'effort', 'depends_on', 'related', 'duplicate_of', 'classified', 'created', 'updated'];
const STATUS = ['open', 'done', 'dropped', 'duplicate'];
const TYPE = ['bug', 'feature', 'chore', 'question'];
const PRIORITY = ['P1', 'P2', 'P3'];
const EFFORT = [0.25, 0.5, 1, 2, 3, 5];
const CLASSIFIED = ['auto', 'user'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// The seed is fixed here, never derived from the README, so the first run is deterministic.
const SEED_AREAS = `shared: src/shared and src/config (contracts, io, validators, public record)
evidence: the store, corpus, batches, research verbs and reports
stories: story discovery and the evidence gate
script: the script stage, evidence package, lock
storyboard: the storyboard builder and chart geometry
video: Remotion scenes, kinds, bespoke graphics, narration, render, QA, music
packaging: the review package, manifest, captions, description
article: the companion article and its corrections
shorts: the nested Short productions
publishing: YouTube uploads, approvals, schedules, go-live, the ledger
brand: kits, seals, cards, stamps
website: pages, components, layouts, styles, content graph, SEO, CTA, review page
orchestration: the board, the runner, tick, work, pick, mail notifications, launch
topic-discovery: proposals and their review
social: X posts
mail: the mail module and its core
admin: the dev-only admin pages (board, live, review, register)
tests: test suites, fixtures, the boundary and web-quality gates
docs: OPERATIONS, COMMANDS, READMEs, briefs
tooling: npm scripts, CI, skills, the dev environment
other: nothing above fits
`;

class Refused extends Error {}
const refuse = (file, line, why) => { throw new Refused(`${file}${line ? `:${line}` : ''}: ${why}`); };

export function parseTodo(text, file) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') refuse(file, 1, 'frontmatter must start with ---');
  const end = lines.indexOf('---', 1);
  if (end < 0) refuse(file, 1, 'frontmatter has no closing ---');
  const todo = {};
  const seen = [];
  for (let i = 1; i < end; i++) {
    const m = /^([a-z_]+):\s?(.*)$/.exec(lines[i]);
    if (!m) refuse(file, i + 1, `not a key: value line`);
    const [, key] = m;
    let value = m[2].replace(/\s{2,}#.*$/, '').trim(); // a trailing comment after two spaces
    if (!KEYS.includes(key)) refuse(file, i + 1, `unknown key ${key}`);
    seen.push(key);
    const bad = (why) => refuse(file, i + 1, `${key}: ${why}`);
    switch (key) {
      case 'id': if (!/^\d+$/.test(value)) bad('must be an integer'); todo.id = Number(value); break;
      case 'title': if (!value) bad('empty'); todo.title = value.replace(/^"(.*)"$/, '$1'); break;
      case 'status': if (!STATUS.includes(value)) bad(`one of ${STATUS.join(', ')}`); todo.status = value; break;
      case 'type': if (!TYPE.includes(value)) bad(`one of ${TYPE.join(', ')}`); todo.type = value; break;
      case 'area': if (!/^[a-z][a-z0-9-]*$/.test(value)) bad('kebab-case name'); todo.area = value; break;
      case 'priority': if (!PRIORITY.includes(value)) bad(`one of ${PRIORITY.join(', ')}`); todo.priority = value; break;
      case 'effort': if (!EFFORT.includes(Number(value))) bad(`days, one of ${EFFORT.join(', ')}`); todo.effort = Number(value); break;
      case 'depends_on': case 'related': {
        const m2 = /^\[(.*)\]$/.exec(value);
        if (!m2) bad('an array like [1, 2]');
        const ids = m2[1].trim() ? m2[1].split(',').map((s) => s.trim()) : [];
        if (ids.some((s) => !/^\d+$/.test(s))) bad('ids only');
        todo[key] = ids.map(Number);
        break;
      }
      case 'duplicate_of': if (value !== 'null' && !/^\d+$/.test(value)) bad('an id or null'); todo.duplicate_of = value === 'null' ? null : Number(value); break;
      case 'classified': if (!CLASSIFIED.includes(value)) bad(`one of ${CLASSIFIED.join(', ')}`); todo.classified = value; break;
      case 'created': case 'updated': if (!DATE.test(value)) bad('YYYY-MM-DD'); todo[key] = value; break;
    }
  }
  if (seen.join() !== KEYS.join()) refuse(file, 2, `keys must be exactly, in order: ${KEYS.join(', ')} (got ${seen.join(', ')})`);
  if ((todo.status === 'duplicate') !== (todo.duplicate_of !== null)) refuse(file, 2, 'duplicate_of is set exactly when status is duplicate');
  const fromName = /^(\d{4})-/.exec(file);
  if (!fromName || Number(fromName[1]) !== todo.id) refuse(file, 2, `id ${todo.id} does not match the filename`);
  todo.file = file;
  return todo;
}

export function readAreas(dir) {
  const path = join(dir, 'areas.md');
  if (!existsSync(path)) writeFileSync(path, SEED_AREAS);
  return readFileSync(path, 'utf8').split(/\r?\n/).filter((l) => l.trim()).map((l) => {
    const m = /^([a-z][a-z0-9-]*):\s*(.*)$/.exec(l);
    if (!m) refuse('areas.md', null, `not a 'name: description' line: ${l}`);
    return { name: m[1], description: m[2] };
  });
}

export function load(dir) {
  mkdirSync(dir, { recursive: true });
  const areas = readAreas(dir);
  const files = readdirSync(dir).filter((f) => /^\d{4}-.*\.md$/.test(f)).sort();
  const todos = files.map((f) => parseTodo(readFileSync(join(dir, f), 'utf8'), f));
  const byId = new Map();
  for (const t of todos) {
    if (byId.has(t.id)) refuse(t.file, 2, `id ${t.id} is also ${byId.get(t.id).file}`);
    byId.set(t.id, t);
  }
  const names = new Set(areas.map((a) => a.name));
  const warnings = [];
  for (const t of todos) {
    if (!names.has(t.area)) refuse(t.file, 2, `area ${t.area} is not in areas.md`);
    for (const key of ['depends_on', 'related']) for (const id of t[key]) if (!byId.has(id)) refuse(t.file, 2, `${key} names ${id}, which does not exist`);
    if (t.duplicate_of !== null && !byId.has(t.duplicate_of)) refuse(t.file, 2, `duplicate_of names ${t.duplicate_of}, which does not exist`);
    if (t.status === 'open') for (const id of t.depends_on) {
      const d = byId.get(id);
      if (d.status === 'dropped') warnings.push(`${t.file} depends on ${id}, which is dropped`);
      if (d.status === 'duplicate') warnings.push(`${t.file} depends on ${id}, a duplicate of ${d.duplicate_of}: point at that instead`);
    }
  }
  const ids = todos.map((t) => t.id);
  for (let i = 1; i < ids.length; i++) if (ids[i] !== ids[i - 1] + 1) warnings.push(`id gap between ${ids[i - 1]} and ${ids[i]} (a hand deletion?)`);
  // a dependency cycle among any todos is refused
  const state = new Map();
  const visit = (t, path) => {
    if (state.get(t.id) === 2) return;
    if (state.get(t.id) === 1) refuse(t.file, 2, `dependency cycle: ${[...path, t.id].join(' -> ')}`);
    state.set(t.id, 1);
    for (const id of t.depends_on) visit(byId.get(id), [...path, t.id]);
    state.set(t.id, 2);
  };
  for (const t of todos) visit(t, []);
  return { areas, todos, warnings };
}

export function order(todos) {
  const open = todos.filter((t) => t.status === 'open');
  const openIds = new Set(open.map((t) => t.id));
  const rank = (t) => [PRIORITY.indexOf(t.priority), t.effort, t.area, t.id];
  const cmp = (a, b) => { const ra = rank(a), rb = rank(b); for (let i = 0; i < 4; i++) if (ra[i] !== rb[i]) return ra[i] < rb[i] ? -1 : 1; return 0; };
  // Kahn's algorithm over open dependencies, always taking the best-ranked ready item: dependencies first, then
  // priority, effort, area, id. ponytail: O(n^2) pick, fine for a personal list.
  const out = [];
  const done = new Set();
  const ready = () => open.filter((t) => !done.has(t.id) && t.depends_on.every((id) => !openIds.has(id) || done.has(id))).sort(cmp);
  for (let r = ready(); r.length; r = ready()) { out.push(r[0]); done.add(r[0].id); }
  return out;
}

const pad = (n) => String(n).padStart(4, '0');
const link = (t) => `[${pad(t.id)}](./${t.file})`;
const row = (cells) => `| ${cells.join(' | ')} |`;

export function render({ areas, todos, warnings }) {
  const ordered = order(todos);
  const closed = todos.filter((t) => t.status !== 'open').sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : b.id - a.id));
  const openCount = (name) => ordered.filter((t) => t.area === name).length;
  const lines = ['# Todo index', '', 'Derived by `node .claude/skills/log-todo/index.mjs`; never hand-edited. Edit the todo files and rerun.', ''];
  if (warnings.length) lines.push('## Warnings', '', ...warnings.map((w) => `- ${w}`), '');
  lines.push('## Proposed order', '');
  if (ordered.length) {
    lines.push(row(['#', 'id', 'title', 'area', 'type', 'priority', 'effort', 'depends on', 'classified']), row(Array(9).fill('---')));
    ordered.forEach((t, i) => lines.push(row([i + 1, link(t), t.title.replace(/\|/g, '\\|'), t.area, t.type, t.priority, t.effort, t.depends_on.map(pad).join(', ') || '', t.classified])));
  } else lines.push('Nothing open.');
  lines.push('', '## Areas', '', row(['area', 'open', 'description']), row(['---', '---', '---']));
  for (const a of areas) lines.push(row([a.name, openCount(a.name) || '(none)', a.description]));
  if (closed.length) {
    lines.push('', '## Done, dropped and duplicate', '', row(['id', 'title', 'status', 'updated']), row(Array(4).fill('---')));
    for (const t of closed) lines.push(row([link(t), t.title.replace(/\|/g, '\\|'), t.status === 'duplicate' ? `duplicate of ${pad(t.duplicate_of)}` : t.status, t.updated]));
  }
  const by = (p) => ordered.filter((t) => t.priority === p).length;
  const days = ordered.reduce((s, t) => s + t.effort, 0);
  lines.push('', `${ordered.length} open: ${PRIORITY.map((p) => `${by(p)} ${p}`).join(', ')}; ${days} days of open effort. ${closed.length} closed.`, '');
  return lines.join('\n');
}

export function run(dir, { json = false } = {}) {
  const loaded = load(dir);
  if (json) return JSON.stringify({ areas: loaded.areas, todos: loaded.todos, warnings: loaded.warnings }, null, 2);
  writeFileSync(join(dir, 'INDEX.md'), render(loaded));
  return loaded.warnings.map((w) => `warning: ${w}`).join('\n');
}

function selfTest() {
  const dir = join(tmpdir(), `log-todo-test-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);
  const fm = (o) => `---\n${KEYS.map((k) => `${k}: ${Array.isArray(o[k]) ? `[${o[k].join(', ')}]` : o[k]}`).join('\n')}\n---\n\n## What\n\nx\n`;
  const base = { status: 'open', type: 'bug', area: 'video', priority: 'P2', effort: 1, depends_on: [], related: [], duplicate_of: 'null', classified: 'auto', created: '2026-11-06', updated: '2026-11-06' };
  const write = (id, slug, o) => writeFileSync(join(dir, `${pad(id)}-${slug}.md`), fm({ ...base, id, title: slug, ...o }));
  write(1, 'render-hang', { priority: 'P1', effort: 2 });
  write(2, 'board-filter', { area: 'admin', depends_on: [1], priority: 'P1', effort: 0.5 });
  write(3, 'old-dup', { status: 'duplicate', duplicate_of: 1, updated: '2026-11-05' });
  write(4, 'cheap-first', { priority: 'P1', effort: 0.5, area: 'website' });
  const first = run(dir);
  assert.equal(first, '');
  const index = readFileSync(join(dir, 'INDEX.md'), 'utf8');
  // dependencies first (0001 before 0002 though 0002 is cheaper); 0004 is cheaper than 0001 and not blocked, so it leads
  const ids = [...index.matchAll(/^\| \d+ \| \[(\d{4})\]/gm)].map((m) => m[1]);
  assert.deepEqual(ids, ['0004', '0001', '0002']);
  assert.match(index, /duplicate of 0001/);
  assert.match(index, /\| video \| 1 \|/);
  assert.match(index, /3 open: 3 P1, 0 P2, 0 P3; 3 days of open effort\. 1 closed\./);
  run(dir);
  assert.equal(readFileSync(join(dir, 'INDEX.md'), 'utf8'), index, 'rerun is byte-identical');
  assert.ok(JSON.parse(run(dir, { json: true })).todos.length === 4);
  // warnings: gap, dropped dependency
  write(5, 'dropped', { status: 'dropped' });
  write(7, 'gap', { depends_on: [5] });
  assert.match(run(dir), /id gap between 5 and 7/);
  assert.match(run(dir), /0007-gap.md depends on 5, which is dropped/);
  // refusals
  const refused = (id, slug, o, re) => { write(id, slug, o); assert.throws(() => run(dir), re); rmSync(join(dir, `${pad(id)}-${slug}.md`)); };
  refused(8, 'cycle-a', { depends_on: [9] }, /0008-cycle-a.md:2: depends_on names 9/);
  write(9, 'cycle-b', { depends_on: [8] });
  refused(8, 'cycle-a', { depends_on: [9] }, /dependency cycle: 8 -> 9 -> 8/);
  rmSync(join(dir, '0009-cycle-b.md'));
  refused(8, 'bad-area', { area: 'nope' }, /area nope is not in areas.md/);
  refused(8, 'twice', { id: 7 }, /id 7 does not match the filename/);
  writeFileSync(join(dir, '0008-key.md'), fm({ ...base, id: 8, title: 'k' }).replace('type: bug', 'kind: bug'));
  assert.throws(() => run(dir), /0008-key.md:5: unknown key kind/);
  writeFileSync(join(dir, '0008-key.md'), fm({ ...base, id: 8, title: 'k', effort: 4 }));
  assert.throws(() => run(dir), /effort: days, one of/);
  rmSync(dir, { recursive: true, force: true });
  console.log('self-test ok');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes('--self-test')) selfTest();
    else {
      const out = run(join(REPO, 'todo'), { json: process.argv.includes('--json') });
      if (out) console.log(out);
    }
  } catch (e) {
    if (e instanceof Refused || e.code === 'ERR_ASSERTION') { console.error(e.message); process.exit(1); }
    throw e;
  }
}
