// The release loop (phase 2 Task 5, spec §5.3, §7.2, §7.3) over the real CLIs with the fake YouTube client
// (YOUTUBE_FAKE): a packaged release build with two packaged Shorts is uploaded private, verified and requested once;
// YouTube's processing is retried without a no-progress halt; a re-packaged Short voids the request; a Short's upload
// failure halts only that Short; a crash between an upload and its journal line leaves one upload; the draft review
// by policy (person, shadow, agent) records what the spec says and nothing else.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadAutomation } from '../../src/shared/automation';
import { MANIFEST_FILE, REVIEW_DIR, ROOT, readJson, sha, toJson } from '../../src/shared/io';
import { discoverShorts, loadShortParent, shortsPath } from '../../src/modules/shorts';
import { emptyFakeState, readFakeState, writeFakeState } from '../../src/modules/publishing/fake-youtube';
import { addOutputTo, loadLedger, openOutput, recordChangesRequested } from '../../src/modules/publishing/publish';
import { runCli } from '../../src/shared/cli';
import { readJournal, runDir } from '../../src/orchestration/run/journal';
import {
  readShadow,
  releasePending,
  shadowAgreement,
  recordShadowAgent,
  recordShadowPerson,
  syncShadowFromLedger,
} from '../../src/orchestration/run/release';
import { type RunOptions, runStory } from '../../src/orchestration/run/runner';
import { execStep } from '../../src/orchestration/run/steps';
import { releaseJobs } from '../../src/orchestration/run/work';
import { type Fixture, afterFinal, cliRoot, syntheticProduction } from '../production-helpers';

const fixtures: Fixture[] = [];
afterAll(() => fixtures.forEach((f) => f.cleanup()));
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

  it('agent, changes: the send-back is recorded by the agent on the draft and the loop waits for the notes pass', async () => {
    const s = draftStaged('changes', 'agent');
    const r = await s.run({ env: s.env }, s.a);
    expect(r.halt?.kind).toBe('awaiting-person');
    expect(r.halt?.why).toMatch(/the figure on screen is wrong/);
    const cr = s.events().find((e) => e.type === 'changes-requested');
    expect(cr?.by).toMatch(/^automated: draft-review by fake-opus/);
    expect(cr?.notes).toEqual([{ text: 'the figure on screen is wrong', seconds: 3, scene: 'sc2' }]);
    expect(s.events().filter((e) => e.type === 'uploaded')).toEqual([]);
  }, 600_000);
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
