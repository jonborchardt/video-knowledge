// The article pass of a maintenance scan (spec §2 Maintenance, §7.1, register D10; phase 6 Task 3): for every story
// of the topic with a released article the board inspects `stale` or `changed`, either the released text stands (a
// fresh `article-review.md` agent in reaffirm mode says so and the text still passes: `article reaffirm` by the
// automation with the reviewer's why) or it is corrected (a writer agent in correction mode changing only what the
// revised findings touch, a fresh reviewer, `validate`; a passing correction becomes a correction request the person
// approves by reply, like a release: `article request-correction`). A correction is never released by automation;
// a failing one after the writer's revisions halts `awaiting-person` on the story. Everything through the article
// CLI as a child; the agents under the writer's and reviewer's grants for the story.
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Automation } from '../../shared/automation';
import { ROOT, readJson, scriptDir, topicDir, writeJsonAtomic } from '../../shared/io';
import type { MailTransport } from '../../shared/mail';
import type { ScriptReviewFile, ScriptValidation } from '../../shared/types';
import {
  ARTICLE_FILES,
  type Article,
  articleFingerprint,
  inspectArticle,
  loadArticleRelease,
  loadArticleRequest,
} from '../../modules/article';
import type { Step } from '../production';
import { guard as realGuard, snapshot as realSnapshot, type TreeSnapshot } from './guard';
import { type Halt, type JournalEntry, appendJournal, nextLine, readHalt, runDir, writeHalt } from './journal';
import { type RoleGrant, grantFor } from './roles';
import { addSpend, isoWeek, weekSpend } from './runner';
import { sendCorrectionRequest } from './requests';
import { type StepContext, type StepOutcome, execStep as realExecStep, usageFields } from './steps';

export const ARTICLE_BRIEF = 'src/modules/article/briefs/article.md';
export const ARTICLE_REVIEW_BRIEF = 'src/modules/article/briefs/article-review.md';
export const CORRECTION_REVISIONS = 3;
/** Under the story's run folder: the correction pass's revisions since the stale finding (the writer's limit). */
export const CORRECTION_FILE = 'correction.json';

export interface ArticleWorkDeps {
  now?: () => number;
  mail: MailTransport | null;
  env?: NodeJS.ProcessEnv;
  exec?: typeof realExecStep;
  argvOf?: StepContext['argvOf'];
  hooks?: {
    snapshot?: () => void;
    guard?: (scope: 'agent' | 'child') => { ok: boolean; why: string; kept?: string[] };
  };
  root?: string;
  runId?: string;
  /** Only these stories (tests); the default is every story of the topic with a released article. */
  stories?: string[];
}

interface Correction {
  since: string; // the inspection finding that started the pass
  revisions: number;
  notes?: string[]; // a person's CHANGES on the last request
}

