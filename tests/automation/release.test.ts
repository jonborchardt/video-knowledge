// The release loop (phase 2 Task 5, spec §5.3, §7.2, §7.3) over the real CLIs with the fake YouTube client
// (YOUTUBE_FAKE): a packaged release build with two packaged Shorts is uploaded private, verified and requested once;
// YouTube's processing is retried without a no-progress halt; a re-packaged Short voids the request; a Short's upload
// failure halts only that Short; a crash between an upload and its journal line leaves one upload; the draft review
// by policy (person, shadow, agent) records what the spec says and nothing else.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadAutomation } from '../../src/shared/automation';
import { MANIFEST_FILE, REVIEW_DIR, ROOT, readJson, sha, shortId, toJson } from '../../src/shared/io';
import { discoverShorts, loadShortParent, shortsPath } from '../../src/modules/shorts';
import { emptyFakeState, readFakeState, writeFakeState } from '../../src/modules/publishing/fake-youtube';
import { addOutputTo, loadLedger, openOutput, recordChangesRequested } from '../../src/modules/publishing/publish';
import { runCli } from '../../src/shared/cli';
import { type Halt, clearHalt, readJournal, runDir, writeHalt } from '../../src/orchestration/run/journal';
import {
  DRAFT_ACCEPTED_FILE,
  readShadow,
  releasePending,
  shadowAgreement,
  recordShadowAgent,
  recordShadowPerson,
  syncShadowFromLedger,
} from '../../src/orchestration/run/release';
import { NOTES_PASS_FILE, type RunOptions, runStory } from '../../src/orchestration/run/runner';
import { type StepContext, execStep } from '../../src/orchestration/run/steps';
import { renderDigest } from '../../src/orchestration/run/digest';
import type { Step } from '../../src/orchestration/production';
import type { Automation } from '../../src/shared/automation';
import { DEFAULTS } from '../../src/shared/automation';
import type { Script } from '../../src/shared/types';
import { releaseJobs } from '../../src/orchestration/run/work';
import { type Fixture, afterFinal, cliRoot, syntheticProduction } from '../production-helpers';

const fixtures: Fixture[] = [];
afterAll(() => fixtures.forEach((f) => f.cleanup()), 120_000); // many temp roots: slow under full-suite load
const noGuard = {
  snapshot: () => {},
  guard: () => ({ ok: true, why: '', kept: [] as string[] }),
  componentCheck: () => ({ ok: true, output: '' }),
};
const SECRET = 'a-test-secret-of-some-length';
const FAKE_CLAUDE = join(ROOT, 'tests', 'automation', 'fake-claude.mjs');

/** A packaged fixture with media the fake can "upload", `n` packaged Shorts registered in its ledger, an empty
 *  shorts.json (nothing owed) and the fake YouTube state file. */
