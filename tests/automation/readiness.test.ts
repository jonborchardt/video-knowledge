// The readiness record (M3 2.5): the integrations are a code constant with their implemented fact and the configuration
// key their enabled state is read from; readiness.json stores verification only, written by one person-only verb
// whose evidence must name a record that exists; enabled is never stored and never implied by a verification.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS, loadAutomation } from '../../src/shared/automation';
import { runCli } from '../../src/shared/cli';
import { ROOT, readJson, toJson } from '../../src/shared/io';
import { appendEvent, emptyLedger, publishPath, saveLedger } from '../../src/modules/publishing/publish';
import { appendJournal, runDir } from '../../src/orchestration/run/journal';
import { automationDir } from '../../src/orchestration/run/notify';
import {
  INTEGRATIONS,
  READINESS_FILE,
  loadReadiness,
  readinessProblems,
  readinessView,
  verify,
} from '../../src/orchestration/run/readiness';
import { cliRoot } from '../production-helpers';

const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })), 60_000);
const T = 'heat-pumps';
const S = 'decision:x';
const NOW = new Date('2026-11-10T10:00:00Z');

function fresh() {
  const root = mkdtempSync(join(tmpdir(), 'vk-readiness-'));
  roots.push(root);
  cliRoot(root);
  mkdirSync(join(root, 'topics', T, 'scripts', 'decision-x'), { recursive: true });
  writeFileSync(join(root, 'topics', T, 'scripts', 'decision-x', 'script.json'), JSON.stringify({ story: S }));
  // records the evidence may name: a ledger with a published event, a journal line, an outbox entry
  saveLedger(
    publishPath(T, S, root),
    appendEvent(emptyLedger(`${T}/${S}`), 'youtube', {
      at: '2026-11-09T00:00:00Z',
      type: 'published',
      by: 'Jon',
      id: 'vid00000000',
    }).ledger,
  );
  appendJournal(runDir(T, S, root), {
    at: '2026-11-09T00:00:00.000Z',
    runId: 'r1',
    stage: 'script',
    next: 'x',
    step: 'x',
    kind: 'prompt',
    attempt: 1,
  });
  mkdirSync(automationDir(root), { recursive: true });
  writeFileSync(
    join(automationDir(root), 'outbox.json'),
    toJson([
      {
        messageId: '<m1@test>',
        kind: 'release-request',
        subject: 's',
        to: 'jon@example.test',
        createdAt: '2026-11-09T00:00:00Z',
        sentAt: '2026-11-09T00:00:01Z',
        attempts: 1,
      },
    ]),
  );
  return root;
}

describe('INTEGRATIONS and readinessView', () => {
  it('names every integration with its implemented fact and the key its enabled state comes from; enabled is read from the configuration only', () => {
    const keys = INTEGRATIONS.map((i) => i.key);
    for (const k of [
      'youtube-upload',
      'youtube-go-live',
      'approval-mail-send',
      'approval-mail-receive',
      'decide-by-reply',
      'correction-by-reply',
      'maintenance-scan',
      'agent-draft-review-shadow',
      'cloudflare-deploy-probe',
      'x-post',
      'scheduled-tasks',
      'research-pipeline',
      'discovery',
    ])
      expect(keys).toContain(k);
    expect(INTEGRATIONS.find((i) => i.key === 'scheduled-tasks')!.implemented).toBe(false);
    expect(INTEGRATIONS.filter((i) => i.key !== 'scheduled-tasks').every((i) => i.implemented)).toBe(true);
    const root = fresh();
    const off = readinessView(root, DEFAULTS);
    expect(off.every((r) => r.verified === null)).toBe(true);
    expect(off.find((r) => r.key === 'x-post')!.enabled).toBe(false);
    expect(off.find((r) => r.key === 'scheduled-tasks')!.enabled).toBeNull(); // the person's, not a flag
    const on = readinessView(root, {
      ...DEFAULTS,
      enabled: { ...DEFAULTS.enabled, social: true, maintenance: true },
      review: { ...DEFAULTS.review, draft: 'shadow' },
    });
    expect(on.find((r) => r.key === 'x-post')!.enabled).toBe(true);
    expect(on.find((r) => r.key === 'maintenance-scan')!.enabled).toBe(true);
    expect(on.find((r) => r.key === 'agent-draft-review-shadow')!.enabled).toBe(true);
    expect(on.find((r) => r.key === 'x-post')!.enabledBy).toBe('enabled.social');
    // a verification changes no flag: verified and enabled stay independent
    verify(root, 'x-post', { by: 'Jon', evidence: 'journal:heat-pumps/decision:x#1', now: NOW });
    const after = readinessView(root, DEFAULTS);
    expect(after.find((r) => r.key === 'x-post')!.verified).toMatchObject({ by: 'Jon' });
    expect(after.find((r) => r.key === 'x-post')!.enabled).toBe(false);
    expect(loadAutomation(root).enabled.social).toBe(false);
  });
});