export async function articleWork(
  topic: string,
  a: Automation,
  d: ArticleWorkDeps,
): Promise<{ actions: string[]; halted: string[] }> {
  const root = d.root ?? ROOT;
  const now = d.now ?? Date.now;
  const exec = d.exec ?? realExecStep;
  const runId = d.runId ?? 'maintenance';
  const stamp = () => new Date(now()).toISOString();
  const actions: string[] = [];
  const halted: string[] = [];
  const stories = d.stories ?? releasedStories(topic, root);
  for (const storyId of stories) {
    if (!loadArticleRelease(topic, storyId, root)) continue;
    const dir = runDir(topic, storyId, root);
    const sdir = scriptDir(topic, storyId, root);
    const journal = (e: Omit<JournalEntry, 'at' | 'runId'>) => appendJournal(dir, { at: stamp(), runId, ...e });
    let snap: TreeSnapshot | null = null;
    let grant: RoleGrant = grantFor('writer', { topic, storyId });
    const hooks = {
      snapshot: d.hooks?.snapshot ?? (() => void (snap = realSnapshot(root))),
      guard:
        d.hooks?.guard ??
        ((scope: 'agent' | 'child') => {
          if (!snap) snap = realSnapshot(root);
          const g =
            scope === 'agent'
              ? realGuard(snap, root, [...grant.writable, ...grant.derived])
              : realGuard(snap, root, [`topics/${topic}/**`]);
          snap = realSnapshot(root);
          return {
            ok: g.ok,
            why: [...g.reverted.map((p) => `reverted ${p}`), ...g.restored.map((p) => `restored ${p}`)].join('; '),
            kept: g.kept,
          };
        }),
    };
    hooks.snapshot();
    let stepNo = 0;
    const ctxOf = (role: StepContext['role']): StepContext => {
      mkdirSync(join(dir, 'steps'), { recursive: true });
      return {
        topic,
        storyId,
        root,
        approver: `automated: maintenance ${runId}`,
        role,
        logPath: join(dir, 'steps', `article-${stamp().slice(0, 10)}-${++stepNo}.log`),
        env: d.env,
        argvOf: d.argvOf,
        guard: (scope) => hooks.guard(scope),
        budgetUsd: a.agents.budgetUsd.perAgent,
      };
    };
    const record = (step: Step, out: StepOutcome) =>
      journal({
        stage: 'article',
        next: '',
        step: step.text.split('\n')[0].slice(0, 200),
        kind: step.kind,
        attempt: 1,
        exit: out.exit,
        ms: out.ms,
        costUsd: out.costUsd,
        sessionId: out.sessionId ?? undefined,
        error: out.error ?? undefined,
        ...usageFields(out),
      });
    const halt = (kind: Halt['kind'], why: string, unblock: Halt['unblock']) => {
      const h: Halt = {
        kind,
        stage: 'article',
        why,
        unblock,
        at: stamp(),
        runId,
        board: { stage: 'article', next: 'a person' },
      };
      if (readHalt(dir)?.why !== why) writeHalt(dir, h);
      journal({ stage: 'article', next: '', step: kind, kind: 'halt', attempt: 1, error: why });
      halted.push(`${storyId}: ${kind}: ${why}`);
    };
    const agent = async (
      brief: string,
      mode: string,
      lines: string[],
      role: StepContext['role'],
    ): Promise<StepOutcome> => {
      const week = isoWeek(new Date(now()));
      if (weekSpend(root, week) + a.agents.budgetUsd.perAgent > a.agents.budgetUsd.perWeek)
        return {
          kind: 'prompt',
          ok: false,
          exit: null,
          ms: 0,
          costUsd: 0,
          sessionId: null,
          error: `budget: week ${weekSpend(root, week).toFixed(2)} of ${a.agents.budgetUsd.perWeek} USD`,
          log: '',
        };
      grant = grantFor(role, { topic, storyId });
      const step: Step = {
        kind: 'prompt',
        text: [`Read ${brief} and follow it.`, `Topic: ${topic}`, `Story: ${storyId}`, `Mode: ${mode}`, ...lines].join(
          '\n',
        ),
      };
      const out = await exec(a, step, { ...ctxOf(role), attempts: { dir, line: nextLine(dir) } });
      if (out.costUsd) addSpend(root, week, out.costUsd);
      record(step, out);
      return out;
    };
    const child = async (text: string): Promise<StepOutcome> => {
      const step: Step = { kind: 'run', text };
      const out = await exec(a, step, ctxOf('writer'));
      record(step, out);
      const g = hooks.guard('child');
      return g.ok ? out : { ...out, ok: false, guardFailed: true, error: g.why };
    };
    // the inspection, after a fresh validation (the report may have moved)
    await child(`npm run article -- validate ${topic} ${storyId}`);
    const inspection = inspectArticle(topic, storyId, root);
    const request = loadArticleRequest(topic, storyId, root);
    const corrFile = join(dir, CORRECTION_FILE);
    const corr = readJson<Correction>(corrFile);
    const notesFromPerson =
      request?.decided?.verdict === 'changes' && request.decided.notes?.length ? request.decided.notes : null;
    if (inspection.status === 'ready' && !notesFromPerson) {
      if (corr) rmSync(corrFile, { force: true }); // the correction was released or the text reaffirmed
      continue;
    }
    if (
      inspection.status !== 'stale' &&
      !(inspection.status === 'invalid' && inspection.code === 'changed') &&
      !notesFromPerson &&
      !corr
    )
      continue;
    // 3. the request: bound to the article's fingerprint; a person approves by reply (`article decide`)
    const requestAndMail = async () => {
      const req = await child(
        `npm run article -- request-correction ${topic} ${storyId} --by "automated: maintenance ${runId}"`,
      );
      if (!req.ok)
        return halt('step-failed', `article request-correction failed: ${req.error}`, {
          kind: 'fix',
          text: `npm run article -- request-correction ${topic} ${storyId} --by "<name>" (APPROVAL_SECRET in .env)`,
        });
      const open = loadArticleRequest(topic, storyId, root);
      if (open && d.mail && !open.messageId)
        await sendCorrectionRequest(topic, storyId, open, a, d.mail, { root, now, env: d.env });
      actions.push(`${topic}/${storyId}: correction requested${open ? ` (${open.request})` : ''}`);
    };
    if (request && !request.decided && request.fingerprint === articleFingerprintOf(topic, storyId, root)) {
      if (Date.parse(request.expiresAt) > now()) {
        actions.push(`${topic}/${storyId}: correction requested (${request.request}), awaiting the person`);
        continue;
      }
      await requestAndMail(); // expired unanswered: a new id for the same text, and the mail again
      continue;
    }
    const since = inspection.findings[0] ?? (notesFromPerson ? 'a person asked for changes' : 'changed');
    const state: Correction =
      corr && (!notesFromPerson || sameNotes(corr.notes, notesFromPerson))
        ? corr
        : { since, revisions: 0, ...(notesFromPerson && { notes: notesFromPerson }) };
    // 1. stale and the text may stand: a fresh reviewer in reaffirm mode says whether it does
    if (inspection.status === 'stale' && state.revisions === 0 && !notesFromPerson) {
      const r = await agent(
        ARTICLE_REVIEW_BRIEF,
        'reaffirm',
        [`Revised: ${inspection.findings.join('; ')}`, `Write: ${rel(sdir, root, ARTICLE_FILES.review)}`],
        'reviewer',
      );
      if (r.guardFailed) {
        halt('unexpected-edit', r.error ?? 'the reviewer edited outside its files', {
          kind: 'fix',
          text: `read ${dir}`,
        });
        continue;
      }
      const review = readJson<ScriptReviewFile>(join(sdir, ARTICLE_FILES.review));
      if (r.ok && review?.reaffirm?.ok) {
        const v = readJson<ScriptValidation>(join(sdir, ARTICLE_FILES.validation));
        if (v?.status === 'passed') {
          const re = await child(
            `npm run article -- reaffirm ${topic} ${storyId} --approved-by "automated: maintenance ${runId}" --note "${review.reaffirm.why.replace(/"/g, "'")}"`,
          );
          if (re.ok) {
            actions.push(`${topic}/${storyId}: article reaffirmed (${review.reaffirm.why})`);
            continue;
          }
        }
      }
      actions.push(
        `${topic}/${storyId}: the reviewer says the article must change${review?.reaffirm?.why ? ` (${review.reaffirm.why})` : ''}`,
      );
    }
    // 2. a correction: the writer changes what the revised findings touch (or what the person asked), a fresh
    //    reviewer judges it, validate decides; three revisions, then a person's
    if (state.revisions >= CORRECTION_REVISIONS) {
      halt(
        'awaiting-person',
        `the article correction of ${storyId} still fails after ${state.revisions} revisions: ${inspection.findings[0] ?? ''}`,
        {
          kind: 'decide',
          text: `edit topics/.../article.json by hand or park the correction; the pass restarts when the inspection changes`,
        },
      );
      continue;
    }
    // a `changed` text nobody is correcting is a person's hand edit: validated as it stands
    if (inspection.status !== 'invalid' || inspection.code !== 'changed' || notesFromPerson || corr) {
      const w = await agent(
        ARTICLE_BRIEF,
        'correction',
        [
          `Revised: ${inspection.findings.join('; ')}`,
          ...(state.notes?.length ? ['Notes:', ...state.notes.map((n) => `- ${n}`)] : []),
          `Write: ${rel(sdir, root, ARTICLE_FILES.article)}`,
        ],
        'writer',
      );
      state.revisions += 1;
      writeJsonAtomic(corrFile, state);
      if (w.guardFailed) {
        halt('unexpected-edit', w.error ?? 'the writer edited outside its files', { kind: 'fix', text: `read ${dir}` });
        continue;
      }
      if (!w.ok) {
        actions.push(
          /^validator /.test(w.error ?? '')
            ? `${topic}/${storyId}: the correction does not pass yet (revision ${state.revisions})`
            : `${topic}/${storyId}: the correction writer did not finish: ${w.error}`,
        );
        continue;
      }
      const r = await agent(
        ARTICLE_REVIEW_BRIEF,
        'correction',
        [`Revised: ${inspection.findings.join('; ')}`, `Write: ${rel(sdir, root, ARTICLE_FILES.review)}`],
        'reviewer',
      );
      if (r.guardFailed) {
        halt('unexpected-edit', r.error ?? 'the reviewer edited outside its files', {
          kind: 'fix',
          text: `read ${dir}`,
        });
        continue;
      }
    }
    const v = await child(`npm run article -- validate ${topic} ${storyId}`);
    if (!v.ok) {
      actions.push(`${topic}/${storyId}: the correction does not pass yet (revision ${state.revisions})`);
      continue;
    }
    await requestAndMail();
  }
  return { actions, halted };
}

const sameNotes = (a: string[] | undefined, b: string[]) => JSON.stringify(a ?? []) === JSON.stringify(b);
const rel = (sdir: string, root: string, file: string) =>
  `${sdir.slice(root.length + 1).replaceAll('\\', '/')}/${file}`;
export const articleFingerprintOf = (topic: string, storyId: string, root = ROOT): string | null => {
  const a = readJson<Article>(join(scriptDir(topic, storyId, root), ARTICLE_FILES.article));
  return a ? articleFingerprint(a) : null;
};
export const hasRelease = (topic: string, storyId: string, root = ROOT) =>
  existsSync(join(scriptDir(topic, storyId, root), ARTICLE_FILES.release));

/** Every story of the topic with a released article: the stories.json candidates may no longer list a produced
 *  story once a finding it rests on was revised, and that article is the one most likely to need the pass. */
export function releasedStories(topic: string, root = ROOT): string[] {
  const scripts = join(topicDir(topic, root), 'scripts');
  if (!existsSync(scripts)) return [];
  return readdirSync(scripts).flatMap((folder) => {
    const story = readJson<{ story?: string }>(join(scripts, folder, ARTICLE_FILES.release))?.story;
    return story ? [story] : [];
  });
}
