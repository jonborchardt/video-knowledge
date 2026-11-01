// The weekly digest (spec §11): what went live, what is in production, what is blocked and the unblock, what waits on
// the person, what was parked and why, the outbox's unsent mail, the queue quantities of §5.4 and the week's spend.
// Rendered from the status rows and what later phases hand in through DigestExtra; sent once per configured slot.
import type { Automation } from '../../shared/automation';
import { ROOT } from '../../shared/io';
import type { MailTransport, OutMail } from '../../shared/mail';
import { type OutboxEntry, secretsOf, sendTracked, unsentOutbox } from './notify';
import { redact } from '../../shared/mail';
import { lastSlot, readSchedule, updateSchedule } from './schedule';
import type { StatusRow } from './status';

export interface DigestExtra {
  liveThisWeek?: { topic: string; storyId: string; url: string }[];
  awaiting?: { request: string; story: string; ageHours: number }[]; // open approval requests (phase 2, 3)
  proposals?: { pending: string[]; parked: { slug: string; why: string }[] }; // phase 4
  parked?: { what: string; why: string }[]; // topics and stories (phase 5)
  studio?: { story: string; step: string; record: string }[]; // outstanding optional Studio steps (phase 3)
  shadow?: ShadowCriteria; // draft-review shadow verdicts against the enabling criteria (spec §5.5)
  unsent?: OutboxEntry[];
  queue?: { readyStories: number; approvedTopics: number; awaitingApproval: number };
  spend?: { weekUsd: number; perWeekUsd: number };
  secrets?: string[]; // what a body must never carry; the environment's secret families by default
}

const section = (title: string, lines: string[]): string[] => (lines.length ? ['', `## ${title}`, ...lines] : []);

/** The shadow record's agreement figures (release.ts shadowAgreement). */
export interface ShadowCriteria {
  drafts: number;
  agreed: number;
  streak: number;
  notesAgreed: number;
  notesDisagreed: number;
  acceptedThenSentBack: number;
}
export const SHADOW_STREAK = 6; // spec §5.5: six consecutive drafts agreed, no disagree mark, no accepted draft sent back
/** One sentence a person reads before flipping `review.draft` to `agent` (register D7), and what is still short. */
export function shadowSentence(s: ShadowCriteria): string {
  const recent = Math.min(s.drafts, SHADOW_STREAK);
  const head = `${s.streak >= SHADOW_STREAK ? SHADOW_STREAK : Math.min(s.streak, recent)} of the last ${recent} draft${recent === 1 ? '' : 's'} agreed`;
  if (s.streak >= SHADOW_STREAK && s.acceptedThenSentBack === 0)
    return `${head}, no note marked disagree, no agent-accepted draft sent back at release: \`review.draft: agent\` may be enabled (set it in automation.json; \`shadow\` restores this review).`;
  const short = [
    s.streak < SHADOW_STREAK &&
      `${SHADOW_STREAK - s.streak} more agreeing draft${SHADOW_STREAK - s.streak === 1 ? '' : 's'} in a row`,
    s.notesDisagreed > 0 && `${s.notesDisagreed} note${s.notesDisagreed === 1 ? '' : 's'} marked disagree`,
    s.acceptedThenSentBack > 0 &&
      `${s.acceptedThenSentBack} agent-accepted draft${s.acceptedThenSentBack === 1 ? '' : 's'} sent back at release`,
  ].filter(Boolean);
  return `${head} (${s.agreed} of ${s.drafts} overall); not yet: ${short.join(', ')}. \`review.draft\` stays as it is.`;
}
const h = (n: number) => (n === 1 ? '1 hour' : `${Math.round(n)} hours`);

export function renderDigest(rows: StatusRow[], extra: DigestExtra, a: Automation): Omit<OutMail, 'messageId'> {
  const running = rows.filter((r) => r.state === 'running');
  const blocked = rows.filter((r) => r.halt);
  const clean = (t: string) => redact(t, extra.secrets ?? secretsOf());
  const lines = [
    'The week at the Commonwealth of Reason.',
    ...section(
      'Live this week',
      (extra.liveThisWeek ?? []).map((x) => `- ${x.topic} / ${x.storyId}: ${x.url}`),
    ),
    ...section(
      'In production',
      running.map((r) => `- ${r.topic} / ${r.storyId}: ${r.step ?? 'running'} since ${r.since ?? '?'}`),
    ),
    ...section(
      'Blocked',
      blocked.flatMap((r) => [
        `- ${r.topic} / ${r.storyId}: ${r.halt!.kind} at ${r.halt!.stage} since ${r.halt!.at}: ${clean(r.halt!.why)}`,
        `  Unblock: ${clean(r.halt!.unblock.text)}`,
      ]),
    ),
    ...section(
      'Awaiting you',
      (extra.awaiting ?? []).map((x) => `- ${x.story}: request ${x.request}, open ${h(x.ageHours)}`),
    ),
    ...section(
      'Proposals pending',
      (extra.proposals?.pending ?? []).map((s) => `- ${s}`),
    ),
    ...section('Parked', [
      ...(extra.proposals?.parked ?? []).map((p) => `- proposal ${p.slug}: ${p.why}`),
      ...(extra.parked ?? []).map((p) => `- ${p.what}: ${p.why}`),
    ]),
    ...section(
      'Optional Studio steps outstanding',
      (extra.studio ?? []).map((s) => `- ${s.story}: ${s.step} (record it with: ${s.record})`),
    ),
    ...(extra.shadow ? ['', `## Draft review shadow`, shadowSentence(extra.shadow)] : []),
    ...section(
      'Mail that could not be sent',
      (extra.unsent ?? []).map((e) => `- ${e.kind} "${e.subject}" to ${e.to} (${e.attempts} attempts)`),
    ),
    ...(extra.queue
      ? [
          '',
          '## Queue',
          `Ready stories: ${extra.queue.readyStories}. Approved topics awaiting research: ${extra.queue.approvedTopics}. Releases awaiting approval: ${extra.queue.awaitingApproval} (cap ${a.production.maxAwaitingApproval}).`,
          `Cadence: ${a.production.storiesPerWeek} a week, ${a.production.perInstitutionPerWeek} per institution; ${a.runs.maxConcurrentStoryRuns} in production at once.`,
        ]
      : []),
    ...(extra.spend
      ? ['', '## Spend', `${extra.spend.weekUsd.toFixed(2)} USD of ${extra.spend.perWeekUsd.toFixed(0)} USD this week.`]
      : []),
    '',
  ];
  return {
    from: a.approvals.from || a.notifications.to,
    to: a.notifications.to,
    subject: `[CoR] weekly digest: ${running.length} in production, ${blocked.length} blocked, ${(extra.awaiting ?? []).length} awaiting you`,
    text: lines.join('\n'),
  };
}

/** Once per configured slot (weekday and hour in the configured timezone): the slot's id is recorded in schedule.json. */
export async function sendDigestIfDue(
  a: Automation,
  mail: MailTransport,
  now: () => number,
  root = ROOT,
  rows: StatusRow[],
  extra: DigestExtra = {},
): Promise<string | null> {
  const slot = lastSlot(now(), a.notifications.digest.weekday, a.notifications.digest.hour, a.schedule.timezone);
  if (readSchedule(root).digest?.lastSlot === slot) return null;
  await sendTracked(
    mail,
    renderDigest(rows, { ...extra, unsent: extra.unsent ?? unsentOutbox(root) }, a),
    'digest',
    root,
    { now },
  );
  updateSchedule(root, (s) => ({ ...s, digest: { lastSlot: slot } }));
  return slot;
}
