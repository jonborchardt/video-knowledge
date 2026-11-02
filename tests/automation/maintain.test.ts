// The maintenance scan as a work-plane job (spec §2 Maintenance, §10; phase 6 Task 2): the due topic chosen (oldest
// scan first), the sequence (the scan agent, record-sources, scanned, report, notes, stories, the article pass), a
// scan that records nothing journaled and not a halt, a revision on a claim a live video's script cites named as a
// needs-person halt on that story, an uncited one not. Fake agents, the fake research CLI, the real `scanned`.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { cliArgv } from '../../src/shared/cli';
import { ROOT, readJson, toJson } from '../../src/shared/io';
import { FakeMail } from '../../src/shared/mail';
import type { MaintenanceFile, Script } from '../../src/shared/types';
import { maintenancePath } from '../../src/modules/evidence/maintenance';
import { appendEvent, emptyLedger, loadLedger, publishPath, saveLedger } from '../../src/modules/publishing/publish';
import { readAttempts, readHalt, readJournal, runDir, topicRunDir } from '../../src/orchestration/run/journal';
import { maintain, scanJobs } from '../../src/orchestration/run/maintain';
import { type Fixture, cliRoot, syntheticProduction } from '../production-helpers';

const FAKE_CLAUDE = join(ROOT, 'tests', 'automation', 'fake-claude.mjs');
const FAKE_CLI = join(ROOT, 'tests', 'automation', 'fake-research-cli.mjs');
const fixtures: Fixture[] = [];
afterAll(() => fixtures.forEach((f) => f.cleanup()), 120_000);
const NOW = Date.parse('2026-12-01T12:00:00Z');
const a = {
  ...DEFAULTS,
  enabled: { ...DEFAULTS.enabled, maintenance: true },
  schedule: { ...DEFAULTS.schedule, maintenance: { everyDays: 30 } },
  approvals: { ...DEFAULTS.approvals, to: 'jon@example.test', from: 'automation@example.test', approverName: 'Jon' },
  notifications: { to: 'jon@example.test', digest: { weekday: 'monday', hour: 8 } },
  agents: { ...DEFAULTS.agents, command: `node ${FAKE_CLAUDE}` },
};

