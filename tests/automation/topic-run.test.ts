// The topic runner (spec §5.2, §13 criterion 1 and criterion 16's topic rows; phase 5 Task 4): an approved proposal
// researched to a ready story by fake agents over a fake watcher and research CLIs, the stage sequence journaled,
// record resumed with --from after a partial failure, the parked paths (thin after two empty study rounds; a review
// that keeps nothing), the research roles contained, a forbidden flag refused, and one commit touching one topic.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { cliArgv } from '../../src/shared/cli';
import { ROOT, readJson, toJson } from '../../src/shared/io';
import type { Proposal, ProposalReview } from '../../src/shared/types';
import { proposalPath, reviewPath } from '../../src/modules/topic-discovery/proposals';
import { loadStories } from '../../src/modules/stories';
import { readHalt, readJournal } from '../../src/orchestration/run/journal';
import { RECORDED_FILE, runTopic, topicRunFolder } from '../../src/orchestration/run/topic-runner';
import { topicNext } from '../../src/orchestration/research';
import { topicJobs } from '../../src/orchestration/run/work';
import { cliRoot } from '../production-helpers';

const FAKE_CLAUDE = join(ROOT, 'tests', 'automation', 'fake-claude.mjs');
const FAKE_CLI = join(ROOT, 'tests', 'automation', 'fake-research-cli.mjs');
const FIX = join(ROOT, 'tests', 'fixtures', 'proposals');
const T = 'ev-running-costs';
const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })), 120_000);
const a = {
  ...DEFAULTS,
  topics: { ...DEFAULTS.topics, minSources: 3, minStudies: 2, minDecided: 0.5 },
  runs: { ...DEFAULTS.runs, maxParallelAgents: 2, timeoutsPerStep: 3 },
  agents: { ...DEFAULTS.agents, command: `node ${FAKE_CLAUDE}` },
};
const VIDEOS = ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'].map((id) => `https://www.youtube.com/watch?v=${id}`);
const CLAIMS = [
  'Electric cars repay their purchase premium through fuel savings within a few years',
  'Electric car batteries degrade so fast that a replacement wipes out the fuel saving',
  'Insurance premiums for electric cars run higher than for comparable petrol cars',
  'Electric cars wear through tyres faster than petrol cars because they are heavier',
];
const h1 = () =>
  toJson([
    {
      video: 'aaaaaaaaaaa',
      sum: 's',
      as: [
        { n: CLAIMS[0], q: 'q', v: ['right', 0.5, 'n'], l: 'pro' },
        { n: CLAIMS[1], q: 'q', v: ['wrong', 0.5, 'n'], l: 'skeptic' },
      ],
    },
    {
      video: 'bbbbbbbbbbb',
      sum: 's',
      as: [
        { n2: CLAIMS[0], q: 'q' },
        { n: CLAIMS[2], q: 'q', v: ['partly', 0.5, 'n'] },
      ],
    },
    {
      video: 'ccccccccccc',
      sum: 's',
      as: [
        { n: CLAIMS[3], q: 'q', v: ['partly', 0.5, 'n'] },
        { n2: CLAIMS[1], q: 'q' },
      ],
    },
  ]);
const slugOf = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
const sv = () =>
  toJson(
    CLAIMS.slice(0, 3).map((c, i) => ({
      claim: `${T}/${slugOf(c)}`,
      verdict: i === 1 ? 'wrong' : 'right',
      confidence: 0.8,
      note: 'n',
      source: `${T}/sources/d${(i % 2) + 1}.txt#L3-L4`,
      applicability: 'direct',
    })),
  );

