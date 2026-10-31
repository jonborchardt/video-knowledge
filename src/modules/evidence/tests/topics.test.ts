import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { topicDir } from '../../../shared/io';
import { checkApplicabilityFile } from '../batches';
import { APPLICABILITY_FILE, loadTopic, publicTopicNames, topicNames } from '../topics';

describe('topics', () => {
  const names = topicNames();

  it('finds topics with claims and skips empty ones', () => {
    expect(names).toContain('ai-coding');
    expect(names).not.toContain('glp1'); // has a report.json but no claims yet
  });

  it('a numbered source carries its exhibit number, unique within the topic; a source of no live story has none', () => {
    for (const n of publicTopicNames()) {
      const nums = loadTopic(n)
        .sources.map((s) => s.exhibit)
        .filter((x) => x !== null);
      expect(nums.every((x) => typeof x === 'number')).toBe(true);
      expect(new Set(nums).size).toBe(nums.length);
    }
  });

  it.each(names)('%s: every recorded applicability names a recorded study verdict', (name) => {
    const path = join(topicDir(name), APPLICABILITY_FILE);
    if (!existsSync(path)) return;
    const file = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    expect(checkApplicabilityFile(file)).toEqual([]);
    // The store itself, not loadTopic, whose by+note dedup can hide an older cite.
    const keys = new Set<string>();
    const videos = join(topicDir(name), 'store', 'videos');
    for (const f of readdirSync(videos)) {
      const x = JSON.parse(readFileSync(join(videos, f), 'utf8')) as {
        assertions?: { claim: string; verdicts?: { method?: string; source?: string }[] }[];
      };
      for (const a of x.assertions ?? [])
        for (const v of a.verdicts ?? []) if (v.method === 'source' && v.source) keys.add(`${a.claim}|${v.source}`);
    }
    expect(Object.keys(file).filter((k) => !keys.has(k))).toEqual([]);
  });

  it.each(names)('%s: page data is consistent', (name) => {
    const t = loadTopic(name);
    expect(t.claims.length).toBeGreaterThan(0);
    expect(t.counted).toBe(t.videos + t.posts);
    expect(t.channels).toBeGreaterThan(0);
    expect(t.channels).toBeLessThanOrEqual(t.counted);
    if (t.videos) expect(t.hours).toBeGreaterThan(0);
    if (t.glyph) expect(t.glyph).toMatch(/^<svg[\s\S]*<\/svg>$/);
    expect(t.top.length).toBeLessThanOrEqual(5);
    for (const c of t.claims) {
      // A shown confidence only belongs to a real judgment, and an AI guess never shows more than 50%.
      if (c.confidence !== null) expect(['right', 'wrong', 'partly']).toContain(c.verdict);
      if (!c.decidedBy && c.confidence !== null) expect(c.confidence).toBeLessThanOrEqual(0.5);
    }
    for (const g of t.recap) expect(g.claims.length).toBeGreaterThan(0);
    for (const s of t.sources) {
      expect(s.claims.length).toBeGreaterThan(0);
      for (const sc of s.claims) {
        expect(sc.share).toBeGreaterThanOrEqual(1);
        if (sc.novel) expect(sc.verdict).toBe('right');
        if (sc.share > 3) expect(sc.novel).toBe(false);
        // Denying a claim the evidence calls wrong counts as getting it right.
        const c = t.claims.find((x) => x.id === sc.id)!;
        if (sc.stance === 'denies' && c.verdict === 'wrong') expect(sc.verdict).toBe('right');
        if (sc.stance === 'asserts' && c.verdict === 'wrong') expect(sc.verdict).toBe('wrong');
      }
      // Novel claims come first, rarest first.
      const firstPlain = s.claims.findIndex((x) => !x.novel);
      if (firstPlain >= 0) expect(s.claims.slice(firstPlain).some((x) => x.novel)).toBe(false);
    }
    expect(t.bottomLine ?? '').not.toMatch(/\{\w+\}/); // template tokens filled
  });
});

describe('source documents', () => {
  // A cite counts LF lines, but the passage reader also breaks lines at a bare CR, so a CR inside a row (a table
  // pasted from a web page) shifts every later line and the gate checks figures against the wrong rows.
  it.each(topicNames())('%s: no source has a bare carriage return', (topic) => {
    const dir = join(topicDir(topic), 'sources');
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.txt')) : [];
    const bad = files.filter((f) => /\r(?!\n)/.test(readFileSync(join(dir, f), 'utf8')));
    expect(bad).toEqual([]);
  });
});
