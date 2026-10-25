import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadMoved, manifestProblems } from '../src/lib/content-graph';
import { toJson, topicDir } from '../src/lib/io';

let root = '';
afterEach(() => root && rmSync(root, { recursive: true, force: true }));

describe('links that cannot silently break', () => {
  it('a lost url fails until moved maps it', () => {
    expect(manifestProblems(['/heat-pumps/old/'], new Set(['/heat-pumps/new/']))).toEqual([
      'lost /heat-pumps/old/: add a moved.json entry',
      'new /heat-pumps/new/: run npm run links -- freeze',
    ]);
    expect(manifestProblems(['/heat-pumps/old/'], new Set(['/heat-pumps/old/', '/heat-pumps/new/']))).toEqual([
      'new /heat-pumps/new/: run npm run links -- freeze',
    ]);
    // a redirect page is built but not indexed: it keeps the old url without asking for a freeze
    expect(
      manifestProblems(
        ['/heat-pumps/old/', '/heat-pumps/new/'],
        new Set(['/heat-pumps/old/', '/heat-pumps/new/']),
        new Set(['/heat-pumps/new/']),
      ),
    ).toEqual([]);
  });

  it('a moved.json entry must point at a current story', () => {
    root = mkdtempSync(join(tmpdir(), 'moved-'));
    const dir = topicDir('heat-pumps', root);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'stories.json'), toJson({ stories: [{ id: 'decision:new' }] }));
    writeFileSync(join(dir, 'moved.json'), toJson({ 'decision:old': 'decision:gone' }));
    expect(() => loadMoved('heat-pumps', root)).toThrow('moved.json: decision:gone is not a story of heat-pumps');
    writeFileSync(join(dir, 'moved.json'), toJson({ 'decision:old': 'decision:new' }));
    expect(loadMoved('heat-pumps', root)).toEqual({ 'decision:old': 'decision:new' });
  });
});
