// The article pass of maintenance (spec §13 criterion 10, register D10; phase 6 Task 3): a revision on a claim the
// released article cites makes it stale; a fresh reviewer either reaffirms it (automation records that with the
// reviewer's why) or the writer corrects it, a reviewer judges, validate passes, and a correction request goes to
// the person by mail; a revision on a claim it does not cite produces nothing; a correction that keeps failing halts
// awaiting-person after the writer's revisions. The article verbs are the fake article CLI (the module's own tests
// prove them); the agents are the fake claude.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { cliArgv } from '../../src/shared/cli';
import { ROOT, readJson, toJson } from '../../src/shared/io';
import { FakeMailer } from './fake-mailer';
import { ARTICLE_FILES, type ArticleRelease, loadArticleRequest } from '../../src/modules/article';
import { MLM } from '../script-helpers';
import { articleWork } from '../../src/orchestration/run/article-work';
import { renderCorrectionRequest } from '../../src/orchestration/run/requests';
import { readAttempts, readHalt, readJournal, runDir } from '../../src/orchestration/run/journal';
import { type Fixture, cliRoot, syntheticProduction } from '../production-helpers';

const FAKE_CLAUDE = join(ROOT, 'tests', 'automation', 'fake-claude.mjs');
const FAKE_ARTICLE = join(ROOT, 'tests', 'automation', 'fake-article-cli.mjs');
const fixtures: Fixture[] = [];
afterAll(() => fixtures.forEach((f) => f.cleanup()), 120_000);
const T0 = Date.now(); // the request's expiry is set by the verb on the real clock
const a = {
  ...DEFAULTS,
  approvals: { ...DEFAULTS.approvals, to: 'jon@example.test', from: 'automation@example.test', approverName: 'Jon' },
  notifications: { to: 'jon@example.test', digest: { weekday: 'monday', hour: 8 } },
  agents: { ...DEFAULTS.agents, command: `node ${FAKE_CLAUDE}` },
};

function staged(opts: { revised: string | null; reaffirm?: boolean; validation?: 'passed' | 'blocked' }) {
  const f = syntheticProduction('packaged', { release: true });
  fixtures.push(f);
  cliRoot(f.root);
  const release = readJson<ArticleRelease>(join(f.dir, ARTICLE_FILES.release))!;
  writeFileSync(join(f.dir, ARTICLE_FILES.article), toJson(release.article)); // the released text on disk
  if (opts.revised) {
    const prPath = join(f.root, 'topics', f.topic, 'public-record.json');
    const pr = readJson<{ exhibits: object; revisions: unknown[] }>(prPath) ?? { exhibits: {}, revisions: [] };
    pr.revisions.push({
      kind: 'claim',
      id: opts.revised,
      at: '2026-12-01',
      date: '2026-12-01',
      from: 'right',
      to: 'partly',
      note: 'a 2026 survey of 2,000 participants finds 39% lost money',
    });
    writeFileSync(prPath, toJson(pr));
  }
  const rel = (p: string) => p.slice(f.root.length + 1).replaceAll('\\', '/');
  const corrected = { ...release.article };
  corrected.sections = release.article.sections.map((s) => ({
    ...s,
    blocks: s.blocks.map((b) =>
      b.kind === 'prose'
        ? {
            ...b,
            sentences: b.sentences.map((x) =>
              x.id === 's02' ? { ...x, text: 'Of 2,000 people surveyed in 2026, 39 percent lost money.' } : x,
            ),
          }
        : b,
    ),
  }));
  const scenario = join(f.root, 'scenario.json');
  writeFileSync(
    scenario,
    JSON.stringify([
      {
        match: 'article-review\\.md[\\s\\S]*Mode: reaffirm',
        actions: [
          {
            write: rel(join(f.dir, ARTICLE_FILES.review)),
            text: JSON.stringify({
              reviewer: 'fake',
              date: '2026-12-01',
              revision: 1,
              approved: {},
              findings: [],
              reaffirm: opts.reaffirm
                ? {
                    ok: true,
                    why: 'the sentence reports the earlier survey as a survey; the new one does not contradict it',
                  }
                : { ok: false, why: 'the sentence states the 47 percent as the finding, which the new survey revises' },
            }),
          },
        ],
        cost: 0.3,
      },
      {
        match: 'article\\.md[\\s\\S]*Mode: correction',
        actions: [{ write: rel(join(f.dir, ARTICLE_FILES.article)), text: JSON.stringify(corrected) }],
        cost: 0.4,
      },
      {
        match: 'article-review\\.md[\\s\\S]*Mode: correction',
        actions: [
          {
            write: rel(join(f.dir, ARTICLE_FILES.review)),
            text: JSON.stringify({
              reviewer: 'fake',
              date: '2026-12-01',
              revision: 2,
              approved: {},
              findings: [{ severity: 'info', text: 'the year is now in the sentence' }],
            }),
          },
        ],
        cost: 0.3,
      },
    ]),
  );
  const config = join(f.root, 'article-config.json');
  writeFileSync(config, JSON.stringify({ validation: opts.validation ?? 'passed' }));
  const log = join(f.root, 'article-calls.log');
  const env = {
    ...process.env,
    FAKE_CLAUDE_SCENARIO: scenario,
    FAKE_ARTICLE_CONFIG: config,
    FAKE_ARTICLE_LOG: log,
    VK_NO_DOTENV: '1',
    APPROVAL_SECRET: 'a-test-secret-of-some-length',
  };
  const argvOf = (cli: string, args: string[]): [string, string[]] =>
    cli === 'article' && ['validate', 'reaffirm'].includes(args[0])
      ? [process.execPath, [FAKE_ARTICLE, ...args]]
      : cliArgv(cli, args);
  const mail = new FakeMailer(f.root);
  const run = (over: { stories?: string[] | undefined; a?: typeof a } = {}) =>
    articleWork(f.topic, over.a ?? a, {
      now: () => T0,
      mail,
      env,
      argvOf,
      hooks: { snapshot: () => {}, guard: () => ({ ok: true, why: '', kept: [] }) },
      root: f.root,
      runId: 'm1',
      ...('stories' in over ? { stories: over.stories } : { stories: [f.story] }),
    });
  const calls = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : []);
  const releaseNow = () => readJson<ArticleRelease>(join(f.dir, ARTICLE_FILES.release))!;
  return { f, mail, run, calls, releaseNow };
}

