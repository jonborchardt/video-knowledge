// Acceptance criterion 3 (spec §13), phase 2's half: a story runs from its graphics to `packaged` with the real CLIs,
// the fake agent for the script, its review and the storyboard, and an injected executor that stands in for the
// media steps (spike, package) and the article stage by writing what the fixture would. The writer and the reviewer
// are different sessions; the board's column ends at draft review. (The Shorts of a release group are proven by
// shorts-run.test.ts, release.test.ts and the real fixture run: the synthetic story has no Short candidate.)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadAutomation } from '../../src/shared/automation';
import { FILES, ROOT, readJson, toJson } from '../../src/shared/io';
import type { Release, Storyboard } from '../../src/shared/types';
import { ARTICLE_FILES } from '../../src/modules/article';
import { article } from '../../src/modules/article/tests/article-helpers';
import { columnOf, productionOf, topicBoard } from '../../src/orchestration/production';
import { readJournal, runDir } from '../../src/orchestration/run/journal';
import { runStory } from '../../src/orchestration/run/runner';
import { execStep } from '../../src/orchestration/run/steps';
import {
  type Fixture,
  cliRoot,
  copyTopic,
  fixtureBuildReport,
  fixtureReviewFiles,
  syntheticProduction,
} from '../production-helpers';

const cleanups: (() => void)[] = [];
afterAll(() => cleanups.forEach((c) => c()));
const FAKE_CLAUDE = join(ROOT, 'tests', 'automation', 'fake-claude.mjs');

describe('a full run to packaged (criterion 3)', () => {
  it('reaches packaged with distinct writer and reviewer sessions, a released article and the draft-review column', async () => {
    const src = syntheticProduction('graphics');
    cleanups.push(src.cleanup);
    const c = copyTopic(src.topic);
    cleanups.push(c.cleanup);
    cliRoot(c.root);
    const dir = c.dir(src.story);
    const { rmSync } = await import('node:fs');
    rmSync(dir, { recursive: true, force: true });
    const from = (f: string) => join(src.dir, f).replaceAll('\\', '/');
    const to = (f: string) => join(dir, f).replaceAll('\\', '/');
    const scenario = join(c.root, 'scenario.json');
    writeFileSync(
      scenario,
      JSON.stringify([
        { match: 'briefs/script\\.md', actions: [{ copy: from(FILES.script), to: to(FILES.script) }], cost: 0.3 },
        {
          match: 'briefs/script-review\\.md',
          actions: [{ copy: from(FILES.review), to: to(FILES.review) }],
          cost: 0.2,
        },
        {
          match: 'briefs/storyboard\\.md',
          actions: [{ copy: from(FILES.storyboard), to: to(FILES.storyboard) }],
          cost: 0.2,
        },
      ]),
    );
    const a = loadAutomation(join(c.root, 'no-automation-file'));
    const fake = { ...a, agents: { ...a.agents, command: `node ${FAKE_CLAUDE}` } };
    const f: Fixture = { root: c.root, topic: src.topic, story: src.story, dir, cleanup: () => {} };
    const media: string[] = [];
    const r = await runStory(f.topic, f.story, fake, {
      approver: 'automated: full run',
      root: f.root,
      until: 'packaged',
      git: 'none',
      validate: () => ({ ok: true, output: '' }),
      hooks: {
        snapshot: () => {},
        guard: () => ({ ok: true, why: '', kept: [] }),
        componentCheck: () => ({ ok: true, output: '' }),
      },
      env: { ...process.env, FAKE_CLAUDE_SCENARIO: scenario },
      exec: async (auto, step, ctx) => {
        const ok = {
          kind: step.kind,
          ok: true,
          exit: 0,
          ms: 1,
          costUsd: 0,
          sessionId: null,
          error: null,
          log: '',
        } as const;
        // the media steps: what a spike and a package leave behind, from the fixture's own builders
        if (/^npm run video -- spike /.test(step.text)) {
          media.push('spike');
          const sb = readJson<Storyboard>(join(dir, FILES.storyboard))!;
          const release = readJson<Release>(join(dir, FILES.release))!;
          writeFileSync(
            join(dir, 'video', 'build-report.json'),
            toJson(fixtureBuildReport(dir, release, sb, false, f.root)),
          );
          return ok;
        }
        if (/^npm run video -- package /.test(step.text)) {
          media.push('package');
          fixtureReviewFiles(dir, readJson<{ title: string }>(join(dir, FILES.script))!.title, false);
          return ok;
        }
        // the article stage: the writer's prompt stands in for writer, reviewer and lock, as the packaged fixture does
        if (step.kind === 'prompt' && /article\.md/.test(step.text)) {
          media.push('article');
          writeFileSync(
            join(dir, ARTICLE_FILES.release),
            toJson({
              topic: f.topic,
              story: f.story,
              approvedBy: 'fixture approver',
              date: '2026-01-01',
              revision: 1,
              fingerprints: { article: '', package: '', validation: '' },
              article: article({ topic: f.topic, story: f.story }),
              history: [],
            }),
          );
          return { ...ok, costUsd: 0.1, sessionId: 'fake-article' };
        }
        return execStep(auto, step, ctx);
      },
    });
    expect(r.halt, JSON.stringify(r.halt)).toBeNull();
    expect(r.outcome).toBe('done');
    expect(r.stage).toBe('packaged');
    expect(media).toEqual(['spike', 'article', 'package']);
    expect(existsSync(join(dir, ARTICLE_FILES.release))).toBe(true);
    expect(existsSync(join(dir, 'video', 'review', 'review.json'))).toBe(true);
    const j = readJournal(runDir(f.topic, f.story, f.root));
    const prompts = j.filter((e) => e.kind === 'prompt');
    const writer = prompts.find((e) => /script\.md/.test(e.step) && !/review/.test(e.step));
    const reviewer = prompts.find((e) => /script-review\.md/.test(e.step));
    expect(writer?.sessionId).toBeTruthy();
    expect(reviewer?.sessionId).toBeTruthy();
    expect(writer?.sessionId).not.toBe(reviewer?.sessionId);
    expect(j.filter((e) => e.kind === 'run' && /script -- lock/.test(e.step))).toHaveLength(1);
    const prod = productionOf(f.topic, f.story, f.root)!;
    expect(prod.stage).toBe('packaged');
    const row = topicBoard(f.topic, f.root).stories.find((s) => s.story.id === f.story)!;
    expect(columnOf(row)).toBe('draft-review');
    expect(readFileSync(join(dir, 'video', 'review', 'review.json'), 'utf8')).toContain('private review build');
  }, 600_000);
});