function staged(opts: { release?: boolean; shorts?: number } = {}) {
  const f = syntheticProduction('packaged', { release: opts.release ?? true });
  fixtures.push(f);
  cliRoot(f.root);
  const media = (dir: string, name: string, bytes: Buffer) => {
    const review = join(dir, 'video', REVIEW_DIR);
    mkdirSync(review, { recursive: true });
    writeFileSync(join(review, name), bytes);
    writeFileSync(join(review, 'thumbnail.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const rp = join(review, 'review.json');
    writeFileSync(rp, toJson({ ...readJson<object>(rp)!, mp4: name, mp4Sha: sha(bytes) }));
    return sha(bytes);
  };
  const mainSha = media(f.dir, 'fixture.mp4', Buffer.alloc(2048, 7));
  const shorts: string[] = [];
  for (let i = 0; i < (opts.shorts ?? 2); i++) {
    const slug = ['one', 'two', 'three'][i];
    const dir = join(f.dir, 'shorts', slug);
    mkdirSync(join(dir, 'video', REVIEW_DIR), { recursive: true });
    writeFileSync(
      join(dir, 'video', REVIEW_DIR, 'review.json'),
      toJson({
        generatedAt: '2026-01-01',
        status: 'release build',
        buildReport: `br-${slug}`,
        mp4: `short-${slug}.mp4`,
        mp4Sha: 'x',
        thumbnailSha: 'thumbsha',
        captionsSha: null,
        seconds: 7.5,
        title: `Short ${slug}`,
        chapters: [],
        short: { parent: f.story, slug, format: 'ONE FIGURE FROM THE RECORD', fullVideo: null },
      }),
    );
    writeFileSync(join(dir, 'video', REVIEW_DIR, 'description.txt'), `Short ${slug}\n`);
    media(dir, `short-${slug}.mp4`, Buffer.alloc(512 + i, 9));
    addOutputTo(f.topic, f.story, `short:${slug}`, 'youtube-short', {
      derivedFrom: 'youtube',
      source: relative(f.root, dir).replaceAll('\\', '/'),
      root: f.root,
    });
    shorts.push(`short:${slug}`);
  }
  writeFileSync(
    shortsPath(f.topic, f.story, f.root),
    toJson(discoverShorts(loadShortParent(f.topic, f.story, f.root), null)),
  );
  const fake = join(f.root, 'youtube-fake.json');
  writeFakeState(fake, emptyFakeState());
  const env = { ...process.env, YOUTUBE_FAKE: fake, APPROVAL_SECRET: SECRET, VK_NO_DOTENV: '1' };
  const a = loadAutomation(join(f.root, 'no-automation-file'));
  const run = (o: Partial<RunOptions> = {}, auto = a) =>
    runStory(f.topic, f.story, auto, {
      approver: 'automated: release test',
      root: f.root,
      git: 'none',
      validate: () => ({ ok: true, output: '' }),
      hooks: noGuard,
      env,
      ...o,
    });
  const events = (output = 'youtube') => loadLedger(f.topic, f.story, f.root)?.outputs[output]?.events ?? [];
  const calls = () => readFakeState(fake).calls;
  return { f, a, env, fake, run, events, calls, mainSha, shorts };
}
const publicUpdates = (calls: { method: string; args: unknown[] }[]) =>
  calls.filter(
    (c) =>
      c.method === 'updateVideo' &&
      (c.args[1] as { status?: { privacyStatus?: string } })?.status?.privacyStatus === 'public',
  );

describe('the release loop over the fake YouTube', () => {
  it('uploads the video and its Shorts private, verifies them, requests approval once and halts for the person', async () => {
    const s = staged();
    expect(releasePending(s.f.topic, s.f.story, s.a, s.f.root)).toMatch(/youtube: upload/);
    const r = await s.run();
    expect(r.outcome).toBe('halted');
    expect(r.halt?.kind).toBe('awaiting-person');
    expect(r.halt?.unblock.text).toMatch(/reply OK/);
    for (const id of ['youtube', ...s.shorts]) {
      const up = s.events(id).filter((e) => e.type === 'uploaded');
      expect(up).toHaveLength(1);
      expect(up[0].visibility).toBe('private');
      expect(up[0].buildStatus).toBe('release');
      expect(s.events(id).filter((e) => e.type === 'verified' && e.result === 'passed')).toHaveLength(1);
    }
    const req = s.events().filter((e) => e.type === 'approval-requested');
    expect(req).toHaveLength(1);
    expect(req[0].outputs).toEqual(['youtube', ...s.shorts]);
    expect(publicUpdates(s.calls())).toEqual([]);
    expect(existsSync(join(s.f.dir, 'video', REVIEW_DIR, MANIFEST_FILE))).toBe(true);
    expect(releasePending(s.f.topic, s.f.story, s.a, s.f.root)).toBeNull();
    // a second run adds nothing: the request stands, the halt says the same
    const again = await s.run();
    expect(again.halt?.kind).toBe('awaiting-person');
    expect(s.events().filter((e) => e.type === 'approval-requested')).toHaveLength(1);
    expect(s.calls().filter((c) => c.method === 'insertVideo')).toHaveLength(3);
  }, 600_000);

  it('a pending verification is retried by a retryable halt, never counted as no progress', async () => {
    const s = staged({ shorts: 1 });
    writeFakeState(s.fake, { ...emptyFakeState(), slowProcessing: 2 }); // pending twice: once more in the run, then the halt
    const kinds: string[] = [];
    let r = await s.run();
    for (let i = 0; i < 6 && r.halt?.kind !== 'awaiting-person'; i++) {
      kinds.push(`${r.halt?.kind}${r.halt?.retryable ? '+' : ''}`);
      r = await s.run();
    }
    expect(kinds.every((k) => k === 'step-failed+')).toBe(true);
    expect(kinds.length).toBeGreaterThanOrEqual(1);
    expect(r.halt?.kind).toBe('awaiting-person');
    expect(kinds).not.toContain('no-progress');
    expect(s.events().filter((e) => e.type === 'approval-requested')).toHaveLength(1);
    expect(
      readJournal(runDir(s.f.topic, s.f.story, s.f.root)).filter((e) => e.kind === 'halt' && e.step === 'no-progress'),
    ).toEqual([]);
  }, 600_000);

  it('a re-packaged Short after the request voids it; the next loop re-uploads only that Short and re-requests', async () => {
    const s = staged({ shorts: 1 });
    await s.run();
    const first = s.events().find((e) => e.type === 'approval-requested')!;
    const dir = join(s.f.dir, 'shorts', 'one');
    const bytes = Buffer.alloc(777, 1);
    writeFileSync(join(dir, 'video', REVIEW_DIR, 'short-one.mp4'), bytes);
    const rp = join(dir, 'video', REVIEW_DIR, 'review.json');
    writeFileSync(rp, toJson({ ...readJson<object>(rp)!, mp4Sha: sha(bytes) }));
    expect(releasePending(s.f.topic, s.f.story, s.a, s.f.root)).toMatch(/short:one: upload/);
    const r = await s.run();
    expect(r.halt?.kind).toBe('awaiting-person');
    expect(s.events('short:one').filter((e) => e.type === 'uploaded')).toHaveLength(2);
    expect(s.events('youtube').filter((e) => e.type === 'uploaded')).toHaveLength(1);
    const reqs = s.events().filter((e) => e.type === 'approval-requested');
    expect(reqs).toHaveLength(2);
    expect(reqs[1].request).not.toBe(first.request);
    expect(s.events().find((e) => e.type === 'decided' && e.request === first.request)?.verdict).toBe('void');
  }, 600_000);

  it('a verification that still fails after a push halts for the person instead of pushing again (the fixture ping-pong)', async () => {
    const s = staged({ shorts: 0 });
    writeFakeState(s.fake, { ...emptyFakeState(), tagsHeld: ['something else'] });
    const r = await s.run();
    expect(r.halt?.kind).toBe('awaiting-person');
    expect(r.halt?.why).toMatch(/still fails after a push: tags/);
    expect(s.events().filter((e) => e.type === 'updated')).toHaveLength(1); // one push, not thirty
    expect(s.calls().filter((c) => c.method === 'updateVideo')).toHaveLength(1);
  }, 600_000);

  it("a Short produced in this pass clears its earlier halt: the parent goes on to the Short's draft (the fixture's stale halt)", async () => {
    const s = staged({ shorts: 0 });
    // shorts.json names one ready candidate whose folder holds an earlier run's halt and no package yet
    writeFileSync(
      shortsPath(s.f.topic, s.f.story, s.f.root),
      toJson({
        topic: s.f.topic,
        story: s.f.story,
        parentFingerprints: { script: '', validation: '', storyboard: '', package: '', release: null },
        rejected: [],
        candidates: [
          {
            key: 's02',
            scene: 'sc2',
            section: 'answer',
            sentences: ['s02'],
            claims: [],
            cites: [],
            figures: [],
            chart: null,
            qualifications: [],
            reviewed: true,
            slug: 'one',
            format: 'ONE FIGURE FROM THE RECORD',
            hook: 'One figure.',
            carries: [],
            readiness: 'ready',
            blocking: [],
          },
        ],
      }),
    );
    const shortDir = join(s.f.dir, 'shorts', 'one');
    const stale: Halt = {
      kind: 'no-progress',
      stage: 'scored',
      why: 'the board still says package',
      unblock: { kind: 'fix', text: 'read the run' },
      at: 'a',
      runId: 'r',
      board: { stage: 'scored', next: '' },
    };
    writeHalt(runDir(s.f.topic, shortId(s.f.story, 'one'), s.f.root), stale);
    const ran: string[] = [];
    const r = await s.run({
      // the real discover would rewrite shorts.json from the synthetic script (no candidates): the step stands in
      exec: async (a, step, ctx) =>
        /shorts -- discover/.test(step.text)
          ? { kind: 'run', ok: true, exit: 0, ms: 1, costUsd: 0, sessionId: null, error: null, log: '' }
          : execStep(a, step, ctx),
      runShort: async (sid) => {
        ran.push(sid);
        // the nested run packages the Short (a draft) and clears its halt, as runStory's finish does
        mkdirSync(join(shortDir, 'video', REVIEW_DIR), { recursive: true });
        writeFileSync(
          join(shortDir, 'video', REVIEW_DIR, 'review.json'),
          toJson({
            generatedAt: 'd',
            status: 'private review build',
            buildReport: 'br',
            mp4: 'short-one.mp4',
            mp4Sha: 'x',
            thumbnailSha: null,
            captionsSha: null,
            seconds: 7.5,
            title: 'Short one',
            chapters: [],
            short: { parent: s.f.story, slug: 'one', format: 'ONE FIGURE FROM THE RECORD', fullVideo: null },
          }),
        );
        writeFileSync(join(shortDir, 'video', REVIEW_DIR, 'description.txt'), 'Short one\n');
        const bytes = Buffer.alloc(300, 2);
        writeFileSync(join(shortDir, 'video', REVIEW_DIR, 'short-one.mp4'), bytes);
        const rp = join(shortDir, 'video', REVIEW_DIR, 'review.json');
        writeFileSync(rp, toJson({ ...readJson<object>(rp)!, mp4Sha: sha(bytes) }));
        addOutputTo(s.f.topic, s.f.story, 'short:one', 'youtube-short', {
          derivedFrom: 'youtube',
          source: relative(s.f.root, shortDir).replaceAll('\\', '/'),
          root: s.f.root,
        });
        clearHalt(runDir(s.f.topic, sid, s.f.root));
        return { outcome: 'done', stage: 'packaged', halt: null, iterations: 1, costUsd: 0 };
      },
    });
    expect(ran).toEqual([shortId(s.f.story, 'one')]);
    expect(r.halt?.why).not.toMatch(/no-progress/);
    expect(r.halt?.kind).toBe('awaiting-person');
    expect(r.halt?.why).toMatch(/draft build .* of short:one is uploaded for review/);
    expect(s.events('short:one').filter((e) => e.type === 'uploaded' && e.buildStatus === 'draft')).toHaveLength(1);
  }, 600_000);

  it("a Short's retryable upload failure halts only that Short; the video is not uploaded again", async () => {
    const s = staged();
    writeFakeState(s.fake, {
      ...emptyFakeState(),
      fail: [{ method: 'insertVideo', status: 503, reason: 'backendError', retryable: true, times: 2, after: 1 }],
    });
    const r = await s.run();
    expect(r.halt?.kind).toBe('step-failed');
    expect(r.halt?.retryable).toBe(true);
    expect(r.halt?.why).toMatch(/short:one/);
    expect(s.events('youtube').filter((e) => e.type === 'uploaded')).toHaveLength(1);
    expect(s.events('short:one').filter((e) => e.type === 'failed')).toHaveLength(2); // once, once more, then the halt
    expect(s.events('short:two').filter((e) => e.type === 'uploaded')).toHaveLength(0);
    const r2 = await s.run();
    expect(r2.halt?.kind).toBe('awaiting-person');
    expect(s.events('youtube').filter((e) => e.type === 'uploaded')).toHaveLength(1);
    expect(s.calls().filter((c) => c.method === 'insertVideo')).toHaveLength(5); // 1 + 2 failed + 2
  }, 600_000);

  it('killed between the upload and its journal line, the resumed loop records exactly one upload (criterion 11)', async () => {
    const s = staged({ shorts: 0 });
    let crashed = false;
    const r = await s.run({
      exec: async (a, step, ctx) => {
        const out = await execStep(a, step, ctx);
        if (!crashed && /publish -- upload/.test(step.text)) {
          crashed = true;
          throw new Error('crash after the child, before the journal');
        }
        return out;
      },
    });
    expect(r.halt?.kind).toBe('step-failed');
    expect(s.events().filter((e) => e.type === 'uploaded')).toHaveLength(1);
    const r2 = await s.run();
    expect(r2.halt?.kind).toBe('awaiting-person');
    expect(s.events().filter((e) => e.type === 'uploaded')).toHaveLength(1);
    expect(s.calls().filter((c) => c.method === 'insertVideo')).toHaveLength(1);
  }, 600_000);

  it('a run validates and commits when the story reaches packaged, and commits again what the release loop added (review finding 1)', async () => {
    const s = staged({ shorts: 0 });
    const calls: string[] = [];
    const git = (args: string[]) => {
      calls.push(`git ${args[0]}`);
      if (args[0] === 'rev-parse') return 'main\n';
      if (args[0] === 'diff') return 'topics/x\n';
      return '';
    };
    const r = await s.run({ git, validate: () => (calls.push('validate'), { ok: true, output: '' }) });
    expect(r.halt?.kind).toBe('awaiting-person');
    const first = calls.indexOf('validate');
    expect(first).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf('git commit')).toBeGreaterThan(first); // committed at packaged, before any upload
    expect(calls.filter((c) => c === 'git commit')).toHaveLength(2); // and once more with the loop's ledger and request
    expect(s.events().filter((e) => e.type === 'uploaded')).toHaveLength(1);
    const j = readJournal(runDir(s.f.topic, s.f.story, s.f.root));
    const finish = j.findIndex((e) => e.kind === 'finish');
    const upload = j.findIndex((e) => /publish -- upload/.test(e.step));
    expect(finish).toBeGreaterThanOrEqual(0);
    expect(upload).toBeGreaterThan(finish);
  }, 600_000);

  it('a refused request halts naming the refusal, never no-progress (review finding 6)', async () => {
    const s = staged({ shorts: 0 });
    const r = await s.run({ env: { ...s.env, APPROVAL_SECRET: '' } });
    expect(r.halt?.kind).toBe('step-failed');
    expect(r.halt?.why).toMatch(/APPROVAL_SECRET/);
  }, 600_000);

  it('the work plane lists the packaged story as a release job until it is halted or requested', async () => {
    const s = staged({ shorts: 0 });
    const job = { kind: 'release', topic: s.f.topic, storyId: s.f.story, why: 'release: youtube: upload' };
    expect(releaseJobs(s.a, s.f.root)).toContainEqual(job); // the copied topic's other packaged stories are listed too
    await s.run();
    expect(releaseJobs(s.a, s.f.root).some((j) => j.storyId === s.f.story)).toBe(false); // halted awaiting the person
  }, 600_000);
});

/** A draft fixture (edge voice) with media, and a fake draft-review agent that writes the given verdict. */
function draftStaged(verdict: 'accept' | 'changes', policy: 'person' | 'shadow' | 'agent') {
  const s = staged({ release: false, shorts: 0 });
  const build = s.mainSha;
  const reviewFile = join(s.f.dir, 'video', 'draft-review.json');
  const scenario = join(s.f.root, 'scenario.json');
  writeFileSync(
    scenario,
    JSON.stringify([
      {
        match: 'draft-review\\.md',
        actions: [
          {
            write: relative(s.f.root, reviewFile).replaceAll('\\', '/'),
            text: JSON.stringify({
              key: build,
              verdict,
              notes:
                verdict === 'changes'
                  ? [{ n: 1, text: 'the figure on screen is wrong', seconds: 3, scene: 'sc2' }]
                  : [],
              reviewer: 'fake-opus',
              date: '2026-11-01',
            }),
          },
        ],
        cost: 0.5,
      },
    ]),
  );
  writeFileSync(join(s.f.root, 'automation.json'), toJson({ review: { draft: policy, draftReviewRounds: 2 } }));
  const a = {
    ...s.a,
    review: { ...s.a.review, draft: policy },
    agents: { ...s.a.agents, command: `node ${FAKE_CLAUDE}` },
  };
  const env = { ...s.env, FAKE_CLAUDE_SCENARIO: scenario };
  return { ...s, a, env, build, reviewFile };
}

describe('the draft by policy', () => {
  it('person: the draft is uploaded private and the loop waits for the person; no agent runs', async () => {
    const s = draftStaged('accept', 'person');
    const r = await s.run({ env: s.env }, s.a);
    expect(r.halt?.kind).toBe('awaiting-person');
    expect(r.halt?.unblock.text).toMatch(/video -- final/);
    const up = s.events().filter((e) => e.type === 'uploaded');
    expect(up).toHaveLength(1);
    expect(up[0].buildStatus).toBe('draft');
    expect(existsSync(s.reviewFile)).toBe(false);
    expect(readShadow(s.f.root)).toEqual([]);
    expect(releasePending(s.f.topic, s.f.story, s.a, s.f.root)).toBeNull();
  }, 600_000);

  it("person: the OK reply to the draft mail (run/draft-accepted.json, phase 3) makes the next run final by the person's name", async () => {
    const s = draftStaged('accept', 'person');
    const first = await s.run({ env: s.env }, s.a);
    expect(first.halt?.kind).toBe('awaiting-person');
    writeFileSync(
      join(runDir(s.f.topic, s.f.story, s.f.root), DRAFT_ACCEPTED_FILE),
      toJson({ build: s.build, by: 'Jon', via: { channel: 'email', messageId: '<r1@jon>' }, at: '2026-11-01' }),
    );
    const finals: string[] = [];
    const r = await s.run(
      {
        env: s.env,
        exec: async (a, step, ctx) => {
          const m = /^npm run video -- final (\S+) (\S+) --approved-by "?([^"]+?)"?$/.exec(step.text);
          if (m) {
            finals.push(m[3]);
            afterFinal(s.f.dir, 'releasesha');
            const bytes = Buffer.alloc(4096, 6);
            writeFileSync(join(s.f.dir, 'video', REVIEW_DIR, 'fixture.mp4'), bytes);
            const rp = join(s.f.dir, 'video', REVIEW_DIR, 'review.json');
            writeFileSync(rp, toJson({ ...readJson<object>(rp)!, mp4Sha: sha(bytes) }));
            const acc = runCli(
              'publish',
              ['accept-draft', m[1], m[2], '--by', m[3], '--build', s.build, '--note', 'draft accepted by final'],
              { cwd: s.f.root, env: s.env },
            );
            return {
              kind: 'run',
              ok: acc.status === 0,
              exit: acc.status,
              ms: 1,
              costUsd: 0,
              sessionId: null,
              error: acc.status === 0 ? null : acc.stderr,
              log: '',
            };
          }
          return execStep(a, step, ctx);
        },
      },
      s.a,
    );
    expect(finals).toEqual(['Jon']);
    expect(r.halt?.kind).toBe('awaiting-person');
    expect(r.halt?.unblock.text).toMatch(/reply OK/); // on to the release request
    const ev = s.events();
    expect(ev.find((e) => e.type === 'approved')).toMatchObject({ by: 'Jon', build: s.build });
    expect(ev.filter((e) => e.type === 'uploaded')).toHaveLength(2); // the draft, then the release build
    expect(publicUpdates(s.calls())).toEqual([]);
  }, 600_000);

  it("shadow: the draft is uploaded, the agent's verdict goes to shadow.json and nowhere else, the person decides", async () => {
    const s = draftStaged('changes', 'shadow');
    const r = await s.run({ env: s.env }, s.a);
    expect(r.halt?.kind).toBe('awaiting-person');
    expect(s.events().filter((e) => e.type === 'uploaded')).toHaveLength(1);
    const shadow = readShadow(s.f.root);
    expect(shadow).toHaveLength(1);
    expect(shadow[0]).toMatchObject({
      build: s.build,
      agent: { verdict: 'changes', reviewer: 'fake-opus' },
      person: null,
    });
    expect(shadow[0].agent.notes[0].text).toBe('the figure on screen is wrong');
    expect(s.events().some((e) => /draft-review/.test(e.by))).toBe(false); // criterion 16's shadow row
    expect(s.events().filter((e) => e.type === 'changes-requested')).toEqual([]);
    expect(releasePending(s.f.topic, s.f.story, s.a, s.f.root)).toBeNull();
    // the person's decision joins the entry from the ledger: here a change request on the draft by a person
    recordChangesRequested(s.f.topic, s.f.story, {
      root: s.f.root,
      by: 'Jon',
      build: s.build,
      notes: [{ text: 'slower', seconds: 2 }],
    });
    expect(syncShadowFromLedger(s.f.root, s.f.topic, s.f.story)).toBe(1);
    expect(readShadow(s.f.root)[0].person).toEqual({
      verdict: 'changes',
      notes: [{ n: 1, text: 'slower', seconds: 2 }],
    });
    expect(syncShadowFromLedger(s.f.root, s.f.topic, s.f.story)).toBe(0); // once
    expect(
      recordShadowPerson(s.f.root, `${s.f.topic}/${s.f.story}`, s.build, {
        verdict: 'changes',
        marks: [{ n: 1, mark: 'disagree' }],
      }),
    ).toBe(true);
    expect(shadowAgreement(s.f.root)).toMatchObject({ drafts: 1, agreed: 1, streak: 0, notesDisagreed: 1 });
  }, 600_000);

  it('agent: no draft upload; final runs with the draft-review actor; the release build is uploaded, not approved', async () => {
    const s = draftStaged('accept', 'agent');
    const finals: string[] = [];
    const r = await s.run(
      {
        env: s.env,
        exec: async (a, step, ctx) => {
          // `video final` stands in: the release build takes the draft's place and the acceptance is recorded by the
          // publish CLI exactly as final does, by the actor the loop named
          const m = /^npm run video -- final (\S+) (\S+) --approved-by "([^"]+)"$/.exec(step.text);
          if (m) {
            finals.push(m[3]);
            afterFinal(s.f.dir, 'releasesha');
            const bytes = Buffer.alloc(4096, 5);
            writeFileSync(join(s.f.dir, 'video', REVIEW_DIR, 'fixture.mp4'), bytes);
            const rp = join(s.f.dir, 'video', REVIEW_DIR, 'review.json');
            writeFileSync(rp, toJson({ ...readJson<object>(rp)!, mp4Sha: sha(bytes) }));
            const acc = runCli(
              'publish',
              ['accept-draft', m[1], m[2], '--by', m[3], '--build', s.build, '--note', 'draft accepted by final'],
              { cwd: s.f.root, env: s.env },
            );
            return {
              kind: 'run',
              ok: acc.status === 0,
              exit: acc.status,
              ms: 1,
              costUsd: 0,
              sessionId: null,
              error: acc.status === 0 ? null : acc.stderr,
              log: '',
            };
          }
          return execStep(a, step, ctx);
        },
      },
      s.a,
    );
    expect(r.halt?.kind).toBe('awaiting-person');
    expect(r.halt?.unblock.text).toMatch(/reply OK/);
    expect(finals).toHaveLength(1);
    expect(finals[0]).toMatch(/^automated: draft-review by fake-opus session fake-/);
    const ev = s.events();
    expect(ev.filter((e) => e.type === 'uploaded' && e.buildStatus === 'draft')).toEqual([]); // review focus 5
    expect(ev.find((e) => e.type === 'approved')).toMatchObject({ by: finals[0], build: s.build });
    expect(ev.filter((e) => e.type === 'uploaded')).toHaveLength(1);
    expect(openOutput(s.f.topic, s.f.story, { root: s.f.root }).state.status).toBe('uploaded'); // not approved
    expect(ev.filter((e) => e.type === 'approval-requested')).toHaveLength(1);
    expect(publicUpdates(s.calls())).toEqual([]);
  }, 600_000);

  it('agent, changes: the send-back is recorded by the agent on the draft, the notes pass fixes the scene, and a fresh agent reviews the new build (two sessions)', async () => {
    const s = draftStaged('changes', 'agent');
    // the second build (what the notes pass renders) is accepted by the second reviewer
    const bytes2 = Buffer.alloc(4096, 8);
    const build2 = sha(bytes2);
    const scenario = JSON.parse(readFileSync(join(s.f.root, 'scenario.json'), 'utf8')) as { match: string }[];
    scenario[0].match = `draft-review\\.md[\\s\\S]*Build: ${s.build}`;
    scenario.push({
      match: `draft-review\\.md[\\s\\S]*Build: ${build2}`,
      ...{
        actions: [
          {
            write: relative(s.f.root, s.reviewFile).replaceAll('\\', '/'),
            text: JSON.stringify({
              key: build2,
              verdict: 'accept',
              notes: [],
              reviewer: 'fake-opus',
              date: '2026-11-02',
            }),
          },
        ],
        cost: 0.5,
      },
    });
    writeFileSync(join(s.f.root, 'scenario.json'), JSON.stringify(scenario));
    const steps: string[] = [];
    const finals: string[] = [];
    const claudeLog = join(s.f.root, 'claude-calls.log');
    const r = await s.run(
      {
        env: { ...s.env, FAKE_CLAUDE_LOG: claudeLog },
        exec: async (a, step, ctx) => {
          steps.push(step.text.split('\n')[0]);
          if (/video-fix\.md/.test(step.text)) {
            // the fix agent stands in: the scene is redrawn into a new build with the same report
            writeFileSync(join(s.f.dir, 'video', REVIEW_DIR, 'fixture.mp4'), bytes2);
            const rp = join(s.f.dir, 'video', REVIEW_DIR, 'review.json');
            writeFileSync(rp, toJson({ ...readJson<object>(rp)!, mp4Sha: build2 }));
            return { kind: 'prompt', ok: true, exit: 0, ms: 1, costUsd: 0.2, sessionId: 'fix-1', error: null, log: '' };
          }
          if (/^npm run video -- check /.test(step.text))
            return { kind: 'run', ok: true, exit: 0, ms: 1, costUsd: 0, sessionId: null, error: null, log: '' };
          const m = /^npm run video -- final (\S+) (\S+) --approved-by "([^"]+)"$/.exec(step.text);
          if (m) {
            finals.push(m[3]);
            afterFinal(s.f.dir, 'releasesha');
            const bytes = Buffer.alloc(4096, 5);
            writeFileSync(join(s.f.dir, 'video', REVIEW_DIR, 'fixture.mp4'), bytes);
            const rp = join(s.f.dir, 'video', REVIEW_DIR, 'review.json');
            writeFileSync(rp, toJson({ ...readJson<object>(rp)!, mp4Sha: sha(bytes) }));
            const acc = runCli(
              'publish',
              ['accept-draft', m[1], m[2], '--by', m[3], '--build', build2, '--note', 'draft accepted by final'],
              { cwd: s.f.root, env: s.env },
            );
            return {
              kind: 'run',
              ok: acc.status === 0,
              exit: acc.status,
              ms: 1,
              costUsd: 0,
              sessionId: null,
              error: acc.status === 0 ? null : acc.stderr,
              log: '',
            };
          }
          return execStep(a, step, ctx);
        },
      },
      s.a,
    );
    expect(r.halt?.kind, r.halt?.why).toBe('awaiting-person');
    expect(r.halt?.unblock.text).toMatch(/reply OK/); // the release request: the round-two accept went to final
    const cr = s.events().filter((e) => e.type === 'changes-requested');
    expect(cr).toHaveLength(1);
    expect(cr[0].by).toMatch(/^automated: draft-review by fake-opus/);
    expect(cr[0].notes).toEqual([{ text: 'the figure on screen is wrong', seconds: 3, scene: 'sc2' }]);
    // the notes pass: a scene note goes to the video fix and its check, never to the script writer
    const fix = steps.findIndex((x) => /video-fix\.md/.test(x));
    expect(fix).toBeGreaterThan(steps.findIndex((x) => /draft-review\.md/.test(x)));
    expect(steps[fix + 1]).toMatch(/^npm run video -- check /);
    expect(steps.some((x) => /script\.md/.test(x))).toBe(false);
    expect(steps.filter((x) => /draft-review\.md/.test(x))).toHaveLength(2);
    const sessions = readJournal(runDir(s.f.topic, s.f.story, s.f.root))
      .filter((e) => /draft-review\.md/.test(e.step))
      .map((e) => e.sessionId);
    expect(new Set(sessions).size).toBe(2);
    expect(finals).toHaveLength(1);
    expect(s.events().find((e) => e.type === 'approved')).toMatchObject({ by: finals[0], build: build2 });
    expect(s.events().filter((e) => e.type === 'uploaded' && e.buildStatus === 'draft')).toEqual([]);
    expect(readJson<{ key: string }>(join(runDir(s.f.topic, s.f.story, s.f.root), NOTES_PASS_FILE))?.key).toContain(
      s.build,
    );
    // the pass's notes stay with the pass: the second reviewer's prompt carries none (review finding 5)
    const prompts = readFileSync(claudeLog, 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as string[])
      .map((argv) => argv[argv.indexOf('-p') + 1] ?? '');
    const reviews = prompts.filter((p) => /draft-review\.md/.test(p));
    expect(reviews).toHaveLength(2);
    expect(reviews[1]).not.toMatch(/Notes:|figure on screen is wrong/);
  }, 600_000);

  it('agent, changes, and a notes pass that changes nothing: awaiting-person at once, never a spin to the loop cap (review finding 6)', async () => {
    const s = draftStaged('changes', 'agent');
    let validates = 0;
    const steps: string[] = [];
    const r = await s.run(
      {
        env: s.env,
        validate: () => (validates++, { ok: true, output: '' }),
        exec: async (a, step, ctx) => {
          steps.push(step.text.split('\n')[0]);
          if (/video-fix\.md/.test(step.text))
            return { kind: 'prompt', ok: true, exit: 0, ms: 1, costUsd: 0.2, sessionId: 'fix-1', error: null, log: '' }; // nothing redrawn
          if (/^npm run video -- check /.test(step.text))
            return { kind: 'run', ok: true, exit: 0, ms: 1, costUsd: 0, sessionId: null, error: null, log: '' };
          return execStep(a, step, ctx);
        },
      },
      s.a,
    );
    expect(r.halt?.kind).toBe('awaiting-person');
    expect(r.halt?.why).toMatch(/changed nothing/);
    expect(steps.filter((x) => /draft-review\.md/.test(x))).toHaveLength(1);
    expect(steps.filter((x) => /video-fix\.md/.test(x))).toHaveLength(1);
    expect(validates).toBeLessThanOrEqual(2);
    expect(s.events().filter((e) => e.type === 'changes-requested')).toHaveLength(1);
  }, 600_000);

  it('agent, changes twice: the second round halts awaiting-person with the last notes; no third review, no final', async () => {
    const s = draftStaged('changes', 'agent');
    const bytes2 = Buffer.alloc(4096, 8);
    const steps: string[] = [];
    const r = await s.run(
      {
        env: s.env,
        exec: async (a, step, ctx) => {
          steps.push(step.text.split('\n')[0]);
          if (/video-fix\.md/.test(step.text)) {
            writeFileSync(join(s.f.dir, 'video', REVIEW_DIR, 'fixture.mp4'), bytes2);
            const rp = join(s.f.dir, 'video', REVIEW_DIR, 'review.json');
            writeFileSync(rp, toJson({ ...readJson<object>(rp)!, mp4Sha: sha(bytes2) }));
            return { kind: 'prompt', ok: true, exit: 0, ms: 1, costUsd: 0.2, sessionId: 'fix-1', error: null, log: '' };
          }
          if (/^npm run video -- check /.test(step.text))
            return { kind: 'run', ok: true, exit: 0, ms: 1, costUsd: 0, sessionId: null, error: null, log: '' };
          if (/draft-review\.md/.test(step.text)) {
            // the fake reviewer: `changes` on every build it is shown
            const build = /Build: (\S+)/.exec(step.text)![1];
            writeFileSync(
              s.reviewFile,
              JSON.stringify({
                key: build,
                verdict: 'changes',
                notes: [{ n: 1, text: `still wrong on ${build.slice(0, 4)}`, seconds: 3, scene: 'sc2' }],
                reviewer: 'fake-opus',
                date: '2026-11-02',
              }),
            );
            return {
              kind: 'prompt',
              ok: true,
              exit: 0,
              ms: 1,
              costUsd: 0.5,
              sessionId: `rev-${build.slice(0, 4)}`,
              error: null,
              log: '',
            };
          }
          return execStep(a, step, ctx);
        },
      },
      s.a,
    );
    expect(r.halt?.kind).toBe('awaiting-person');
    expect(r.halt?.why).toMatch(/sent .* back twice|2 rounds/);
    expect(r.halt?.why).toMatch(/still wrong on/);
    expect(steps.filter((x) => /draft-review\.md/.test(x))).toHaveLength(2);
    expect(steps.filter((x) => /video-fix\.md/.test(x))).toHaveLength(1);
    expect(steps.some((x) => /video -- final/.test(x))).toBe(false);
    expect(s.events().filter((e) => e.type === 'changes-requested')).toHaveLength(2);
    expect(s.events().filter((e) => e.type === 'uploaded')).toEqual([]);
  }, 600_000);

  it("a person's change request on the review page is routed by the next run: sentence notes to a script writer after send-back, scene notes to the video fix; a second run does not repeat the pass (criterion 4)", async () => {
    const s = draftStaged('accept', 'person');
    recordChangesRequested(s.f.topic, s.f.story, {
      root: s.f.root,
      by: 'Jon',
      build: s.build,
      notes: [
        { text: 'say the year of the survey', sentence: 's3', seconds: 12 },
        { text: 'the chart title is cut off', scene: 'sc2', seconds: 8 },
      ],
    });
    const steps: string[] = [];
    const prompts: string[] = [];
    const stub = async (a: Automation, step: Step, ctx: StepContext) => {
      steps.push(step.text.split('\n')[0]);
      if (step.kind === 'prompt') {
        prompts.push(step.text + (ctx.notes ? `\n${ctx.notes}` : ''));
        return {
          kind: 'prompt' as const,
          ok: true,
          exit: 0,
          ms: 1,
          costUsd: 0.1,
          sessionId: 'p',
          error: null,
          log: '',
        };
      }
      if (/^npm run video -- check /.test(step.text))
        return { kind: 'run' as const, ok: true, exit: 0, ms: 1, costUsd: 0, sessionId: null, error: null, log: '' };
      return execStep(a, step, ctx);
    };
    const r = await s.run({ env: s.env, exec: stub }, s.a);
    expect(r.halt?.kind).toBe('awaiting-person');
    const sendBack = steps.findIndex((x) => /^npm run script -- send-back /.test(x));
    const writer = steps.findIndex((x) => /script\.md \(notes\)|script\.md/.test(x));
    const fix = steps.findIndex((x) => /video-fix\.md/.test(x));
    expect(sendBack).toBeGreaterThanOrEqual(0);
    expect(writer).toBe(sendBack + 1);
    expect(fix).toBeGreaterThan(writer);
    expect(steps[fix + 1]).toMatch(/^npm run video -- check /);
    expect(readJson<Script>(join(s.f.dir, 'script.json'))?.passStartRevision).toBe(1);
    expect(prompts[0]).toMatch(/send-back pass/);
    expect(prompts[0]).toMatch(/\[0:12 s3\] say the year of the survey/);
    expect(prompts[0]).not.toMatch(/chart title/); // the scene note is the fix agent's
    expect(prompts[1]).toMatch(/\[0:08 sc2\] the chart title is cut off/);
    const n = steps.length;
    const again = await s.run({ env: s.env, exec: stub }, s.a);
    expect(again.halt?.kind).toBe('awaiting-person');
    expect(steps.slice(n).some((x) => /send-back|script\.md|video-fix/.test(x))).toBe(false);
  }, 600_000);

  it('a notes pass that fails after the writer revised keeps its revision budget on resume: send-back runs once, passStartRevision stays', async () => {
    const s = draftStaged('accept', 'person');
    let writerRuns = 0;
    const steps: string[] = [];
    const exec = async (a: Automation, step: Step, ctx: StepContext) => {
      steps.push(step.text.split('\n')[0]);
      if (/script\.md/.test(step.text)) {
        writerRuns++;
        const sp = join(s.f.dir, 'script.json');
        const script = readJson<Script>(sp)!;
        if (writerRuns === 1) {
          writeFileSync(sp, toJson({ ...script, revision: script.revision + 1 })); // the writer revised, then its validator failed
          return {
            kind: 'prompt' as const,
            ok: false,
            exit: 2,
            ms: 1,
            costUsd: 0.1,
            sessionId: 'w1',
            error: 'validator script validate failed: blocked',
            log: '',
          };
        }
        return {
          kind: 'prompt' as const,
          ok: true,
          exit: 0,
          ms: 1,
          costUsd: 0.1,
          sessionId: 'w2',
          error: null,
          log: '',
        };
      }
      if (step.kind === 'prompt')
        return {
          kind: 'prompt' as const,
          ok: true,
          exit: 0,
          ms: 1,
          costUsd: 0.1,
          sessionId: 'p',
          error: null,
          log: '',
        };
      return execStep(a, step, ctx);
    };
    const first = await s.run({ env: s.env, notes: '[0:12 s3] say the year of the survey', exec }, s.a);
    expect(first.halt?.kind).toBe('step-failed');
    expect(readJson<Script>(join(s.f.dir, 'script.json'))).toMatchObject({ revision: 2, passStartRevision: 1 });
    const second = await s.run({ env: s.env, notes: '[0:12 s3] say the year of the survey', exec }, s.a);
    // the stubbed reviewer never approves the revised script, so the board runs out of progress: the point is the
    // pass itself, which ran its writer again without reopening the budget
    expect(second.halt?.kind).not.toBe('step-failed');
    expect(steps.filter((x) => /^npm run script -- send-back /.test(x))).toHaveLength(1);
    expect(writerRuns).toBe(2);
    expect(readJson<Script>(join(s.f.dir, 'script.json'))?.passStartRevision).toBe(1); // the pass's budget counts from where it opened
  }, 600_000);

  it('--notes-file by hand: the same routing from the text, one line per note', async () => {
    const s = draftStaged('accept', 'person');
    const steps: string[] = [];
    const r = await s.run(
      {
        env: s.env,
        notes: '[0:12 s3] say the year of the survey\n- shorter hook',
        exec: async (a, step, ctx) => {
          steps.push(step.text.split('\n')[0]);
          if (step.kind === 'prompt')
            return { kind: 'prompt', ok: true, exit: 0, ms: 1, costUsd: 0.1, sessionId: 'p', error: null, log: '' };
          return execStep(a, step, ctx);
        },
      },
      s.a,
    );
    expect(r.halt?.kind).toBe('awaiting-person');
    expect(steps.filter((x) => /^npm run script -- send-back /.test(x))).toHaveLength(1);
    expect(steps.some((x) => /script\.md/.test(x))).toBe(true);
    expect(steps.some((x) => /video-fix\.md/.test(x))).toBe(false);
    expect(readJson<Script>(join(s.f.dir, 'script.json'))?.passStartRevision).toBe(1);
  }, 600_000);
});

