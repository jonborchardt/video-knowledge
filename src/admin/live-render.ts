// The live markup of the admin page (M3 2.2, 2.3): one renderer for the server (Automation.astro, Board.astro, set:html)
// and the browser (live-client.ts patches with the same functions), so a row inserted by a poll looks like a row the
// page rendered. Plain strings, every value escaped; no handlers (the Copy buttons ride on NextStep's document
// listener). Costs are labelled: reported (what the CLI returned), estimated (history, with n) or limit (configuration).
import type { Activity, LiveJobs, LiveRow, LiveView, OwnerItem, ReadinessRow } from '../orchestration';

export const esc = (s: unknown): string =>
  String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export function fmtElapsed(ms: number | null): string {
  if (ms === null) return '';
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60} s`;
  const h = Math.floor(m / 60);
  return `${h} h ${String(m % 60).padStart(2, '0')} min`;
}
const usd = (x: number) => `${x.toFixed(2)} USD`;
const small = 'text-xs text-muted-foreground';
const copyBlock = (text: string) =>
  `<span class="flex items-start gap-2"><pre class="text-xs whitespace-pre-wrap">${esc(text)}</pre><button type="button" class="rounded border px-2 text-xs" data-copy>Copy</button></span>`;

const ACTOR: Record<NonNullable<LiveRow['stepKind']>, string> = {
  agent: 'agent',
  cli: 'code',
  person: 'person',
  service: 'service',
};
const stateLabel = (r: LiveRow) =>
  r.state === 'between-steps' ? 'between steps' : r.state === 'done' ? 'done' : r.state;

/** The estimate line of an agent step: the history's median with its sample size, or why there is none. */
export function estimateText(r: LiveRow): string {
  if (r.stepKind !== 'agent') return '';
  return r.estimate
    ? `~ ${usd(r.estimate.medianUsd)} (estimated: median of n=${r.estimate.n}, p75 ${usd(r.estimate.p75Usd)}, ~${fmtElapsed(r.estimate.medianMs)})`
    : 'no estimate (insufficient history for this role and model)';
}

/** The Board's Now cell: who acts, on what, for how long, at what cost. */
export function nowCellHtml(r: LiveRow): string {
  const parts: string[] = [];
  const stateClass =
    r.state === 'running'
      ? 'text-warning'
      : r.state === 'halted'
        ? 'text-destructive'
        : r.state === 'between-steps'
          ? 'text-warning'
          : 'text-muted-foreground';
  parts.push(`<span class="font-medium ${stateClass}" data-f="state">${esc(stateLabel(r))}</span>`);
  if (r.state === 'running' && r.step) {
    const actor = r.stepKind ? ACTOR[r.stepKind] : '';
    const who = r.stepKind === 'agent' ? `${esc(r.role ?? 'agent')} on ${esc(r.model ?? 'unknown model')}` : esc(actor);
    parts.push(`<span class="${small}" data-f="actor">${who}</span>`);
    parts.push(`<span class="line-clamp-2 text-xs" data-f="step" title="${esc(r.step)}">${esc(r.step)}</span>`);
    if (r.agents.length > 1)
      parts.push(
        `<ul class="${small}" data-f="agents">${r.agents.map((a) => `<li>${esc(a.role)} on ${esc(a.model ?? '?')}: ${esc(a.step)}</li>`).join('')}</ul>`,
      );
  }
  if (r.state === 'halted' && r.halt)
    parts.push(
      `<span class="line-clamp-2 text-xs" data-f="step" title="${esc(r.halt.why)}">${esc(r.halt.kind)}: ${esc(r.halt.why)}</span>`,
    );
  if (r.elapsedMs !== null && (r.state === 'running' || r.state === 'between-steps'))
    parts.push(
      `<span class="${small}" data-f="elapsed">${esc(fmtElapsed(r.elapsedMs))}${r.state === 'between-steps' ? ' since the last step' : ''}</span>`,
    );
  parts.push(
    `<span class="${small} font-mono tabular-nums" data-f="cost">run ${esc(usd(r.costUsd.run))} · total ${esc(usd(r.costUsd.total))} (reported)</span>`,
  );
  if (r.stepKind === 'agent') parts.push(`<span class="${small}" data-f="estimate">${esc(estimateText(r))}</span>`);
  if (r.staleHeartbeat) parts.push(`<span class="text-xs text-destructive" data-f="stale">heartbeat stale</span>`);
  return `<div class="grid w-56 gap-0.5">${parts.join('')}</div>`;
}

export function runningRowHtml(r: LiveRow, budget: LiveView['budget']): string {
  const who =
    r.stepKind === 'agent'
      ? `${esc(r.role ?? '')} on ${esc(r.model ?? '?')}`
      : esc(r.stepKind ? ACTOR[r.stepKind] : '');
  const agents =
    r.agents.length > 1
      ? `<ul class="${small}">${r.agents.map((a) => `<li>${esc(a.role)} on ${esc(a.model ?? '?')}: ${esc(a.step)}</li>`).join('')}</ul>`
      : '';
  return (
    `<td class="py-1 pr-3">${esc(r.topic)} / ${esc(r.storyId)}<span class="${small}"> (${esc(r.kind)})</span></td>` +
    `<td class="py-1 pr-3">${esc(stateLabel(r))}${r.step ? `<span class="${small}"> ${esc(r.step)}</span>` : ''}${agents}</td>` +
    `<td class="py-1 pr-3">${who}</td>` +
    `<td class="py-1 pr-3 font-mono tabular-nums">${esc(fmtElapsed(r.elapsedMs))}</td>` +
    `<td class="py-1 pr-3 font-mono tabular-nums" title="reported by the CLI">${esc(usd(r.costUsd.run))}</td>` +
    `<td class="py-1 pr-3 ${small}">${esc(estimateText(r))}</td>` +
    `<td class="py-1 ${small}" title="the cap asked of the CLI per agent (a limit, not a ceiling: an overshoot is recorded)">${esc(usd(budget.perAgent))} per agent (limit)</td>`
  );
}

export function blockedItemHtml(r: LiveRow): string {
  const h = r.halt!;
  const retry = h.retryable
    ? `retryable: ${h.retries} retr${h.retries === 1 ? 'y' : 'ies'} so far${h.nextRetryAt ? `, next at ${esc(h.nextRetryAt)}` : ', retries spent'}`
    : 'a person decides';
  return (
    `<div class="grid gap-1"><span>${esc(r.topic)} / ${esc(r.storyId)}: <span class="font-medium text-destructive">${esc(h.kind)}</span> since ${esc(h.at)}</span>` +
    `<span class="text-sm">${esc(h.why)}</span><span class="${small}">${retry}; logs under ${esc(r.kind === 'research' || r.kind === 'scan' ? `topics/${r.topic}/work/run/` : `topics/${r.topic}/scripts/<slug>/run/`)}</span>` +
    copyBlock(h.unblock) +
    `</div>`
  );
}

export function ownerItemHtml(o: OwnerItem): string {
  const where = [
    o.url ? `<a class="text-primary" href="${esc(o.url)}">review page</a>` : '',
    o.reply ? `reply <code>${esc(o.reply)}</code> to its mail` : '',
  ]
    .filter(Boolean)
    .join(' or ');
  return (
    `<div class="grid gap-1"><span><span class="font-medium">${esc(o.kind)}</span> ${esc(o.topic)}${o.storyId ? ` / ${esc(o.storyId)}` : ''}: ${esc(o.what)}</span>` +
    (where ? `<span class="${small}">Decide: ${where}</span>` : '') +
    copyBlock(o.command) +
    `</div>`
  );
}

export function activityItemHtml(e: Activity): string {
  const colour =
    e.actor === 'agent'
      ? 'text-warning'
      : e.actor === 'person'
        ? 'text-primary'
        : e.actor === 'service'
          ? 'text-success'
          : 'text-muted-foreground';
  return `<span class="font-mono text-xs text-muted-foreground">${esc(e.at.slice(0, 19).replace('T', ' '))}</span> <span class="text-xs font-medium ${colour}">${esc(e.actor)}</span> <span class="${small}">${esc(e.topic)}${e.storyId ? ` / ${esc(e.storyId)}` : ''}</span> <span class="text-sm">${esc(e.what)}</span>`;
}
export const activityKey = (e: Activity) => `${e.at}|${e.topic}|${e.storyId ?? ''}|${e.what}`;

export function jobsHtml(j: LiveJobs): string {
  const lines: string[] = [];
  lines.push(
    j.queued
      ? `Next job the work plane would start: ${esc(j.queued.kind)}${j.queued.topic ? ` ${esc(j.queued.topic)}${j.queued.storyId ? ` / ${esc(j.queued.storyId)}` : ''}` : ''} (${esc(j.queued.why)})`
      : 'Nothing queued for the work plane.',
  );
  if (j.due.length)
    lines.push(`Due to resume: ${j.due.map((d) => `${esc(d.topic)} / ${esc(d.storyId)} (${esc(d.why)})`).join(', ')}.`);
  if (j.scheduled.length)
    lines.push(
      `Scheduled publications: ${j.scheduled.map((s) => `${esc(s.topic)} / ${esc(s.storyId)} ${esc(s.output)} at ${esc(s.publishAt)}`).join('; ')}.`,
    );
  if (j.stuck.length)
    lines.push(
      `<span class="text-destructive">Stuck (halted, not retryable, past runs.stuckAfterMinutes): ${j.stuck.map((s) => `${esc(s.key)} since ${esc(s.since)} (${esc(s.why)})`).join('; ')}.</span>`,
    );
  return lines.map((l) => `<p class="mt-1 text-sm">${l}</p>`).join('');
}

export function readinessRowHtml(r: ReadinessRow): string {
  const yes = (b: boolean | null) => (b === null ? 'n/a' : b ? 'yes' : 'no');
  return (
    `<td class="py-1 pr-3">${esc(r.name)}<span class="${small}"> (${esc(r.key)})</span></td>` +
    `<td class="py-1 pr-3">${yes(r.implemented)}</td>` +
    `<td class="py-1 pr-3">${r.verified ? `${esc(r.verified.at.slice(0, 10))} by ${esc(r.verified.by)}<span class="${small}"> (${esc(r.verified.evidence)})</span>` : 'not verified'}</td>` +
    `<td class="py-1 pr-3">${yes(r.enabled)}${r.enabledBy ? `<span class="${small}"> (${esc(r.enabledBy)})</span>` : `<span class="${small}"> (a person's act)</span>`}</td>`
  );
}

export function weekHtml(v: LiveView): string {
  const w = v.week;
  const gap =
    Math.abs(w.gapUsd) < 0.005
      ? 'budget.json agrees'
      : `budget.json ${usd(w.budgetUsd)}: ${usd(Math.abs(w.gapUsd))} ${w.gapUsd > 0 ? 'not in any attempt record (a lost line)' : 'more in the records than the gate counted'}`;
  const notes = [
    w.unparsed
      ? `${w.unparsed} attempt${w.unparsed === 1 ? '' : 's'} ended with no parseable result (cost unknown)`
      : '',
    w.unknownModel ? `${w.unknownModel} of unknown model (before M3)` : '',
    w.mixedModel ? `${w.mixedModel} used several models` : '',
    w.overCap ? `${w.overCap} overshot the per-agent cap` : '',
  ].filter(Boolean);
  return `This week (${esc(w.week)}): ${esc(usd(w.rolledUpUsd))} reported over ${w.attempts} attempt${w.attempts === 1 ? '' : 's'} of ${esc(usd(v.budget.perWeek))} (limit); ${esc(gap)}${notes.length ? `; ${esc(notes.join('; '))}` : ''}.`;
}