function staged(opts: { found?: boolean; live?: boolean; revised?: string[] } = {}) {
  const f = syntheticProduction('packaged', { release: true });
  fixtures.push(f);
  cliRoot(f.root);
  const claims = readJson<{ topics: { claims: { id: string }[] }[] }>(
    join(f.root, 'topics', f.topic, 'store', 'topics.json'),
  )!.topics[0].claims;
  const target = claims[0].id;
  // the fixture's script carries no assertions; a production script cites its claims through them
  const script = readJson<Script>(join(f.dir, 'script.json'))!;
  script.sections[0].sentences[0].assertions = [
    { id: 's1.a', text: 'x', kind: 'fact', claims: [{ id: target, stance: 'asserts' }], evidence: [] },
  ];
  writeFileSync(join(f.dir, 'script.json'), toJson(script));
  if (opts.live) {
    const l = loadLedger(f.topic, f.story, f.root) ?? emptyLedger(`${f.topic}/${f.story}`);
    saveLedger(
      publishPath(f.topic, f.story, f.root),
      appendEvent(l, 'youtube', { at: '2026-11-01T00:00:00Z', type: 'published', by: 'Jon', id: 'vid00000000' }).ledger,
    );
  }
  const scenario = join(f.root, 'scenario.json');
  const svFile = `topics/${f.topic}/work/sv_scan-2026-12-01.json`;
  writeFileSync(
    scenario,
    JSON.stringify([
      {
        match: 'new-sources\\.md',
        actions:
          opts.found === false
            ? [{ write: svFile, text: '[]' }]
            : [
                {
                  write: `topics/${f.topic}/sources/new-2026-survey.txt`,
                  text: 'Source: https://x.test/survey-2026 (retrieved 2026-12-01)\n\nA 2026 survey.\nIt revises the finding.\n',
                },
                {
                  write: svFile,
                  text: JSON.stringify([
                    {
                      claim: target,
                      verdict: 'partly',
                      confidence: 0.7,
                      note: 'the 2026 survey finds a smaller effect',
                      source: `${f.topic}/sources/new-2026-survey.txt#L3-L4`,
                      applicability: 'direct',
                    },
                  ]),
                },
              ],
        cost: 0.5,
        result:
          opts.found === false
            ? 'nothing new: searched Europe PMC and the CFPB'
            : 'new-2026-survey.txt: the central claim',
      },
      {
        match: 'revision-note\\.md',
        actions: [],
        cost: 0.1,
        result: `${target}: A 2026 survey of 2,000 participants revises the finding from supported to partly supported.`,
      },
    ]),
  );
  const config = join(f.root, 'research-config.json');
  writeFileSync(config, JSON.stringify({ storiesMode: 'keep', revisedClaims: opts.revised ?? [target] }));
  const env = { ...process.env, FAKE_CLAUDE_SCENARIO: scenario, FAKE_RESEARCH_CONFIG: config, VK_NO_DOTENV: '1' };
  // the research CLIs are the fake, except `evidence scanned` (the real record) and the checks
  const argvOf = (cli: string, args: string[]): [string, string[]] =>
    cli === 'evidence' && args[0] === 'scanned' ? cliArgv(cli, args) : [process.execPath, [FAKE_CLI, cli, ...args]];
  const mail = new FakeMail();
  const articleCalls: string[] = [];
  const run = (over: { validate?: () => { ok: boolean; output: string } } = {}) =>
    maintain(
      f.topic,
      a,
      {
        now: () => NOW,
        mail,
        env,
        argvOf,
        git: 'none',
        validate: over.validate ?? (() => ({ ok: true, output: '' })),
        hooks: { snapshot: () => {}, guard: () => ({ ok: true, why: '', kept: [] }) },
        articles: async (topic) => {
          articleCalls.push(topic);
          return { actions: [`${topic}: article pass stub`], halted: [] };
        },
        runId: 'scan1',
      },
      f.root,
    );
  const journal = () => readJournal(topicRunDir(f.topic, f.root));
  return { f, mail, run, journal, articleCalls, target };
}

describe('scanJobs', () => {
  it('picks the due public topic with the oldest scan, one at a time, never when the flag is off', () => {
    const f = syntheticProduction('packaged');
    fixtures.push(f);
    writeFileSync(maintenancePath(f.topic, f.root), toJson({ lastScan: '2026-10-01T00:00:00Z', scans: [] }));
    const jobs = scanJobs(a, f.root, NOW, [f.topic]);
    expect(jobs).toEqual([{ kind: 'scan', topic: f.topic, why: 'maintenance scan: last 2026-10-01T00:00:00Z' }]);
    writeFileSync(maintenancePath(f.topic, f.root), toJson({ lastScan: '2026-11-20T00:00:00Z', scans: [] }));
    expect(scanJobs(a, f.root, NOW, [f.topic])).toEqual([]);
    expect(scanJobs({ ...a, enabled: { ...a.enabled, maintenance: false } }, f.root, NOW, [f.topic])).toEqual([]);
    expect(scanJobs(a, f.root, NOW, ['test-fixture', 'no-such-topic'])).toEqual([]); // the fixture and a topic without a report never
  });
});

