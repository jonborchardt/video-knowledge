import { describe, expect, it } from 'vitest';
import { loadTopic, topicNames } from '../src/lib/topics';

describe('topics', () => {
  const names = topicNames();

  it('finds topics with claims and skips empty ones', () => {
    expect(names).toContain('ai-coding');
    expect(names).not.toContain('glp1'); // has a report.json but no claims yet
  });

  it.each(names)('%s: page data is consistent', (name) => {
    const t = loadTopic(name);
    expect(t.claims.length).toBeGreaterThan(0);
    expect(t.counted).toBe(t.videos + t.posts);
    expect(t.top.length).toBeLessThanOrEqual(5);
    for (const c of t.claims) {
      // A shown confidence only belongs to a real judgment, and an AI guess never shows more than 50%.
      if (c.confidence !== null) expect(['right', 'wrong', 'partly']).toContain(c.verdict);
      if (!c.decidedBy && c.confidence !== null) expect(c.confidence).toBeLessThanOrEqual(0.5);
    }
    for (const g of t.recap) expect(g.claims.length).toBeGreaterThan(0);
    expect(t.bottomLine ?? '').not.toMatch(/\{\w+\}/); // template tokens filled
  });
});
