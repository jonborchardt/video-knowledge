// The request mails (spec §7.2, §7.3): the draft request (watch the private upload, accept or send back) and the
// release request (the whole publication the manifest binds, in plain language, with the reply lines). Composed
// here from the package files through shared io, never from the website's review view; sent through the outbox
// (notify.ts) once per request id; the sent Message-ID goes to the ledger through `publish message-sent`.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Automation } from '../../shared/automation';
import type { BuildSummary } from '../../shared/build-report';
import { type CliResult, runCli } from '../../shared/cli';
import { REVIEW_DIR, ROOT, readJson, scriptDir, writeJsonAtomic } from '../../shared/io';
import { runDir } from './journal';
import type { MailTransport, OutMail } from '../../shared/mail';
import { redact } from '../../shared/mail';
import type { ReleaseManifest } from '../../shared/types';
import { type ApprovalRequest, loadLedger, openRequest, stampOf, storyOutputs } from '../../modules/publishing';
import { publicUrlsOf } from '../../modules/website';
import { commissionOf, isFixtureTopic } from '../../config/site';
import { readdirSync } from 'node:fs';
import { topicDir } from '../../shared/io';
import type { LaunchRecord } from './launch';
import { readOutbox, secretsOf, sendTracked } from './notify';
import type { ShadowEntry } from './release';
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
  opts: {
    thumbnail?: Buffer | null;
    urls?: Record<string, string | null>;
    secrets?: string[];
    checklist?: string[]; // the main output's review checklist: listed, so OK affirms what the person read
  } = {},
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
    'The review checklist for this build:',
    ...(opts.checklist?.length ? opts.checklist.map((c, i) => `  ${i + 1}. ${clean(c)}`) : ['  (none recorded)']),
    'Replying OK confirms every item above.',
    '',
    'Reply with one of these as the first line:',
    '  OK                      publish now',
    '  OK at Thursday 15:00    schedule it (your time)',
    '  CHANGES:                then one note per line',
    'and PAID OK (or PAID OK 1) on its own line to approve the paid links shown.',
    'OK stands alone on its line: "OK, but ...", "OK if ..." or "OK?" publishes nothing and is asked about instead.',
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
  /** Runs `publish message-sent` (the ledger's record of the mail); the default spawns the CLI. Tests inject. */
  run?: (cli: string, args: string[]) => Promise<CliResult> | CliResult;
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
  const sent = readOutbox(root).find((e) => e.request === req.request);
  if (sent) {
    // sent before: the ledger may lack the record (a crash between the send and it): complete it from the outbox
    if (!req.messageId) await recordSent(topic, storyId, req.request, sent.messageId, root, deps);
    return req.messageId ? null : sent.messageId;
  }
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
    checklist: checklistOf(topic, storyId, root),
  });
  const { messageId } = await sendTracked(mail, out, 'release-request', root, {
    request: req.request,
    topic,
    storyId,
    now: deps.now,
  });
  await recordSent(topic, storyId, req.request, messageId, root, deps);
  return messageId;
}

/** The review checklist of the story's package, for the release mail. */
export const checklistOf = (topic: string, storyId: string, root = ROOT): string[] =>
  readJson<{ checklist?: string[] }>(join(scriptDir(topic, storyId, root), 'video', REVIEW_DIR, 'review.json'))
    ?.checklist ?? [];
/** The upload URLs of a manifest's outputs, from the ledger (for a resend as for the first send). */
export function urlsOf(
  topic: string,
  storyId: string,
  manifest: ReleaseManifest,
  root = ROOT,
): Record<string, string | null> {
  const ledger = loadLedger(topic, storyId, root);
  return Object.fromEntries(
    Object.keys(manifest.outputs).map((id) => {
      const up = ledger?.outputs[id]?.events.findLast((e) => e.type === 'uploaded');
      return [id, up?.url ?? (up?.id ? `https://youtu.be/${up.id}` : null)];
    }),
  );
}

async function recordSent(
  topic: string,
  storyId: string,
  request: string,
  messageId: string,
  root: string,
  deps: SendDeps,
): Promise<void> {
  const args = [
    'message-sent',
    topic,
    storyId,
    '--request',
    request,
    '--message-id',
    messageId,
    '--by',
    'automated: release request',
  ];
  const r = deps.run
    ? await deps.run('publish', args)
    : runCli('publish', args, { cwd: root, env: envFor('publish', [], deps.env ?? process.env) });
  if (r.status !== 0) throw new Error(`publish message-sent failed: ${(r.stderr || r.stdout).trim()}`);
}

interface DraftRequests {
  [build: string]: { messageId: string; at: string };
}
const draftRequestsPath = (topic: string, storyId: string, root: string) =>
  join(scriptDir(topic, storyId, root), DRAFT_REQUEST_FILE);
export const draftRequests = (topic: string, storyId: string, root = ROOT): DraftRequests =>
  readJson<DraftRequests>(draftRequestsPath(topic, storyId, root)) ?? {};

/** Sends the draft request for one output under review (the video, or a Short by its own story id), once per draft
 *  build (its run/draft-request.json remembers). */
