// The admin page's live updates (M3 2.2): poll /admin/live.json (dev server only), compute the operations that bring
// the markup from the last view to the new one (applyLive, pure), and apply them in place (applyOps): a cell's html,
// a row's attribute, a stage strip's current cell, a keyed list reconciled by data-key. Tables are never replaced, so
// scroll position, open popovers, the filter, the sort and a selected row survive every refresh. Nothing is invented:
// what the lock and the journal do not say stays blank.
import type { LiveRow, LiveView } from '../orchestration';
import {
  activityItemHtml,
  activityKey,
  blockedItemHtml,
  jobsHtml,
  nowCellHtml,
  ownerItemHtml,
  readinessRowHtml,
  runningRowHtml,
  weekHtml,
} from './live-render';

export type Op =
  | { op: 'html'; sel: string; html: string }
  | { op: 'attr'; row: string; attr: string; value: string | null }
  | { op: 'strip'; row: string; stage: string | null; stopped: boolean; done: boolean }
  | { op: 'list'; list: string; keys: string[]; html: Record<string, string> };

export interface ApplyOpts {
  stages: string[];
  labels: Record<string, string>;
}

const DONE_COLUMNS = new Set(['uploaded', 'approved', 'scheduled', 'published']);
const sameRow = (a: LiveRow | undefined, b: LiveRow, keys: (keyof LiveRow)[]) =>
  !!a && keys.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
const NOW_KEYS: (keyof LiveRow)[] = [
  'state',
  'step',
  'stepKind',
  'role',
  'model',
  'elapsedMs',
  'costUsd',
  'estimate',
  'agents',
  'halt',
  'staleHeartbeat',
];

/** A keyed list: the new order, and html only for items that are new or changed. */
function listOp<T>(
  list: string,
  prev: T[] | undefined,
  next: T[],
  keyOf: (x: T) => string,
  html: (x: T) => string,
): Op | null {
  const before = new Map((prev ?? []).map((x) => [keyOf(x), html(x)]));
  const keys = next.map(keyOf);
  const out: Record<string, string> = {};
  for (const x of next) {
    const h = html(x);
    if (before.get(keyOf(x)) !== h) out[keyOf(x)] = h;
  }
  const sameOrder =
    prev !== undefined && keys.length === before.size && keys.every((k, i) => [...before.keys()][i] === k);
  if (sameOrder && !Object.keys(out).length) return null;
  return { op: 'list', list, keys, html: out };
}

export function applyLive(prev: LiveView | null, next: LiveView, o: ApplyOpts): Op[] {
  const ops: Op[] = [];
  const before = new Map((prev?.rows ?? []).map((r) => [r.key, r]));
  for (const r of next.rows) {
    const p = before.get(r.key);
    if (!sameRow(p, r, NOW_KEYS)) ops.push({ op: 'html', sel: `${r.key}.now`, html: nowCellHtml(r) });
    if (!p || p.column !== r.column) {
      ops.push({ op: 'attr', row: r.key, attr: 'data-state', value: r.column });
      ops.push({ op: 'html', sel: `${r.key}.column`, html: r.column ? (o.labels[r.column] ?? r.column) : '' });
    }
    // the strip's red is the board's own `stopped` (stoppedOf), never the runner's halt
    const done = !!r.column && DONE_COLUMNS.has(r.column);
    if (!p || p.stage !== r.stage || p.column !== r.column || p.stopped !== r.stopped)
      ops.push({ op: 'strip', row: r.key, stage: r.stage, stopped: r.stopped, done });
  }
  const running = (v: LiveView) => v.rows.filter((r) => r.state === 'running' || r.state === 'between-steps');
  const blocked = (v: LiveView) => v.rows.filter((r) => r.state === 'halted' && r.halt);
  const push = (op: Op | null) => op && ops.push(op);
  push(listOp('owner', prev?.owner, next.owner, (x) => x.key, ownerItemHtml));
  push(
    listOp(
      'running',
      prev ? running(prev) : undefined,
      running(next),
      (x) => x.key,
      (x) => runningRowHtml(x, next.budget),
    ),
  );
  push(listOp('blocked', prev ? blocked(prev) : undefined, blocked(next), (x) => x.key, blockedItemHtml));
  push(listOp('activity', prev?.activity, next.activity, activityKey, activityItemHtml));
  push(listOp('readiness', prev?.readiness, next.readiness, (x) => x.key, readinessRowHtml));
  const jobs = jobsHtml(next.jobs);
  if (!prev || jobsHtml(prev.jobs) !== jobs) ops.push({ op: 'html', sel: 'jobs', html: jobs });
  const week = weekHtml(next);
  if (!prev || weekHtml(prev) !== week) ops.push({ op: 'html', sel: 'week', html: week });
  if (!prev || prev.generatedAt !== next.generatedAt)
    ops.push({ op: 'html', sel: 'generatedAt', html: next.generatedAt });
  return ops;
}

