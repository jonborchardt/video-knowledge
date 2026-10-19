// The production board derives every stage from the committed artifacts; the locked MLM package must read as locked
// with no blockers, and every topic must derive without throwing.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readJson, toJson } from '../src/lib/io';
import { board, boardNext, productionOf, stepsOf, validationHaltKind } from '../src/lib/production';
import { type Script, scriptDir, scriptDirs } from '../src/lib/script';
import { copyTopic } from './production-helpers';
import { blockedScript, run } from './script-helpers';

describe('production board', () => {
  const topics = board();

  it('derives every topic', () => {
    expect(topics.length).toBeGreaterThan(0);
    for (const t of topics) {
      expect(t.checks.map((c) => c.name)).toContain('report');
      expect(t.next).not.toBe('');
      for (const s of t.stories) expect(s.next).not.toBe('');
    }
  });

  it.each(scriptDirs())('$topic/scripts/$slug reads as its lock says', ({ topic, dir }) => {
    const prod = topics
      .flatMap((t) => t.stories)
      .find((s) => s.production?.dir.endsWith(dir.split(/[\\/]/).pop()!))!.production!;
    const names = prod.checks.map((c) => c.name);
    expect(names.slice(0, 6)).toEqual(['evidence package', 'script', 'validation', 'review', 'storyboard', 'release']);
    const locked = prod.checks.find((c) => c.name === 'release')!.health === 'done';
    if (locked) {
      expect(['locked', 'video', 'rendered', 'scored', 'packaged']).toContain(prod.stage);
      expect(names.includes('video')).toBe(prod.stage !== 'locked' || prod.checks.some((c) => c.name === 'video'));
      expect(prod.blockers).toEqual([]);
      expect(prod.versions.some((v) => v.locked)).toBe(true);
    } else expect(prod.stage).not.toBe('locked');
    expect(productionOf(topic, prod.story)?.stage).toBe(prod.stage);
  });

  it('a story without a scripts directory has no production', () => {
    expect(productionOf('get-rich-quick', 'decision:no-such-story')).toBeNull();
  });

  it('a halt at the first stage says why and what to run', () => {
    const root = mkdtempSync(join(tmpdir(), 'vk-board-'));
    try {
      mkdirSync(scriptDir('get-rich-quick', 'decision:empty', root), { recursive: true });
      const prod = productionOf('get-rich-quick', 'decision:empty', root)!;
      expect(prod.stage).toBe('package');
      expect(prod.blockers).toEqual(['no evidence package']);
      expect(prod.next).toBe('npm run script -- package get-rich-quick decision:empty');
      expect(prod.halt).toEqual({ kind: 'missing', stage: 'package', why: 'no evidence package' });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('halt kinds', () => {
  it('a blocked validation maps to revision-limit or blocking-findings', () => {
    expect(validationHaltKind(run(blockedScript(3)))).toBe('revision-limit');
    expect(validationHaltKind(run(blockedScript(1)))).toBe('blocking-findings');
  });

  it('a script asking for evidence halts with needs-evidence', () => {
    const c = copyTopic('heat-pumps');
    try {
      const story = 'decision:when-does-it-pay-for-itself';
      const f = join(c.dir(story), 'script.json');
      const s = readJson<Script>(f)!;
      s.generation.needsEvidence = [{ claim: 'heat-pumps/heat-pump-pays-itself-through-lower', why: 'baseline' }];
      writeFileSync(f, toJson(s));
      const prod = productionOf('heat-pumps', story, c.root)!;
      expect(prod.halt?.kind).toBe('needs-evidence');
      expect(prod.next.startsWith('agent: scripts/briefs/evidence.md')).toBe(true);
    } finally {
      c.cleanup();
    }
  });
});

describe('board next', () => {
  it('boardNext for a story without a script dir', () => {
    const n = boardNext('heat-pumps', 'decision:what-happens-when-it-gets-cold');
    expect(n.stage).toBe('package');
    expect(n.steps).toEqual([
      { kind: 'run', text: 'npm run script -- package heat-pumps decision:what-happens-when-it-gets-cold' },
    ]);
    expect(n.done).toBe(false);
  });

  it('boardNext of an unknown story stops', () => {
    expect(boardNext('heat-pumps', 'decision:no-such-story').halt?.kind).toBe('story-left');
  });

  it('boardNext of a packaged story is done', () => {
    expect(boardNext('get-rich-quick', 'decision:mlm-and-seminars').done).toBe(true);
  });
});

describe('next steps', () => {
  it('splits a next line into commands, agent prompts and manual steps', () => {
    const steps = stepsOf(
      'agent: scripts/briefs/script-review.md (re-review), then npm run script -- validate t s; public release is blocked: draft voice',
      't',
      's',
    );
    expect(steps.map((x) => x.kind)).toEqual(['prompt', 'run', 'do']);
    expect(steps[0].text).toContain('Read scripts/briefs/script-review.md');
    expect(steps[0].text).toContain('Story: s');
    expect(steps[0].text).toContain('re-review');
    expect(steps[1].text).toBe('npm run script -- validate t s');
    expect(stepsOf('1 listed; 1 not fetched (npm run report)', 't')).toEqual([
      { kind: 'do', text: '1 listed; 1 not fetched' },
      { kind: 'run', text: 'npm run report' },
    ]);
  });

  it('gives every board item at least one step', () => {
    for (const t of board()) {
      expect(stepsOf(t.next, t.topic.name).length).toBeGreaterThan(0);
      for (const r of t.stories) expect(stepsOf(r.next, t.topic.name, r.story.id).length).toBeGreaterThan(0);
    }
  });
});

describe('upload values', () => {
  it('gives the packaged MLM video the YouTube form values from its review package', () => {
    const p = productionOf('get-rich-quick', 'decision:mlm-and-seminars');
    if (p?.stage !== 'packaged') return; // only once the review package is current
    expect(p.upload?.file).toMatch(/video\/review\/.+\.mp4$/);
    expect(p.upload?.title).toContain('MLM');
    expect(p.upload?.description).toContain('Chapters');
  });
});