export async function sendDraftRequest(
  topic: string,
  storyId: string,
  build: string,
  url: string,
  shadow: ShadowEntry | null,
  a: Automation,
  mail: MailTransport,
  deps: SendDeps = {},
): Promise<string | null> {
  const root = deps.root ?? ROOT;
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

// ---- the launch mail (phase 3 Task 4) --------------------------------------------------------------------------

/** A fixture launch's extra lines (spec §5.8): where the preview is, the branch and the command that deletes it,
 *  the Studio step that sets the unlisted outputs private again, and the uploads of earlier runs to delete. */
function fixtureLines(rec: LaunchRecord, root: string): string[] {
  const ledger = loadLedger(rec.topic, rec.storyId, root);
  const current = new Set(
    Object.values(ledger?.outputs ?? {}).flatMap((o) =>
      o.events.filter((e) => e.type === 'published').map((e) => e.id),
    ),
  );
  const uploads = (l: { outputs: Record<string, { events: { type: string; id?: string }[] }> } | null) =>
    Object.values(l?.outputs ?? {}).flatMap((o) =>
      o.events.filter((e) => e.type === 'uploaded' && e.id).map((e) => e.id!),
    );
  const history = join(topicDir(rec.topic, root), 'history');
  const earlier = existsSync(history)
    ? readdirSync(history).flatMap((run) => {
        const scripts = join(history, run, 'scripts');
        return existsSync(scripts)
          ? readdirSync(scripts).flatMap((slug) =>
              uploads(readJson(join(scripts, slug, 'publish.json'))).map((id) => `${id} (run ${run})`),
            )
          : [];
      })
    : [];
  const superseded = [
    ...uploads(ledger)
      .filter((id) => !current.has(id))
      .map((id) => `${id} (this run, replaced)`),
    ...earlier,
  ];
  return [
    'This is a fixture run (spec 5.8): the outputs above are unlisted at most, never public.',
    `Preview: ${rec.previewUrl && rec.previewUrl !== 'local fallback' ? rec.previewUrl : 'no preview URL configured (automation.json launch.fixturePreviewUrl); local fallback: FIXTURE_SITE=1 npm run build, then open dist/<the matter path>/index.html'}`,
    ...(rec.fixtureBranch
      ? [`Branch: ${rec.fixtureBranch}; when done: git push origin --delete ${rec.fixtureBranch}`]
      : []),
    `Set the unlisted outputs private again: Studio > Content > each video > Visibility > Private; then npm run publish -- updated ${rec.topic} ${rec.storyId} --fields visibility`,
    ...(superseded.length
      ? [
          'Superseded uploads of earlier runs, to delete in Studio (Content > the video > Delete forever):',
          ...superseded.map((s) => `- ${s}`),
        ]
      : ['No superseded uploads of earlier runs.']),
  ];
}

/** The mail that closes a launch: the public links, the deploy URL, the X post (or "not configured"), and the
 *  optional Studio steps YouTube keeps manual, each with the line that records it done. */
export function renderLaunched(rec: LaunchRecord, a: Automation, root = ROOT): Omit<OutMail, 'messageId'> {
  const outs = storyOutputs(rec.topic, rec.storyId, root);
  const urls = publicUrlsOf(rec.topic, rec.storyId, root);
  const c = commissionOf(rec.topic);
  const title = outs.video?.title || rec.storyId;
  const lines = [
    `${title} is live.`,
    '',
    `Page: ${urls.matterUrl}`,
    ...(urls.articleUrl ? [`Article: ${urls.articleUrl}`] : []),
    ...(outs.video ? [`Video: ${outs.video.url}`] : []),
    ...outs.shorts.map((s) => `Short: ${s.url}`),
    '',
  ];
  const social = readJson<{ outputs: Record<string, { posts: { status: string; url?: string }[] }> }>(
    join(scriptDir(rec.topic, rec.storyId, root), 'social.json'),
  );
  const posted = Object.values(social?.outputs ?? {}).flatMap((o) =>
    o.posts.filter((p) => p.status === 'posted' && p.url).map((p) => p.url!),
  );
  if (rec.posted === 'not-configured' || rec.posted === null)
    lines.push(`X: not configured (${c ? `${c.name} has no account or keys` : 'no institution'}); nothing was posted.`);
  else if (rec.posted === true) lines.push(`X: posted${posted.length ? `: ${posted.join(', ')}` : ''}.`);
  else lines.push('X: the post failed; see the halt or npm run social -- show.');
  lines.push(
    '',
    'Optional Studio steps YouTube keeps manual (each line records it done once you have):',
    ...outs.shorts.map(
      (s) =>
        `- Related video on ${s.url}: Studio > the Short > Related video > ${outs.video?.url ?? 'the video'}; then npm run publish -- updated ${rec.topic} ${rec.storyId}/shorts/${s.output.slice('short:'.length)} --fields relatedVideo`,
    ),
    `- End screen elements on the video (the close card leaves the room): Studio > Editor > End screen; then npm run publish -- updated ${rec.topic} ${rec.storyId} --fields endScreen`,
    `- Cards on the video: Studio > Editor > Cards; then npm run publish -- updated ${rec.topic} ${rec.storyId} --fields cards`,
    '',
    `Deploy: ${rec.pushed ?? rec.committed ?? 'not pushed'}${rec.fixtureBranch ? ` (also pushed as ${rec.fixtureBranch})` : ''}; confirmed at ${rec.liveAt ?? 'not yet'} after ${rec.probes} probe${rec.probes === 1 ? '' : 's'}.`,
  );
  if (isFixtureTopic(rec.topic)) lines.push('', ...fixtureLines(rec, root));
  return {
    from: a.approvals.from || a.notifications.to,
    to: a.notifications.to || a.approvals.to,
    subject: `[CoR live] ${title}`,
    text: redact(lines.join('\n'), secretsOf()),
  };
}