/** 5 s while anything runs or sits between steps, else 30 s. */
export const pollDelay = (v: LiveView): number =>
  v.rows.some((r) => r.state === 'running' || r.state === 'between-steps') ? 5000 : 30_000;

// ---------------------------------------------------------------------------------------------------------- the DOM
const EMPTY_TAG: Record<string, string> = {
  running: 'tr',
  readiness: 'tr',
  owner: 'li',
  blocked: 'li',
  activity: 'li',
};

function byLive(root: ParentNode, sel: string): Element | null {
  for (const el of root.querySelectorAll<HTMLElement>('[data-live]')) if (el.dataset.live === sel) return el;
  return null;
}
function rowOf(root: ParentNode, key: string): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>('[data-live-row]')) if (el.dataset.liveRow === key) return el;
  return null;
}
function listOf(root: ParentNode, list: string): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>('[data-live-list]')) if (el.dataset.liveList === list) return el;
  return null;
}

export function applyOps(ops: Op[], root: ParentNode = document): void {
  for (const op of ops) {
    if (op.op === 'html') {
      const el = byLive(root, op.sel);
      // eslint-disable-next-line no-restricted-syntax -- the renderer escapes every value (live-render.ts)
      if (el) el.innerHTML = op.html;
    } else if (op.op === 'attr') {
      const row = rowOf(root, op.row);
      if (!row) continue;
      if (op.value === null) row.removeAttribute(op.attr);
      else row.setAttribute(op.attr, op.value);
    } else if (op.op === 'strip') {
      const strip = byLive(root, `${op.row}.strip`);
      if (!strip) continue;
      const stages = (strip.getAttribute('data-stages') ?? '').split(',');
      const at = op.done ? stages.length : op.stage ? stages.indexOf(op.stage) : -1;
      strip.querySelectorAll<HTMLElement>('li').forEach((li, i) => {
        const state = i < at ? 'done' : i === at ? 'current' : 'todo';
        li.classList.remove('bg-success', 'bg-warning', 'bg-destructive', 'bg-border');
        li.classList.add(
          state === 'done'
            ? 'bg-success'
            : state === 'current'
              ? op.stopped
                ? 'bg-destructive'
                : 'bg-warning'
              : 'bg-border',
        );
        li.title = `${stages[i]}: ${state}`;
      });
    } else {
      const list = listOf(root, op.list);
      if (!list) continue;
      const tag = EMPTY_TAG[op.list] ?? 'li';
      const current = new Map<string, HTMLElement>();
      for (const child of [...list.children] as HTMLElement[]) {
        const k = child.dataset.key;
        if (k === undefined)
          child.remove(); // the server's "none" placeholder
        else if (!op.keys.includes(k)) child.remove();
        else current.set(k, child);
      }
      let cursor: HTMLElement | null = null;
      for (const k of op.keys) {
        let el = current.get(k);
        if (!el) {
          el = document.createElement(tag);
          el.dataset.key = k;
          if (tag === 'tr') el.className = 'border-t align-top';
        }
        // eslint-disable-next-line no-restricted-syntax -- the renderer escapes every value (live-render.ts)
        if (op.html[k] !== undefined) el.innerHTML = op.html[k];
        if (cursor ? cursor.nextElementSibling !== el : list.firstElementChild !== el) {
          if (cursor) cursor.after(el);
          else list.prepend(el);
        }
        cursor = el;
      }
      if (!op.keys.length && list.dataset.empty) {
        const el = document.createElement(tag);
        if (tag === 'tr') {
          const td = document.createElement('td');
          td.colSpan = Number(list.dataset.emptyCols ?? 1);
          td.className = 'py-2 text-sm text-muted-foreground';
          td.textContent = list.dataset.empty;
          el.append(td);
        } else {
          el.className = 'text-sm text-muted-foreground';
          el.textContent = list.dataset.empty;
        }
        list.append(el);
      }
    }
  }
}

/** Starts the poll on the admin page: 5 s while something runs, 30 s otherwise, paused while the page is hidden. */
export function startLive(url: string, o: ApplyOpts, root: ParentNode = document): { stop: () => void } {
  let prev: LiveView | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  const tick = async () => {
    timer = null;
    if (stopped || document.hidden) return;
    let delay = 30_000;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const next = (await res.json()) as LiveView;
        applyOps(applyLive(prev, next, o), root);
        prev = next;
        delay = pollDelay(next);
        document.documentElement.dataset.liveAt = next.generatedAt;
      }
    } catch {
      /* the dev server is restarting: try again on the slow cadence */
    }
    if (!stopped) timer = setTimeout(tick, delay);
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !timer && !stopped) void tick();
  });
  void tick();
  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
