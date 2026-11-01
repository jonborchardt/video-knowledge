// Acceptance criterion 11, first half (spec §13): a run killed mid-render resumes without rendering a scene twice.
// The fake render writes one marker per scene, skipping the ones that exist (Remotion's chunk cache); the runner
// process is killed after the first markers appear; the resumed run writes only the missing ones.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadAutomation } from '../../src/shared/automation';
import { cliArgv } from '../../src/shared/cli';
import { FILES, ROOT, readJson, toJson } from '../../src/shared/io';
import type { Release, Storyboard } from '../../src/shared/types';
import { readJournal, runDir } from '../../src/orchestration/run/journal';
import { readLock } from '../../src/orchestration/run/lock';
import { runStory } from '../../src/orchestration/run/runner';
import { type Fixture, cliRoot, fixtureBuildReport, syntheticProduction } from '../production-helpers';

const fixtures: Fixture[] = [];
afterAll(() => fixtures.forEach((f) => f.cleanup()), 120_000); // many temp roots: slow under full-suite load
const FAKE_RENDER = join(ROOT, 'tests', 'automation', 'fake-render.mjs');

describe('a run killed mid-render (criterion 11)', () => {
  it('resumes at the render, keeps the rendered scenes and renders only the missing ones, journaling one resume', async () => {
    const f = syntheticProduction('locked');
    fixtures.push(f);
    cliRoot(f.root);
    const sb = readJson<Storyboard>(join(f.dir, FILES.storyboard))!;
    const release = readJson<Release>(join(f.dir, FILES.release))!;
    const template = join(f.root, 'report-template.json');
    writeFileSync(template, toJson(fixtureBuildReport(f.dir, release, sb, false, f.root)));
    const scenes = join(f.dir, 'video', 'scenes');
    const markers = () =>
      existsSync(scenes)
        ? readdirSync(scenes)
            .filter((n) => n.endsWith('.marker'))
            .sort()
        : [];
    expect(sb.scenes.length).toBeGreaterThanOrEqual(3);

    // the driver renders 1.2 s per scene; killed once two scenes are on disk
    const [exe, argv] = cliArgv('board', []);
    const tsx = argv.slice(0, 3);
    const driver = join(ROOT, 'tests', 'automation', 'render-driver.ts');
    const child = spawn(exe, [...tsx, driver, f.root, f.topic, f.story, f.dir, '1200', template], {
      cwd: ROOT,
      stdio: 'ignore',
      windowsHide: true,
    });
    const started = Date.now();
    while (markers().length < 2 && Date.now() - started < 240_000) await new Promise((r) => setTimeout(r, 200));
    expect(markers().length).toBeGreaterThanOrEqual(2);
    expect(markers().length).toBeLessThan(sb.scenes.length);
    const dir = runDir(f.topic, f.story, f.root);
    const lock = readLock(dir);
    child.kill();
    await new Promise((r) => child.on('exit', r));
    const before = Object.fromEntries(markers().map((m) => [m, readFileSync(join(scenes, m), 'utf8')]));
    expect(lock?.childStep).toMatch(/video -- spike/);
    expect(existsSync(join(f.dir, 'video', 'build-report.json'))).toBe(false); // the render never finished

    // the resumed run: the same fake, no sleep; the markers already there are kept byte for byte
    const a = loadAutomation(join(f.root, 'no-automation-file'));
    const r = await runStory(f.topic, f.story, a, {
      approver: 'automated: crash test',
      root: f.root,
      until: 'article',
      git: 'none',
      validate: () => ({ ok: true, output: '' }),
      hooks: {
        snapshot: () => {},
        guard: () => ({ ok: true, why: '', kept: [] }),
        componentCheck: () => ({ ok: true, output: '' }),
      },
      argvOf: (cli, args) =>
        cli === 'video' && args[0] === 'spike'
          ? [process.execPath, [FAKE_RENDER, f.dir, '0', template]]
          : cliArgv(cli, args),
    });
    expect(r.outcome).toBe('done');
    expect(r.stage).toBe('article');
    expect(markers()).toEqual(sb.scenes.map((s) => `${s.id}.marker`).sort());
    for (const [m, text] of Object.entries(before)) expect(readFileSync(join(scenes, m), 'utf8')).toBe(text);
    expect(statSync(join(f.dir, 'video', 'build-report.json')).size).toBeGreaterThan(0);
    const j = readJournal(dir);
    expect(j.filter((e) => e.kind === 'resume')).toHaveLength(1);
    expect(j.filter((e) => e.kind === 'run' && /video -- spike/.test(e.step))).toHaveLength(1); // the killed one never journaled
  }, 300_000);
});
