// The production pick (phase 1 Task 5): one fixture per exclusion of spec §5.4, the ranking, the cadence knobs across
// a week boundary in the configured timezone, and the record written before the start.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import {
  type Candidate,
  type RowInput,
  candidatesOf,
  choose,
  pickDue,
  pickJob,
  rank,
} from '../../src/orchestration/run/pick';
import { readSchedule } from '../../src/orchestration/run/schedule';

const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
const fresh = () => {
  const root = mkdtempSync(join(tmpdir(), 'vk-pick-'));
  roots.push(root);
  writeFileSync(join(root, 'package.json'), '{"name":"video-knowledge"}');
  return root;
};
const row = (id: string, extra: Partial<RowInput> = {}): RowInput => ({
  topic: 'heat-pumps',
  story: { id, readiness: 'ready', scores: { overall: 0.7, evidence: 0.6 } as RowInput['story']['scores'] },
  institution: 'spending',
  hasProduction: false,
  decision: null,
  haltOpen: false,
  live: false,
  ...extra,
});
const on = {
  ...DEFAULTS,
  enabled: { ...DEFAULTS.enabled, production: true },
  production: { weekday: 'monday', hour: 6, storiesPerWeek: 1, perInstitutionPerWeek: 1, maxAwaitingApproval: 2 },
  schedule: { ...DEFAULTS.schedule, timezone: 'America/Los_Angeles' },
  approvals: { ...DEFAULTS.approvals, approverName: 'Jon' },
};
const monday = Date.parse('2026-11-02T20:00:00Z'); // Monday 12:00 LA

describe('candidates', () => {
  it('one exclusion each', () => {
    const rows: RowInput[] = [
      row('decision:ok'),
      row('decision:not-ready', { story: { ...row('x').story, readiness: 'needs-review' } }),
      row('decision:follow-up', { story: { ...row('x').story, partOf: 'decision:ok' } }),
      row('decision:unclaimed', { institution: null }),
      row('decision:fixture', { topic: 'test-fixture', fixture: true }),
      row('decision:in-production', { hasProduction: true }),
      row('decision:parked', { decision: 'parked' }),
      row('decision:halted', { haltOpen: true }),
      row('decision:queued', { decision: 'queued' }),
    ];
    expect(
      candidatesOf(rows)
        .map((c) => c.storyId)
        .sort(),
    ).toEqual(['decision:ok', 'decision:queued']);
    expect(candidatesOf(rows).find((c) => c.storyId === 'decision:queued')?.queued).toBe(true);
  });
  it('counts live videos per topic and institution', () => {
    const rows = [
      row('decision:live', { live: true, hasProduction: true }),
      row('decision:a'),
      row('decision:b', { topic: 'organic-food', institution: 'plausibility' }),
    ];
    const c = candidatesOf(rows);
    expect(c.find((x) => x.storyId === 'decision:a')).toMatchObject({ liveInTopic: 1, liveInInstitution: 1 });
    expect(c.find((x) => x.storyId === 'decision:b')).toMatchObject({ liveInTopic: 0, liveInInstitution: 0 });
  });
});

describe('rank and choose', () => {
  const c = (storyId: string, x: Partial<Candidate>): Candidate => ({
    topic: 't',
    storyId,
    institution: 'i',
    overall: 0.5,
    evidence: 0.5,
    liveInTopic: 0,
    liveInInstitution: 0,
    queued: false,
    ...x,
  });
  it('queued first, then overall, evidence, fewest live in topic, fewest live in institution, name', () => {
    const ranked = rank([
      c('e', { overall: 0.9 }),
      c('q', { overall: 0.1, queued: true }),
      c('b', { overall: 0.8, evidence: 0.9 }),
      c('a', { overall: 0.8, evidence: 0.9, liveInTopic: 1 }),
      c('d', { overall: 0.8, evidence: 0.5 }),
    ]);
    expect(ranked.map((x) => x.storyId)).toEqual(['q', 'e', 'b', 'a', 'd']);
  });
  it('skips a higher-scored story of an institution that had its pick this week', () => {
    const ranked = rank([
      c('a', { overall: 0.9, institution: 'spending' }),
      c('b', { overall: 0.6, institution: 'plausibility' }),
    ]);
    expect(choose(ranked, on, { week: 'w', picks: [] })?.storyId).toBe('a');
    expect(
      choose(ranked, on, { week: 'w', picks: [{ topic: 't', storyId: 'z', institution: 'spending', at: 'x' }] })
        ?.storyId,
    ).toBe('b');
    expect(
      choose(
        ranked,
        { ...on, production: { ...on.production, perInstitutionPerWeek: 2 } },
        { week: 'w', picks: [{ topic: 't', storyId: 'z', institution: 'spending', at: 'x' }] },
      )?.storyId,
    ).toBe('a');
  });
});