describe('the digest reads the shadow record against the enabling criteria (spec 5.5)', () => {
  it('six consecutive agreeing drafts with no disagree mark and no accepted draft sent back: may be enabled; else what is short', () => {
    const root = staged({ shorts: 0 }).f.root;
    const put = (
      i: number,
      agent: 'accept' | 'changes',
      person: 'accept' | 'changes',
      marks: ('agree' | 'disagree')[] = [],
    ) => {
      recordShadowAgent(root, {
        story: 'heat-pumps/s',
        build: `d${i}`,
        agent: {
          verdict: agent,
          notes: marks.map((_, n) => ({ n: n + 1, text: `note ${n + 1}` })),
          reviewer: 'r',
          session: null,
        },
        at: `2026-11-${String(i).padStart(2, '0')}T00:00:00Z`,
      });
      recordShadowPerson(root, 'heat-pumps/s', `d${i}`, {
        verdict: person,
        marks: marks.map((mark, n) => ({ n: n + 1, mark })),
      });
    };
    for (let i = 1; i <= 6; i++) put(i, 'accept', 'accept');
    const ok = renderDigest([], { shadow: shadowAgreement(root) }, DEFAULTS).text;
    expect(ok).toMatch(/Draft review shadow/);
    expect(ok).toMatch(/6 of the last 6 drafts agreed/);
    expect(ok).toMatch(/`review.draft: agent` may be enabled/);
    put(7, 'changes', 'changes', ['agree', 'disagree']);
    const short = renderDigest([], { shadow: shadowAgreement(root) }, DEFAULTS).text;
    expect(short).toMatch(/not yet/);
    expect(short).toMatch(/1 note marked disagree/);
    expect(short).not.toMatch(/may be enabled/);
  });
});

