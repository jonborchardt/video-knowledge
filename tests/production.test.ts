// The production board derives every stage from the committed artifacts; the locked MLM package must read as locked
// with no blockers, and every topic must derive without throwing.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board, productionOf } from '../src/lib/production';
import { scriptDir, scriptDirs } from '../src/lib/script';

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
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