describe('articleWork (criterion 10)', () => {
  it('a revision on a cited claim: the reviewer reaffirms and automation records it with the why; no request, no mail', async () => {
    const c = staged({ revised: MLM, reaffirm: true });
    const r = await c.run();
    expect(r.halted).toEqual([]);
    expect(r.actions.join('\n')).toMatch(/article reaffirmed \(the sentence reports the earlier survey/);
    expect(
      c.calls().some((x) => /^reaffirm .*--approved-by automated: maintenance m1 --note the sentence reports/.test(x)),
    ).toBe(true);
    expect(c.releaseNow().history.at(-1)).toMatchObject({ reaffirmed: true, approvedBy: 'automated: maintenance m1' });
    expect(loadArticleRequest(c.f.topic, c.f.story, c.f.root)).toBeNull();
    expect(c.mail.sent).toEqual([]);
  }, 180_000);

  it('a revision on a cited claim the text cannot stand: writer, reviewer, validate, then a correction request mailed with the sentences before and after; nothing released', async () => {
    const c = staged({ revised: MLM, reaffirm: false });
    const r = await c.run();
    expect(r.halted).toEqual([]);
    expect(r.actions.join('\n')).toMatch(/correction requested \(ar-/);
    const calls = c.calls();
    expect(calls.filter((x) => x.startsWith('validate')).length).toBeGreaterThanOrEqual(2); // the inspection's, the agents', the last
    expect(calls.some((x) => x.startsWith('reaffirm'))).toBe(false);
    const req = loadArticleRequest(c.f.topic, c.f.story, c.f.root)!;
    expect(req.request).toMatch(/^ar-/);
    expect(c.mail.sent).toHaveLength(1);
    const m = c.mail.sent[0];
    expect(m.subject).toContain(req.request);
    expect(m.text).toMatch(
      /- s02\n\s+was: Of 601 people surveyed, 47 percent lost money\.\n\s+now: Of 2,000 people surveyed in 2026, 39 percent lost money\./,
    );
    expect(m.text).toMatch(/Reply OK to release the correction/);
    expect(req.messageId).toBe(m.messageId);
    expect(c.releaseNow().revision).toBe(1); // not released: a person decides
    // M3: the writer and the reviewer lines carry their usage; their attempts sit under the journal lines
    const prompts = readJournal(runDir(c.f.topic, c.f.story, c.f.root)).filter((e) => e.kind === 'prompt');
    expect(prompts.length).toBeGreaterThanOrEqual(2);
    for (const e of prompts) expect(e.models?.[0]?.model).toBe('fake-sonnet');
    expect(readAttempts(runDir(c.f.topic, c.f.story, c.f.root)).length).toBe(prompts.length);
    // the next pass finds the open request and changes nothing
    const again = await c.run();
    expect(again.actions.join('\n')).toMatch(/correction requested \(ar-.*awaiting the person/);
    expect(c.mail.sent).toHaveLength(1);
    expect(c.calls().length).toBe(calls.length + 1); // the second pass: one validation, no writer, no reviewer
  }, 180_000);

  it('without a story list, the pass finds every released article, even one stories.json no longer lists (review finding 3)', async () => {
    const c = staged({ revised: MLM, reaffirm: true });
    const sp = join(c.f.root, 'topics', c.f.topic, 'stories.json');
    const stories = readJson<{ stories: { id: string }[] }>(sp)!;
    writeFileSync(sp, toJson({ ...stories, stories: stories.stories.filter((s) => s.id !== c.f.story) }));
    const r = await c.run({ stories: undefined });
    expect(r.actions.join('\n')).toMatch(/article reaffirmed/);
  }, 180_000);

  it('the correction mail shows every unit that changed, a headline or a table as much as a sentence (review finding 8)', () => {
    const c = staged({ revised: MLM, reaffirm: false });
    const art = readJson<ArticleRelease>(join(c.f.dir, ARTICLE_FILES.release))!.article;
    const changed = { ...art, meta: { ...art.meta, headline: `${art.meta.headline} (revised)` } };
    writeFileSync(join(c.f.dir, ARTICLE_FILES.article), toJson(changed));
    const req = {
      request: 'ar-000000000001',
      fingerprint: 'fp',
      at: '2026-12-01T00:00:00Z',
      expiresAt: '2026-12-08T00:00:00Z',
      by: 'automated: maintenance t',
    };
    const m = renderCorrectionRequest(c.f.topic, c.f.story, req, a, c.f.root);
    expect(m.text).toMatch(/- meta\.headline\n\s+was: .*\n\s+now: .*\(revised\)/);
    expect(m.text).not.toMatch(/the text is unchanged/);
  });

  it('a revision on a claim the article does not cite: nothing happens', async () => {
    const c = staged({ revised: 'demo/some-other-claim' });
    const r = await c.run();
    expect(r).toEqual({ actions: [], halted: [] });
    expect(c.mail.sent).toEqual([]);
    expect(c.calls().filter((x) => !x.startsWith('validate'))).toEqual([]);
  }, 180_000);

  it('M3 1.5: the pass checks perRun over its own journal since its start before each agent: the third agent halts budget with the figures, nothing mailed', async () => {
    const c = staged({ revised: MLM, reaffirm: false });
    const tight = { ...a, agents: { ...a.agents, budgetUsd: { ...a.agents.budgetUsd, perAgent: 0.5, perRun: 1.0 } } };
    const r = await c.run({ a: tight });
    // the reaffirm reviewer (0.3) and the correction writer (0.4) ran; the correction reviewer would exceed the run
    expect(r.halted).toHaveLength(1);
    expect(r.halted[0]).toMatch(/budget/);
    const h = readHalt(runDir(c.f.topic, c.f.story, c.f.root))!;
    expect(h.kind).toBe('budget');
    expect(h.why).toMatch(/pass 0\.70 of 1 USD/);
    expect(h.why).toMatch(/the next agent may cost 0\.5/);
    const prompts = readJournal(runDir(c.f.topic, c.f.story, c.f.root)).filter((e) => e.kind === 'prompt');
    expect(prompts).toHaveLength(2);
    expect(c.mail.sent).toEqual([]);
    expect(loadArticleRequest(c.f.topic, c.f.story, c.f.root)).toBeNull();
  }, 180_000);
  it('M3 1.5: the week check still applies before the first agent', async () => {
    const c = staged({ revised: MLM, reaffirm: true });
    const { addSpend, isoWeek } = await import('../../src/orchestration/run/runner');
    addSpend(c.f.root, isoWeek(new Date(T0)), 199.8);
    const r = await c.run();
    expect(r.halted).toHaveLength(1);
    expect(readHalt(runDir(c.f.topic, c.f.story, c.f.root))?.kind).toBe('budget');
    expect(readHalt(runDir(c.f.topic, c.f.story, c.f.root))?.why).toMatch(/week 199\.80 of 200 USD/);
    expect(readJournal(runDir(c.f.topic, c.f.story, c.f.root)).filter((e) => e.kind === 'prompt')).toHaveLength(0);
  }, 180_000);

  it('a correction that keeps failing validation halts awaiting-person after three revisions', async () => {
    const c = staged({ revised: MLM, reaffirm: false, validation: 'blocked' });
    for (let i = 0; i < 3; i++) {
      const r = await c.run();
      expect(r.halted, `pass ${i + 1}`).toEqual([]);
      expect(r.actions.join('\n')).toMatch(new RegExp(`does not pass yet \\(revision ${i + 1}\\)`));
    }
    const r = await c.run();
    expect(r.halted).toHaveLength(1);
    expect(r.halted[0]).toMatch(/awaiting-person/);
    expect(readHalt(runDir(c.f.topic, c.f.story, c.f.root))?.kind).toBe('awaiting-person');
    expect(c.mail.sent).toEqual([]);
  }, 240_000);
});