describe('verify (the one writer of readiness.json)', () => {
  it('refuses an automated actor, a placeholder, an unknown integration and dangling evidence; writes nothing', () => {
    const root = fresh();
    const ev = 'ledger:heat-pumps/decision:x#published';
    expect(() => verify(root, 'youtube-upload', { by: 'automated: tick', evidence: ev, now: NOW })).toThrow(/person/);
    expect(() => verify(root, 'youtube-upload', { by: '<name>', evidence: ev, now: NOW })).toThrow(/name/);
    expect(() => verify(root, 'nope', { by: 'Jon', evidence: ev, now: NOW })).toThrow(/unknown integration/);
    expect(() =>
      verify(root, 'youtube-upload', { by: 'Jon', evidence: 'ledger:heat-pumps/decision:x#verified', now: NOW }),
    ).toThrow(/no such record/);
    expect(() =>
      verify(root, 'youtube-upload', { by: 'Jon', evidence: 'journal:heat-pumps/decision:x#9', now: NOW }),
    ).toThrow(/no such record/);
    expect(() => verify(root, 'youtube-upload', { by: 'Jon', evidence: '<nope@test>', now: NOW })).toThrow(
      /no such record/,
    );
    expect(() => verify(root, 'youtube-upload', { by: 'Jon', evidence: 'because I say so', now: NOW })).toThrow(
      /evidence must name a record/,
    );
    expect(loadReadiness(root)).toEqual({});
  });
  it('accepts evidence that exists (a ledger event, a journal line, a Message-ID the outbox holds), binds it, and repeats idempotently', () => {
    const root = fresh();
    const r1 = verify(root, 'youtube-go-live', {
      by: 'Jon',
      evidence: 'ledger:heat-pumps/decision:x#published',
      now: NOW,
    });
    expect(r1.changed).toBe(true);
    expect(loadReadiness(root)['youtube-go-live']).toEqual({
      at: NOW.toISOString(),
      by: 'Jon',
      evidence: 'ledger:heat-pumps/decision:x#published',
    });
    const again = verify(root, 'youtube-go-live', {
      by: 'Jon',
      evidence: 'ledger:heat-pumps/decision:x#published',
      now: new Date('2026-11-11T00:00:00Z'),
    });
    expect(again.changed).toBe(false);
    expect(loadReadiness(root)['youtube-go-live'].at).toBe(NOW.toISOString()); // the first verification stands
    verify(root, 'approval-mail-send', { by: 'Jon', evidence: '<m1@test>', now: NOW });
    verify(root, 'research-pipeline', { by: 'Jon', evidence: 'journal:heat-pumps/decision:x#1', now: NOW });
    expect(Object.keys(loadReadiness(root)).sort()).toEqual([
      'approval-mail-send',
      'research-pipeline',
      'youtube-go-live',
    ]);
    expect(readinessProblems(loadReadiness(root))).toEqual([]);
  });
  it('the loader refuses a record with an unknown key, a missing field or an automated actor (validated at build)', () => {
    expect(readinessProblems({ nope: { at: 'x', by: 'Jon', evidence: 'e' } })).toContain('nope: unknown integration');
    expect(readinessProblems({ 'x-post': { at: 'x', by: 'automated: tick', evidence: 'e' } })).toContain(
      'x-post.by: a person verifies, never an automated actor',
    );
    expect(readinessProblems({ 'x-post': { at: 'x', by: 'Jon' } })).toContain('x-post.evidence: missing');
    expect(readinessProblems(loadReadiness(ROOT)), 'the committed readiness.json').toEqual([]);
  });
  it('the verb: npm run run -- verified <integration> --by <name> --evidence <ref> (refusals exit 2)', () => {
    const root = fresh();
    const env = { ...process.env, VK_NO_DOTENV: '1' };
    const bad = runCli('run', ['verified', 'x-post', '--by', 'automated: tick', '--evidence', '<m1@test>'], {
      cwd: root,
      env,
    });
    expect(bad.status).toBe(2);
    expect(bad.stderr).toMatch(/person/);
    const ok = runCli('run', ['verified', 'x-post', '--by', 'Jon', '--evidence', '<m1@test>'], { cwd: root, env });
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toMatch(/verified x-post/);
    expect(readJson<Record<string, unknown>>(join(root, READINESS_FILE))!['x-post']).toMatchObject({
      by: 'Jon',
      evidence: '<m1@test>',
    });
    expect(loadAutomation(root).enabled.social).toBe(false); // verification never enables
  });
});