describe('shadowAgreement', () => {
  it('computes the streak over the latest drafts and the per-note marks', () => {
    const root = staged({ shorts: 0 }).f.root;
    const e = (
      i: number,
      agent: 'accept' | 'changes',
      person: 'accept' | 'changes',
      marks: ('agree' | 'disagree')[] = [],
      sentBack = false,
    ) => {
      recordShadowAgent(root, {
        story: 'heat-pumps/s',
        build: `b${i}`,
        agent: { verdict: agent, notes: [], reviewer: 'r', session: null },
        at: `2026-11-0${i}T00:00:00Z`,
        ...(sentBack && { sentBack }),
      });
      recordShadowPerson(root, 'heat-pumps/s', `b${i}`, {
        verdict: person,
        marks: marks.map((m, n) => ({ n: n + 1, mark: m })),
      });
    };
    e(1, 'accept', 'changes');
    e(2, 'accept', 'accept');
    e(3, 'changes', 'changes', ['agree', 'disagree']);
    e(4, 'accept', 'accept');
    e(5, 'changes', 'changes', ['agree']);
    e(6, 'accept', 'accept');
    e(7, 'accept', 'accept');
    expect(shadowAgreement(root)).toEqual({
      drafts: 7,
      agreed: 6,
      streak: 4,
      notesAgreed: 2,
      notesDisagreed: 1,
      acceptedThenSentBack: 0,
    });
    e(8, 'accept', 'accept', [], true);
    expect(shadowAgreement(root)).toMatchObject({ streak: 0, acceptedThenSentBack: 1 });
    expect(readFileSync(join(root, '.automation', 'shadow.json'), 'utf8')).toContain('"entries"');
  });
});