describe('maintain', () => {
  it('the scan records a new verdict, the scan itself, the report, a drafted note and the stories, then runs the article pass; a live video citing the revised claim halts needs-person', async () => {
    const c = staged({ live: true });
    const r = await c.run();
    expect(r.outcome, JSON.stringify(r.halt)).toBe('done');
    expect(r.actions.join('\n')).toMatch(/scan found 1 document, 1 verdict/);
    const steps = c.journal().map((e) => e.step);
    expect(steps.some((s) => /new-sources\.md/.test(s))).toBe(true);
    const scan = c.journal().find((e) => /new-sources\.md/.test(e.step))!;
    expect(scan.models?.[0]?.model).toBe('fake-sonnet');
    expect(scan.modelRequested).toBe('opus');
    expect(
      readAttempts(topicRunDir(c.f.topic, c.f.root)).some((x) => x.costUsd === scan.costUsd && x.role === 'collect'),
    ).toBe(true);
    expect(steps.some((s) => /^npm run record-sources -- /.test(s))).toBe(true);
    expect(steps.some((s) => /^npm run evidence -- scanned /.test(s))).toBe(true);
    expect(steps.some((s) => s === 'npm run report')).toBe(true);
    expect(steps.some((s) => /revision-note\.md/.test(s))).toBe(true);
    expect(steps.some((s) => /^npm run report -- note /.test(s))).toBe(true);
    expect(steps.some((s) => /^npm run stories -- discover /.test(s))).toBe(true);
    const m = readJson<MaintenanceFile>(maintenancePath(c.f.topic, c.f.root))!;
    expect(m.lastScan).toBe(new Date(NOW).toISOString());
    expect(m.scans[0]).toMatchObject({ found: 1, recorded: 1 });
    expect(c.articleCalls).toEqual([c.f.topic]);
    expect(r.actions.join('\n')).toMatch(/article pass stub/);
    // the live video cites the revised claim: never rebuilt, a person decides about a note
    const h = readHalt(runDir(c.f.topic, c.f.story, c.f.root));
    expect(h?.kind, r.actions.join(' | ')).toBe('needs-person');
    expect(h?.why).toContain(c.target);
    expect(h?.unblock.text).toMatch(/publish -- push|run -- clear/);
    expect(r.actions.join('\n')).toMatch(/live video cites a revised finding/);
    expect(readHalt(topicRunDir(c.f.topic, c.f.root))).toBeNull(); // the scan itself is not halted
    expect(scanJobs(a, c.f.root, NOW, [c.f.topic])).toEqual([]); // scanned today
    const pr = readJson<{ revisions: { note: string }[] }>(join(c.f.root, 'topics', c.f.topic, 'public-record.json'))!;
    expect(pr.revisions.find((x) => x.note.includes('2026 survey'))).toBeTruthy();
  }, 240_000);

  it('a scan halted after its verdicts were recorded resumes into the report, notes, stories and article pass without a second agent (review finding 4)', async () => {
    const c = staged({ live: true });
    const first = await c.run({ validate: () => ({ ok: false, output: 'planted failure' }) });
    expect(first.outcome).toBe('halted');
    expect(first.halt?.kind).toBe('step-failed');
    const second = await c.run();
    expect(second.outcome, JSON.stringify(second.halt)).toBe('done');
    const steps = c.journal().map((e) => e.step);
    expect(steps.filter((s) => /new-sources\.md/.test(s))).toHaveLength(1);
    expect(steps.filter((s) => /^npm run record-sources -- /.test(s))).toHaveLength(1);
    expect(steps.filter((s) => s === 'npm run report')).toHaveLength(2);
    expect(c.articleCalls).toEqual([c.f.topic]);
    expect(readJson<MaintenanceFile>(maintenancePath(c.f.topic, c.f.root))!.scans).toHaveLength(1);
    expect(readHalt(runDir(c.f.topic, c.f.story, c.f.root))?.kind).toBe('needs-person');
  }, 300_000);

  it('a scan that finds nothing new is journaled and records the scan, with no report, no article pass and no halt', async () => {
    const c = staged({ found: false, live: true });
    const r = await c.run();
    expect(r.outcome).toBe('done');
    expect(r.actions.join('\n')).toMatch(/nothing new recorded/);
    const steps = c.journal().map((e) => e.step);
    expect(steps.some((s) => s === 'npm run report')).toBe(false);
    expect(c.articleCalls).toEqual([]);
    expect(readJson<MaintenanceFile>(maintenancePath(c.f.topic, c.f.root))!.scans[0]).toMatchObject({
      found: 0,
      recorded: 0,
    });
    expect(readHalt(runDir(c.f.topic, c.f.story, c.f.root))).toBeNull();
  }, 240_000);

  it('a revision on a claim no live video cites leaves the story alone', async () => {
    const c = staged({ live: true, revised: [`${'heat-pumps'}/no-script-cites-this`] });
    const r = await c.run();
    expect(r.outcome).toBe('done');
    expect(readHalt(runDir(c.f.topic, c.f.story, c.f.root))).toBeNull();
    expect(r.actions.join('\n')).not.toMatch(/live video cites/);
  }, 240_000);
});