interface Scenario {
  studiesEmpty?: boolean;
  extractionWritesStore?: boolean;
}
function fresh(cfg: Record<string, unknown> = {}, s: Scenario = {}) {
  const root = mkdtempSync(join(tmpdir(), 'vk-topic-run-'));
  roots.push(root);
  cliRoot(root);
  writeFileSync(
    join(root, '.gitignore'),
    '.automation/\ntopics/*/work/\n.fake-record-failed\nscenario.json\nconfig.json\n',
  );
  mkdirSync(join(root, 'proposals'), { recursive: true });
  const proposal = readJson<Proposal>(join(FIX, 'good.json'))!;
  writeFileSync(
    proposalPath(T, root),
    toJson({ ...proposal, status: 'approved', decidedBy: 'Jon', decidedAt: '2026-11-06T18:00:00Z' }),
  );
  writeFileSync(reviewPath(T, root), toJson(readJson<ProposalReview>(join(FIX, 'good.review.json'))!));
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q');
  git('checkout', '-q', '-b', 'main');
  git('config', 'core.autocrlf', 'false');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  git('add', '-A');
  git('commit', '-q', '-m', 'fixture');
  const scenario = join(root, 'scenario.json');
  const docs = s.studiesEmpty
    ? []
    : [
        {
          write: `topics/${T}/sources/d1.txt`,
          text: 'Source: https://x.test/d1 (retrieved 2026-11-01)\n\nA study.\nIt decides the claim.\n',
        },
        {
          write: `topics/${T}/sources/d2.txt`,
          text: 'Source: https://x.test/d2 (retrieved 2026-11-01)\n\nAnother study.\nIt decides another claim.\n',
        },
      ];
  writeFileSync(
    scenario,
    JSON.stringify([
      {
        match: 'collect\\.md',
        actions: [
          { write: `topics/${T}/videos.txt`, text: `# --- Batch 1, discovery\n${VIDEOS.join('\n')}\n` },
          { write: `topics/${T}/blogs.txt`, text: '' },
        ],
        cost: 0.5,
      },
      {
        match: 'extract\\.md[\\s\\S]*Group: 1',
        actions: s.extractionWritesStore
          ? [
              { write: `topics/${T}/work/h1.json`, text: h1() },
              { write: `topics/${T}/store/topics.json`, text: '{"topics":[]}' },
            ]
          : [{ write: `topics/${T}/work/h1.json`, text: h1() }],
        cost: 0.4,
      },
      {
        match: 'merge\\.md',
        actions: [
          { write: `topics/${T}/work/merges.json`, text: '{}' },
          { write: `topics/${T}/work/distinct.json`, text: '[]' },
        ],
        cost: 0.2,
      },
      {
        match: 'studies\\.md',
        actions: docs,
        cost: 0.3,
        result: docs.length
          ? 'd1.txt: claim 1; d2.txt: claims 2 and 3'
          : 'nothing found: searched Europe PMC, CFPB, DOE',
      },
      { match: 'sources\\.md', actions: [{ write: `topics/${T}/work/sv_1.json`, text: sv() }], cost: 0.3 },
      {
        match: 'revision-note\\.md',
        actions: [],
        cost: 0.1,
        result: `${T}/${slugOf(CLAIMS[0])}: A 2024 meta-analysis now decides it; the finding moved from unknown to supported.`,
      },
      { match: 'stories\\.md', actions: [{ write: `topics/${T}/story-review.json`, text: '{}' }], cost: 0.3 },
    ]),
  );
  const config = join(root, 'config.json');
  writeFileSync(config, JSON.stringify({ openRevisions: 1, ...cfg }));
  const env = {
    ...process.env,
    FAKE_CLAUDE_SCENARIO: scenario,
    FAKE_RESEARCH_CONFIG: config,
    VK_NO_DOTENV: '1',
    APPROVAL_SECRET: 'a-test-secret-of-some-length',
  };
  // the topics verbs are the real CLI (they write the proposal); every other CLI is the fake
  const argvOf = (cli: string, args: string[]): [string, string[]] =>
    cli === 'topics' ? cliArgv(cli, args) : [process.execPath, [FAKE_CLI, cli, ...args]];
  // the institution claim is the claim verb's own test (Task 5): here the topic reads as claimed
  const ask: typeof topicNext = (t, r, o) => topicNext(t, r, { ...o, owner: () => ({ name: 'Spending' }) as never });
  const run = (extra: Partial<Parameters<typeof runTopic>[2]> = {}) =>
    runTopic(T, a, {
      root,
      env,
      argvOf,
      ask,
      validate: () => ({ ok: true, output: '' }),
      now: () => Date.parse('2026-11-07T10:00:00Z'),
      ...extra,
    });
  const journal = () => readJournal(topicRunFolder(T, root));
  const stages = () => [
    ...new Set(
      journal()
        .filter((e) => e.kind !== 'resume')
        .map((e) => e.stage),
    ),
  ];
  return { root, git, run, journal, stages, proposal: () => readJson<Proposal>(proposalPath(T, root))! };
}

