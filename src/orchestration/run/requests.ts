// The request mails (spec §7.2, §7.3): the draft request (watch the private upload, accept or send back) and the
// release request (the whole publication the manifest binds, in plain language, with the reply lines). Composed
// here from the package files through shared io, never from the website's review view; sent through the outbox
// (notify.ts) once per request id; the sent Message-ID goes to the ledger through `publish message-sent`.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Automation } from '../../shared/automation';
import type { BuildSummary } from '../../shared/build-report';
import { runCli } from '../../shared/cli';
import { REVIEW_DIR, ROOT, readJson, scriptDir, writeJsonAtomic } from '../../shared/io';
import { runDir } from './journal';
import type { MailTransport, OutMail } from '../../shared/mail';
import { redact } from '../../shared/mail';
import type { ReleaseManifest } from '../../shared/types';
import { type ApprovalRequest, loadLedger, openRequest, stampOf } from '../../modules/publishing';
import { readOutbox, secretsOf, sendTracked } from './notify';
import type { ReleaseGroup, ShadowEntry } from './release';
import { envFor } from './steps';

export const DRAFT_REQUEST_FILE = 'run/draft-request.json';

export interface DraftView {
  url: string;
  title: string;
  checklist: string[];
  findings: string[]; // "[m:ss sc3 s7] what", QA first
  shadowNotes?: { n: number; text: string; seconds?: number; scene?: string; sentence?: string }[];
}

interface TimelineLite {
  fps: number;
  scenes: { id: string; start: number; sentences: { id: string; start: number }[] }[];
}
interface ReviewLite {
  title: string;
  checklist?: string[];
}
interface ValidationLite {
  issues?: { sentence?: string; category: string; explanation: string; severity: string; disposition?: string }[];
}

/** What the draft mail says to look at: the checklist, the QA checks that failed and the script's open warnings,
 *  each at its moment in the video. */
export function draftView(topic: string, storyId: string, url: string, root = ROOT): DraftView {
  const dir = scriptDir(topic, storyId, root);
  const review = readJson<ReviewLite>(join(dir, 'video', REVIEW_DIR, 'review.json'));
  const tl = readJson<TimelineLite>(join(dir, 'video', 'timeline.json'));
  const report = readJson<BuildSummary>(join(dir, 'video', 'build-report.json'));
  const v = readJson<ValidationLite>(join(dir, 'validation.json'));
  const fps = tl?.fps ?? 30;
  const at = (scene?: string, sentence?: string): string => {
    const sc = tl?.scenes.find((s) => s.id === scene || s.sentences.some((x) => x.id === sentence));
    const sx = sc?.sentences.find((x) => x.id === sentence);
    const start = sx?.start ?? sc?.start;
    const parts = [start === undefined ? '' : stampOf(start / fps), sc?.id ?? scene ?? '', sentence ?? ''].filter(
      Boolean,
    );
    return parts.length ? `[${parts.join(' ')}] ` : '';
  };
  const findings = [
    ...(report?.qa.checks ?? [])
      .filter((c) => !c.ok)
      .map((c) => `${at(c.scene, c.sentence)}QA: ${c.name}${c.detail ? `: ${c.detail}` : ''}`),
    ...(v?.issues ?? [])
      .filter((i) => i.severity === 'warning' && !i.disposition)
      .map((i) => `${at(undefined, i.sentence)}${i.category}: ${i.explanation}`),
  ];
  return { url, title: review?.title ?? storyId, checklist: review?.checklist ?? [], findings };
}

const footer = (a: Automation) => [
  '',
  '--',
  `${a.approvals.approverName || 'You'} alone decide; the Commonwealth of Reason's automation only asked.`,
];

export function renderDraftRequest(
  topic: string,
  storyId: string,
  view: DraftView,
  a: Automation,
  secrets: string[] = secretsOf(),
): Omit<OutMail, 'messageId'> {
  const clean = (s: string) => redact(s, secrets);
  const lines = [
    `A draft of "${clean(view.title)}" (${topic} / ${storyId}) is uploaded privately for your review:`,
    '',
    view.url,
    '',
    'Watch it with the checklist:',
    ...view.checklist.map((c, i) => `${i + 1}. ${clean(c)}`),
    ...(view.findings.length
      ? [
          '',
          'What the build and the script checks flagged, at their moment:',
          ...view.findings.map((f) => `- ${clean(f)}`),
        ]
      : ['', 'The build and the script checks flagged nothing.']),
    ...(view.shadowNotes
      ? [
          '',
          "The reviewing agent's notes, for comparison (its verdict decides nothing):",
          ...(view.shadowNotes.length
            ? view.shadowNotes.map(
                (n) =>
                  `${n.n}. ${n.seconds !== undefined ? `[${stampOf(n.seconds)}${n.scene ? ` ${n.scene}` : ''}] ` : ''}${clean(n.text)}`,
              )
            : ['(none: it would accept the draft)']),
          'Mark them with a line like: NOTES: 1 agree, 2 disagree',
        ]
      : []),
    '',
    'Reply OK to accept the draft (the release voice is then rendered and uploaded for the release request),',
    'or CHANGES: and one note per line (a time like [2:31] places it).',
    ...footer(a),
  ];
  return {
    from: a.approvals.from || a.notifications.to,
    to: a.approvals.to || a.notifications.to,
    subject: `[CoR draft] ${clean(view.title)}`,
    text: lines.join('\n'),
  };
}

