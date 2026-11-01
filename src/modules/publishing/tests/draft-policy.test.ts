// Draft review by policy (spec §7.3): `accept-draft` and `request-changes` accept the draft-review agent's actor only
// under `review.draft: agent`, and only on a draft build; release approval reads no policy and refuses every
// automated actor. The secret-free `final` is phase 0's boundary (src/modules/video/tests/final-env.test.ts).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readJson, toJson } from '../../../shared/io';
import { runCli } from '../../../shared/cli';
import {
  DRAFT_REVIEW_ACTOR,
  acceptDraftProblem,
  loadLedger,
  openOutput,
  recordApproved,
  recordChangesRequested,
} from '../publish';
import { type Fixture, afterFinal, cliRoot, syntheticProduction } from '../../../../tests/production-helpers';

const fixtures: Fixture[] = [];
afterAll(() => fixtures.forEach((f) => f.cleanup()));
const fresh = (release = false) => {
  const f = syntheticProduction('packaged', { release });
  fixtures.push(f);
  cliRoot(f.root);
  const pp = join(f.dir, 'video', 'review', 'review.json');
  if (!release) writeFileSync(pp, toJson({ ...readJson<object>(pp)!, mp4Sha: 'd0d0d0d0d0' }));
  return f;
};
const AGENT = 'automated: draft-review by opus session abc-123';
const now = new Date('2026-11-01T00:00:00Z');

describe('acceptDraftProblem by policy', () => {
  it('the draft-review actor is refused under person and shadow, accepted under agent, for the replaced draft', () => {
    const f = fresh();
    const D = afterFinal(f.dir, 'a1a1a1a1a1');
    const o = openOutput(f.topic, f.story, { root: f.root });
    expect(acceptDraftProblem(AGENT, D, o, 'person')).toMatch(/accepted by a person/);
    expect(acceptDraftProblem(AGENT, D, o, 'shadow')).toMatch(/accepted by a person/);
    expect(acceptDraftProblem(AGENT, D, o, 'agent')).toBeNull();
    expect(acceptDraftProblem(AGENT, D, o)).toMatch(/accepted by a person/); // the default is person
    // any other automated actor is refused under agent too: the acceptance names the reviewer and its session
    expect(acceptDraftProblem('automated: run 2026-11-01', D, o, 'agent')).toMatch(
      /draft-review by <model> session <id>/,
    );
    expect(DRAFT_REVIEW_ACTOR.test(AGENT)).toBe(true);
    expect(DRAFT_REVIEW_ACTOR.test('automated: draft-review by opus')).toBe(false);
  });

  it('a release sha is refused under every policy, and the person path is unchanged', () => {
    const f = fresh();
    afterFinal(f.dir, 'a1a1a1a1a1');
    const o = openOutput(f.topic, f.story, { root: f.root });
    for (const policy of ['person', 'shadow', 'agent'] as const) {
      expect(() =>
        recordApproved(f.topic, f.story, { root: f.root, by: AGENT, now, build: 'a1a1a1a1a1', accepted: true, policy }),
      ).toThrow(/narrated under commercial terms|accepted by a person/);
    }
    expect(acceptDraftProblem('Jon', 'd0d0d0d0d0', o, 'agent')).toBeNull();
  });

  it('under agent, recordApproved writes the acceptance by the agent; never a release approval', () => {
    const f = fresh();
    const D = afterFinal(f.dir, 'a1a1a1a1a1');
    const r = recordApproved(f.topic, f.story, {
      root: f.root,
      by: AGENT,
      now,
      build: D,
      accepted: true,
      policy: 'agent',
    });
    expect(r.event).toMatchObject({ type: 'approved', by: AGENT, build: D });
    // the release build on disk is not approved by that: a person approves it
    expect(openOutput(f.topic, f.story, { root: f.root }).state.status).toBe('not-uploaded');
    expect(() => recordApproved(f.topic, f.story, { root: f.root, by: AGENT, now, policy: 'agent' })).toThrow(
      /approved by a person, never by an automated run/,
    );
    expect(() =>
      recordApproved(f.topic, f.story, { root: f.root, by: AGENT, now, build: D, accepted: true, policy: 'person' }),
    ).toThrow(/accepted by a person/);
  });
});

describe('request-changes by the draft-review agent', () => {
  it('is accepted on a draft build and refused on a release build', () => {
    const draft = fresh();
    const r = recordChangesRequested(draft.topic, draft.story, {
      root: draft.root,
      by: AGENT,
      now,
      policy: 'agent',
      build: 'd0d0d0d0d0',
      notes: [{ text: 'the figure on screen is wrong', seconds: 3, scene: 'sc2' }],
    });
    expect(r.event?.type).toBe('changes-requested');
    expect(loadLedger(draft.topic, draft.story, draft.root)!.outputs.youtube.events[0].by).toBe(AGENT);
    const release = fresh(true);
    expect(() =>
      recordChangesRequested(release.topic, release.story, {
        root: release.root,
        by: AGENT,
        now,
        policy: 'agent',
        build: 'releasesha',
        notes: [{ text: 'x' }],
      }),
    ).toThrow(/a release build is sent back by a person/);
    expect(() =>
      recordChangesRequested(draft.topic, draft.story, {
        root: draft.root,
        by: 'automated: run',
        now,
        policy: 'agent',
        build: 'd0d0d0d0d0',
        notes: [{ text: 'x' }],
      }),
    ).toThrow(/person/);
  });
});

describe('the CLI reads review.draft from automation.json', () => {
  it('accept-draft --dry-run with the agent actor: exit 2 under person, 0 under agent; request-changes likewise', () => {
    const f = fresh();
    const D = afterFinal(f.dir, 'a1a1a1a1a1');
    const args = ['accept-draft', f.topic, f.story, '--by', AGENT, '--build', D, '--dry-run'];
    expect(runCli('publish', args, { cwd: f.root }).status).toBe(2);
    writeFileSync(join(f.root, 'automation.json'), toJson({ review: { draft: 'shadow', draftReviewRounds: 2 } }));
    expect(runCli('publish', args, { cwd: f.root }).status).toBe(2);
    writeFileSync(join(f.root, 'automation.json'), toJson({ review: { draft: 'agent', draftReviewRounds: 2 } }));
    const ok = runCli('publish', args, { cwd: f.root });
    expect(ok.stderr).toBe('');
    expect(ok.status).toBe(0);
    expect(loadLedger(f.topic, f.story, f.root)).toBeNull(); // a dry run writes nothing
    // a person's acceptance is unchanged by policy
    expect(
      runCli('publish', ['accept-draft', f.topic, f.story, '--by', 'Jon', '--build', D, '--dry-run'], { cwd: f.root })
        .status,
    ).toBe(0);
  }, 120_000);
});