describe('the topic runner (criterion 1)', () => {
  it('researches an approved proposal to a ready story: the stage sequence, the markers, the notes, one commit touching one topic', async () => {
    const c = fresh();
    const r = await c.run();
    expect(r.outcome, JSON.stringify(r.halt)).toBe('done');
    expect(r.stage).toBe('ready');
    expect(c.stages()).toEqual([
      'lists',
      'fetch',
      'extract',
      'merge',
      'studies',
      'report',
      'stories',
      'review',
      'ready',
    ]);
    const stories = loadStories(T, c.root)!;
    expect(stories.stories[0].readiness).toBe('ready');
    const marker = readJson<{ files: string[]; documents: string[]; extracted: string[] }>(
      join(topicRunFolder(T, c.root), RECORDED_FILE),
    )!;
    expect(marker.files).toEqual(['work/h1.json', 'work/sv_1.json']);
    expect(marker.documents.sort()).toEqual(['d1.txt', 'd2.txt']);
    expect(marker.extracted.length).toBeGreaterThan(0); // every source handed to an extraction agent, found or not
    // the store: every source extracted, the claims recorded, the study verdicts on them
    const store = readJson<{ topics: { claims: unknown[] }[] }>(join(c.root, 'topics', T, 'store', 'topics.json'))!;
    expect(store.topics[0].claims).toHaveLength(4);
    // the revision note the agent drafted was recorded through report -- note
    const pr = readJson<{ revisions: { note: string }[] }>(join(c.root, 'topics', T, 'public-record.json'))!;
    expect(pr.revisions[0].note).toMatch(/2024 meta-analysis/);
    expect(c.journal().some((e) => /^npm run report -- note/.test(e.step))).toBe(true);
    // the parallel-capable prompts: one extraction group here; sessions differ between the writer roles
    const prompts = c.journal().filter((e) => e.kind === 'prompt');
    expect(new Set(prompts.map((e) => e.sessionId)).size).toBe(prompts.length);
    expect(prompts.map((e) => /briefs\/([\w-]+\.md)/.exec(e.step)?.[1])).toEqual([
      'collect.md',
      'extract.md',
      'merge.md',
      'studies.md',
      'sources.md',
      'revision-note.md',
      'stories.md',
    ]);
    // one commit, touching the topic's own paths only
    expect(c.git('rev-list', '--count', 'main').trim()).toBe('2');
    const touched = c.git('show', '--name-only', '--format=', 'HEAD').trim().split('\n');
    expect(touched.length).toBeGreaterThan(0);
    for (const p of touched) expect(p.startsWith(`topics/${T}/`) || p.startsWith('proposals/')).toBe(true);
    expect(touched).not.toContain(`topics/${T}/work/h1.json`); // work/ is gitignored
    expect(readHalt(topicRunFolder(T, c.root))).toBeNull();
    expect(c.proposal().status).toBe('approved');
    expect(topicJobs(c.root, () => false)).toEqual([]); // researched: no job left
    expect(r.costUsd).toBeCloseTo(2.1, 5);
  }, 240_000);

  it("a merge agent that leaves collisions open after its rounds is followed by collide --resolve (the runner's last resort) and the run goes on", async () => {
    const c = fresh({ collisionsOpen: true });
    const r = await c.run();
    expect(r.outcome, JSON.stringify(r.halt)).toBe('done');
    const steps = c.journal().map((e) => e.step);
    const merge = steps.findIndex((s) => /merge\.md/.test(s));
    const resolve = steps.findIndex((s) => /^npm run evidence -- collide \S+ --resolve$/.test(s));
    expect(merge).toBeGreaterThanOrEqual(0);
    expect(resolve).toBe(merge + 1);
    expect(c.journal()[merge].error).toMatch(/check-merges/);
    expect(steps.slice(resolve + 1).some((s) => /^npm run merge-claims/.test(s))).toBe(true);
    expect(readHalt(topicRunFolder(T, c.root))).toBeNull();
  }, 240_000);

  it('a run halted after the merge agent resumes without paying for it again: its merges.json passes check-merges, so the agent step is a checkpoint', async () => {
    const c = fresh({ recordFailAt: 'bbbbbbbbbbb', recordFailTimes: 2 });
    const first = await c.run();
    expect(first.outcome).toBe('halted');
    expect(first.halt?.kind).toBe('step-failed');
    expect(first.halt?.why).toMatch(/record/);
    const second = await c.run();
    expect(second.outcome, JSON.stringify(second.halt)).toBe('done');
    const j = c.journal();
    expect(j.filter((e) => e.kind === 'prompt' && /merge\.md/.test(e.step))).toHaveLength(1);
    const check = j.findIndex((e) => /^npm run evidence -- check-merges /.test(e.step) && e.exit === 0);
    expect(check).toBeGreaterThan(j.findIndex((e) => e.kind === 'resume'));
    expect(j.filter((e) => e.kind === 'prompt' && /extract\.md/.test(e.step))).toHaveLength(1); // h1 passes check-batch too
  }, 240_000);

  it('a record that fails mid-batch is resumed with --from the next source, never re-recording the first', async () => {
    const c = fresh({ recordFailAt: 'bbbbbbbbbbb' });
    const r = await c.run();
    expect(r.outcome, JSON.stringify(r.halt)).toBe('done');
    const records = c.journal().filter((e) => /^npm run record -- /.test(e.step));
    expect(records).toHaveLength(2);
    expect(records[0].exit).toBe(1);
    expect(records[1].step).toMatch(/--from bbbbbbbbbbb$/);
    expect(records[1].exit).toBe(0);
    const store = readJson<{ topics: { claims: unknown[] }[] }>(join(c.root, 'topics', T, 'store', 'topics.json'))!;
    expect(store.topics[0].claims).toHaveLength(4);
  }, 240_000);

  it('criterion 16: a topic whose studies agent adds nothing twice is parked as thin with the shortfall, no halt, the run done', async () => {
    const c = fresh({}, { studiesEmpty: true });
    const r = await c.run();
    expect(r.outcome, JSON.stringify(r.halt)).toBe('done');
    expect(r.stage).toBe('parked');
    expect(c.proposal().status).toBe('parked');
    expect(c.proposal().parkedWhy).toMatch(/thin.*0 of the 2 study documents/);
    expect(c.proposal().parkedWhy).toMatch(/2 study rounds that added nothing/);
    expect(c.journal().filter((e) => /studies\.md/.test(e.step))).toHaveLength(2);
    expect(readHalt(topicRunFolder(T, c.root))).toBeNull();
    expect(c.journal().some((e) => /topics -- park/.test(e.step))).toBe(true);
  }, 240_000);

  it("criterion 16: a story review that keeps nothing parks the topic with the reviewer's reasons", async () => {
    const c = fresh({ storiesMode: 'keptNone' });
    const r = await c.run();
    expect(r.outcome, JSON.stringify(r.halt)).toBe('done');
    expect(c.proposal().status).toBe('parked');
    expect(c.proposal().parkedWhy).toMatch(/kept no story.*loosely related/);
    expect(c.stages()).toContain('review');
  }, 240_000);

  it('an extraction agent that writes the store is reverted and halts unexpected-edit; a record-sources refusal halts needs-person', async () => {
    const c = fresh({}, { extractionWritesStore: true });
    const r = await c.run();
    expect(r.outcome).toBe('halted');
    expect(r.halt?.kind).toBe('unexpected-edit');
    expect(r.halt?.why).toMatch(/restored topics\/ev-running-costs\/store\/topics\.json/);
    expect(existsSync(join(c.root, 'topics', T, 'store', 'topics.json'))).toBe(true); // the fetch wrote it; the agent's version is gone
    expect(readFileSync(join(c.root, 'topics', T, 'store', 'topics.json'), 'utf8')).not.toBe('{"topics":[]}');
    const d = fresh({ refuseCited: true });
    const r2 = await d.run();
    expect(r2.outcome).toBe('halted');
    expect(r2.halt?.kind).toBe('needs-person');
    expect(r2.halt?.why).toMatch(/record-sources/);
    expect(r2.halt?.unblock.text).toMatch(/--replace-cited/);
  }, 240_000);

  it('a board step carrying --replace-cited halts forbidden-flag before anything runs', async () => {
    const c = fresh();
    const r = await c.run({
      ask: () => ({
        topic: T,
        stage: 'studies',
        next: `npm run record-sources -- ${T} topics/${T}/work/sv_1.json --replace-cited`,
        steps: [{ kind: 'run', text: `npm run record-sources -- ${T} topics/${T}/work/sv_1.json --replace-cited` }],
        halt: null,
        done: false,
      }),
    });
    expect(r.outcome).toBe('halted');
    expect(r.halt?.kind).toBe('forbidden-flag');
    expect(c.journal().filter((e) => e.kind === 'run')).toHaveLength(0);
  });
});