const minutes = (s: number) => `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;

export function renderReleaseRequest(
  manifest: ReleaseManifest,
  req: ApprovalRequest,
  a: Automation,
  opts: { thumbnail?: Buffer | null; urls?: Record<string, string | null>; secrets?: string[] } = {},
): Omit<OutMail, 'messageId'> {
  const clean = (s: string) => redact(s, opts.secrets ?? secretsOf());
  const main = manifest.outputs[manifest.sequence[0]];
  const fixture = manifest.fixtureRun ? ` [fixture ${manifest.fixtureRun}]` : '';
  const output = (id: string, i: number) => {
    const o = manifest.outputs[id];
    const kind = o.kind === 'youtube-short' ? 'Short' : 'Video';
    return [
      `${i + 1}. ${kind}: ${clean(o.title)} (${minutes(o.seconds)})`,
      `   Private link: ${opts.urls?.[id] ?? '(not uploaded)'}`,
      ...(o.chapters.length
        ? [`   Chapters: ${o.chapters.map((c) => `${stampOf(c.at)} ${c.title}`).join(' | ')}`]
        : []),
      `   Captions: ${o.captionsSha ? 'yes' : 'none'}; thumbnail: ${o.thumbnailSha ? 'the title card' : 'YouTube’s choice'}; disclosure line: ${o.disclosurePresent ? 'present' : 'MISSING'}`,
      '   Description:',
      ...clean(o.description)
        .split('\n')
        .map((l) => `   | ${l}`),
    ];
  };
  const paid = manifest.ctas.commercial;
  const lines = [
    `This is the whole publication of "${clean(main.title)}"${fixture}, by the ${manifest.institution} commission, for your approval.`,
    ...(manifest.fixtureRun
      ? [
          '',
          'It is a fixture run: on OK the video becomes unlisted at most, never public, and Studio sets it private again (the launch email names the step).',
        ]
      : []),
    '',
    'Outputs, in the order they go live:',
    ...manifest.sequence.flatMap((id, i) => ['', ...output(id, i)]),
    '',
    'The companion article:',
    manifest.article
      ? `  "${clean(manifest.article.headline)}", ${manifest.article.words} words, at ${manifest.site.articleUrl ?? manifest.site.matterUrl}`
      : '  none for this story',
    '',
    'The public pages once live:',
    `  Matter page: ${manifest.site.matterUrl}`,
    ...(manifest.site.dataUrl ? [`  Data: ${manifest.site.dataUrl}`] : []),
    '',
    'Calls to action in the description:',
    `  Primary: ${clean(manifest.ctas.primary.text)} -> ${manifest.ctas.primary.url}`,
    ...manifest.ctas.secondary.map((c) => `  Also: ${clean(c.text)} -> ${c.url}`),
    ...paid.flatMap((p) => [
      `  Paid link ${p.n}: ${clean(p.text)} -> ${p.url}, disclosure: ${clean(p.disclosure)}`,
      p.approvedBy
        ? `    approved by ${p.approvedBy}`
        : '    PENDING: reply PAID OK to approve every paid link shown, or PAID OK ' +
          p.n +
          '; without it the description omits this link',
    ]),
    '',
    `Evidence: ${manifest.evidence.claims} claims, ${manifest.evidence.verdictsCited} cited verdicts; the public record is on the matter page.`,
    ...(manifest.distribution.x
      ? [
          '',
          `After publication, ${manifest.distribution.x.account} will post:`,
          ...manifest.distribution.x.text.split('\n').map((l) => `  | ${l}`),
        ]
      : ['', 'No social post: the commission has no X account.']),
    '',
    'The checklist you went through on the draft applies to this build; replying OK confirms every item.',
    '',
    'Reply with one of these as the first line:',
    '  OK                      publish now',
    '  OK at Thursday 15:00    schedule it (your time)',
    '  CHANGES:                then one note per line',
    'and PAID OK (or PAID OK 1) on its own line to approve the paid links shown.',
    '',
    `This request expires ${req.expiresAt.slice(0, 10)}; a changed video, article or link voids it and you will get a new one.`,
    ...footer(a),
    `Request ${req.request}`,
  ];
  return {
    from: a.approvals.from || a.notifications.to,
    to: a.approvals.to || a.notifications.to,
    subject: `[CoR release] ${clean(main.title)} (${req.request})`,
    text: lines.join('\n'),
    ...(opts.thumbnail && { attachments: [{ name: 'thumbnail.png', contentType: 'image/png', data: opts.thumbnail }] }),
  };
}

/** The body outside the footer: what the person reads; tests assert no request id lives there. */
export const bodyOf = (text: string): string => text.split('\n--\n')[0];

export interface SendDeps {
  root?: string;
  now?: () => number;
  env?: NodeJS.ProcessEnv;
  secrets?: string[];
}

/** Sends the release request once per request id (the outbox remembers), then records the Message-ID on the
 *  ledger through `publish message-sent`. Returns the message id, or null when nothing was sent. */
export async function sendReleaseRequest(
  topic: string,
  storyId: string,
  manifest: ReleaseManifest,
  a: Automation,
  mail: MailTransport,
  deps: SendDeps = {},
): Promise<string | null> {
  const root = deps.root ?? ROOT;
  const ledger = loadLedger(topic, storyId, root);
  const req = ledger && openRequest(ledger, manifest.releaseSha, new Date((deps.now ?? Date.now)()));
  if (!req) return null;
  if (readOutbox(root).some((e) => e.request === req.request)) return null;
  const urls = Object.fromEntries(
    Object.keys(manifest.outputs).map((id) => {
      const up = ledger.outputs[id]?.events.findLast((e) => e.type === 'uploaded');
      return [id, up?.url ?? (up?.id ? `https://youtu.be/${up.id}` : null)];
    }),
  );
  const thumb = join(scriptDir(topic, storyId, root), 'video', REVIEW_DIR, 'thumbnail.png');
  const out = renderReleaseRequest(manifest, req, a, {
    thumbnail: existsSync(thumb) ? readFileSync(thumb) : null,
    urls,
    secrets: deps.secrets,
  });
  const { messageId } = await sendTracked(mail, out, 'release-request', root, {
    request: req.request,
    topic,
    storyId,
    now: deps.now,
  });
  const r = runCli(
    'publish',
    [
      'message-sent',
      topic,
      storyId,
      '--request',
      req.request,
      '--message-id',
      messageId,
      '--by',
      'automated: release request',
    ],
    {
      cwd: root,
      env: envFor('publish', [], deps.env ?? process.env),
    },
  );
  if (r.status !== 0) throw new Error(`publish message-sent failed: ${(r.stderr || r.stdout).trim()}`);
  return messageId;
}

