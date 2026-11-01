// Milestone 2 acceptance criteria (spec §13), by number in the titles; each phase appends its rows. Phase 1: 2 (the
// weekly pick), 12 (a stuck halt notifies once) and the email row of 13 (an email survives its crash boundary once).
// The others live beside the code they prove, named in their titles: 1 topic-run, 3 full-run, 4 release (the notes
// pass), 5 decide, 6 inbox, 7 decide and publish-steps, 8 publish-steps, 9 launch, 10 article-work, 11 crash-render and
// release, 13 reconcile, 14 containment, 15 planes, 16 quality, 17 duration; 18 is the fixture run in the report.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { scriptDir } from '../../src/shared/io';
import { FakeMail } from '../../src/shared/mail';
import { type Halt, runDir, writeHalt } from '../../src/orchestration/run/journal';
import { flushOutbox, notifyHalts, readOutbox, sendTracked } from '../../src/orchestration/run/notify';
import { pickJob } from '../../src/orchestration/run/pick';
import { stuckRows } from '../../src/orchestration/run/resume';
import { readSchedule } from '../../src/orchestration/run/schedule';
import { statusOf } from '../../src/orchestration/run/status';

const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
const fresh = (stories: string[] = []) => {
  const root = mkdtempSync(join(tmpdir(), 'vk-acc-'));
  roots.push(root);
  writeFileSync(join(root, 'package.json'), '{"name":"video-knowledge"}');
  for (const id of stories) {
    runDir('heat-pumps', id, root);
    writeFileSync(join(scriptDir('heat-pumps', id, root), 'script.json'), JSON.stringify({ story: id }));
  }
  return root;
};
const a = {
  ...DEFAULTS,
  enabled: { ...DEFAULTS.enabled, production: true, tick: true },
  production: { weekday: 'monday', hour: 6, storiesPerWeek: 1, perInstitutionPerWeek: 1, maxAwaitingApproval: 2 },
  schedule: { ...DEFAULTS.schedule, timezone: 'America/Los_Angeles' },
  approvals: { ...DEFAULTS.approvals, from: 'automation@example.test', approverName: 'Jon' },
  notifications: { to: 'jon@example.test', digest: { weekday: 'monday', hour: 8 } },
};
const monday = Date.parse('2026-11-02T20:00:00Z');

describe('criterion 2: weekly scheduling selects and starts one eligible story', () => {
  it("starts the best eligible story once the week's slot passed, records it first, and no second one that week", async () => {
    const root = fresh();
    const started: string[] = [];
    const deps = {
      now: () => monday,
      candidates: () => [
        {
          topic: 'heat-pumps',
          storyId: 'decision:best',
          institution: 'spending',
          overall: 0.9,
          evidence: 0.8,
          liveInTopic: 0,
          liveInInstitution: 0,
          queued: false,
        },
        {
          topic: 'organic-food',
          storyId: 'decision:next',
          institution: 'plausibility',
          overall: 0.7,
          evidence: 0.8,
          liveInTopic: 0,
          liveInInstitution: 0,
          queued: false,
        },
      ],
      run: async (t: string, s: string) => {
        started.push(`${t}/${s}`);
        return { outcome: 'done' as const, stage: 'packaged', halt: null, iterations: 1, costUsd: 0 };
      },
    };
    expect((await pickJob(a, root, deps)).started).toBe('heat-pumps/decision:best');
    expect(readSchedule(root).picks).toHaveLength(1);
    expect((await pickJob(a, root, deps)).why).toBe('nothing due');
    expect(started).toEqual(['heat-pumps/decision:best']);
    // the next week starts the next story
    expect((await pickJob(a, root, { ...deps, now: () => monday + 7 * 86400_000 })).started).toBe(
      'heat-pumps/decision:best',
    );
  });
});

describe('criterion 12: a stuck workflow notifies the person rather than silently remaining blocked', () => {
  it('a halt older than stuckAfterMinutes is emailed once with its unblock action, not twice', async () => {
    const root = fresh(['decision:a']);
    const h: Halt = {
      kind: 'awaiting-person',
      stage: 'review',
      why: 'revision limit reached',
      unblock: { kind: 'decide', text: 'authorise a corrective pass or park the story' },
      at: new Date(monday - 4 * 3600_000).toISOString(),
      runId: 'r1',
      board: { stage: 'review', next: 'x' },
    };
    writeHalt(runDir('heat-pumps', 'decision:a', root), h);
    const rows = statusOf(root, () => false);
    expect(
      stuckRows(a, root, { now: () => monday, rows, ask: () => ({ stage: 'review', next: 'x' }) }).stuck.map(
        (r) => r.storyId,
      ),
    ).toEqual(['decision:a']);
    const mail = new FakeMail();
    expect(await notifyHalts(a, mail, root, { now: () => monday, rows })).toHaveLength(1);
    expect(await notifyHalts(a, mail, root, { now: () => monday + 900_000, rows })).toHaveLength(0);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].text).toContain('authorise a corrective pass or park the story');
  });
});

describe('criterion 13 (email row): an email survives its crash boundary once', () => {
  it('a send that delivered before the crash is resent with the same Message-ID, and never a third time once recorded', async () => {
    const root = fresh();
    const mail = new FakeMail();
    const out = { from: 'automation@example.test', to: 'jon@example.test', subject: 'release (req-1)', text: 'b' };
    mail.failNext = 'after';
    await expect(
      sendTracked(mail, out, 'release-request', root, { request: 'req-1', now: () => monday }),
    ).rejects.toThrow();
    const id = readOutbox(root)[0].messageId;
    expect(
      await flushOutbox(
        mail,
        root,
        () => monday + 11 * 60_000,
        () => out,
      ),
    ).toEqual([id]);
    expect(
      await flushOutbox(
        mail,
        root,
        () => monday + 60 * 60_000,
        () => out,
      ),
    ).toEqual([]);
    expect(mail.sent.map((m) => m.messageId)).toEqual([id, id]);
    expect(mail.sent.every((m) => m.subject.includes('req-1'))).toBe(true);
  });
});
