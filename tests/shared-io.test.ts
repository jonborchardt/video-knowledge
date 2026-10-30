import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { ROOT, scriptDir, shortOf, storySlug, topicDir } from '../src/shared/io';

describe('layout', () => {
  it('scriptDir', () =>
    expect(scriptDir('heat-pumps', 'decision:when-does-it-pay', ROOT)).toBe(
      join(topicDir('heat-pumps', ROOT), 'scripts', 'decision-when-does-it-pay'),
    ));
  it('short folder', () =>
    expect(scriptDir('t', 's:x/shorts/one', ROOT)).toBe(join(ROOT, 'topics', 't', 'scripts', 's-x', 'shorts', 'one')));
  it('shortOf', () => expect(shortOf('s:x/shorts/one')).toEqual({ parent: 's:x', slug: 'one' }));
  it('storySlug', () => expect(storySlug('decision:a--b')).toBe('decision-a-b'));
});