interface DraftRequests {
  [build: string]: { messageId: string; at: string };
}
const draftRequestsPath = (topic: string, storyId: string, root: string) =>
  join(scriptDir(topic, storyId, root), DRAFT_REQUEST_FILE);
export const draftRequests = (topic: string, storyId: string, root = ROOT): DraftRequests =>
  readJson<DraftRequests>(draftRequestsPath(topic, storyId, root)) ?? {};

/** Sends the draft request once per draft build (run/draft-request.json remembers). */
export async function sendDraftRequest(
  topic: string,
  storyId: string,
  g: ReleaseGroup,
  shadow: ShadowEntry | null,
  a: Automation,
  mail: MailTransport,
  deps: SendDeps = {},
): Promise<string | null> {
  const root = deps.root ?? ROOT;
  const build = g.main.build?.sha;
  const url = g.main.state.url;
  if (!build || !url) return null;
  const sent = draftRequests(topic, storyId, root);
  if (sent[build]) return null;
  runDir(topic, storyId, root); // the run folder, should the loop be the first to write there
  const view = draftView(topic, storyId, url, root);
  if (shadow) view.shadowNotes = shadow.agent.notes;
  const out = renderDraftRequest(topic, storyId, view, a, deps.secrets);
  const { messageId } = await sendTracked(mail, out, 'draft-request', root, { topic, storyId, now: deps.now });
  writeJsonAtomic(draftRequestsPath(topic, storyId, root), {
    ...sent,
    [build]: { messageId, at: new Date((deps.now ?? Date.now)()).toISOString() },
  });
  return messageId;
}