describe('pickDue', () => {
  const open = { awaitingApproval: 0, aliveStoryLocks: 0 };
  const none = { week: '2026-W45', picks: [] };
  it("needs production on and the week's slot passed in the configured timezone", () => {
    expect(pickDue({ ...on, enabled: { ...on.enabled, production: false } }, new Date(monday), none, open)).toBe(false);
    expect(pickDue(on, new Date(monday), none, open)).toBe(true);
    // Monday 05:00 LA: the 06:00 slot has not come; last week's slot is another ISO week
    expect(pickDue(on, new Date(Date.parse('2026-11-02T13:00:00Z')), none, open)).toBe(false);
    // Sunday 23:00 LA (Monday 07:00 UTC): still last week locally
    expect(pickDue(on, new Date(Date.parse('2026-11-09T07:00:00Z')), none, open)).toBe(false);
    // Thursday: the slot passed this week
    expect(pickDue(on, new Date(Date.parse('2026-11-05T12:00:00Z')), none, open)).toBe(true);
  });
  it('the knobs: stories per week, concurrency, the approval backlog', () => {
    const one = { week: '2026-W45', picks: [{ topic: 't', storyId: 'a', institution: 'i', at: 'x' }] };
    expect(pickDue(on, new Date(monday), one, open)).toBe(false);
    expect(pickDue({ ...on, production: { ...on.production, storiesPerWeek: 2 } }, new Date(monday), one, open)).toBe(
      true,
    );
    expect(pickDue(on, new Date(monday), none, { ...open, aliveStoryLocks: 1 })).toBe(false);
    expect(pickDue(on, new Date(monday), none, { ...open, awaitingApproval: 2 })).toBe(false);
    expect(pickDue(on, new Date(monday), none, { ...open, awaitingApproval: 1 })).toBe(true);
  });
});

describe('pickJob', () => {
  it('records the pick before starting it, starts the chosen story with the approver form, and never picks twice', async () => {
    const root = fresh();
    const started: string[] = [];
    const deps = {
      now: () => monday,
      candidates: () => [
        {
          topic: 'heat-pumps',
          storyId: 'decision:a',
          institution: 'spending',
          overall: 0.8,
          evidence: 0.7,
          liveInTopic: 0,
          liveInInstitution: 0,
          queued: false,
        },
      ],
      run: async (t: string, s: string, approver: string) => {
        started.push(`${t}/${s} by ${approver}`);
        return { outcome: 'done' as const, stage: 'packaged', halt: null, iterations: 1, costUsd: 0 };
      },
    };
    const r = await pickJob(on, root, deps);
    expect(r.started).toBe('heat-pumps/decision:a');
    expect(started).toEqual(['heat-pumps/decision:a by automated: production pick 2026-11-02, enabled by Jon']);
    expect(readSchedule(root)).toMatchObject({
      week: '2026-W45',
      picks: [{ topic: 'heat-pumps', storyId: 'decision:a', institution: 'spending' }],
    });
    // the record exists: the cadence is spent for the week, so a crashed start is never repeated by the pick
    expect((await pickJob(on, root, deps)).why).toBe('nothing due');
    expect(started).toHaveLength(1);
    // two a week: the second pick goes to another institution
    const two = { ...on, production: { ...on.production, storiesPerWeek: 2 } };
    expect((await pickJob(two, root, deps)).why).toBe('nothing due'); // same institution, perInstitutionPerWeek 1
    const other = {
      ...deps,
      candidates: () => [
        { ...deps.candidates()[0], topic: 'organic-food', storyId: 'decision:o', institution: 'plausibility' },
      ],
    };
    expect((await pickJob(two, root, other)).started).toBe('organic-food/decision:o');
  });
});
