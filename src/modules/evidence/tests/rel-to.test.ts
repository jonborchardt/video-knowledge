import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { topicDir } from '../../../shared/io';
import { relTo } from '../watcher.mjs';

describe('relTo', () => {
  it('writes a topic path relative to the repo with forward slashes, as the old TOPICS strings did', () => {
    expect(relTo(join(topicDir('t'), 'public-record.json'))).toBe('topics/t/public-record.json');
    expect(relTo(join(topicDir('t'), 'store'))).toBe('topics/t/store');
  });
});
