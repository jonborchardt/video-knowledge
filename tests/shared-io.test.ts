import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadDotEnv,
  ROOT,
  scriptDir,
  shortId,
  shortOf,
  storySlug,
  toJson,
  topicDir,
  writeJsonAtomic,
} from '../src/shared/io';

describe('loadDotEnv', () => {
  it('loads the root .env unless VK_NO_DOTENV says the parent handed the keys', () => {
    const root = mkdtempSync(join(tmpdir(), 'vk-dotenv-'));
    writeFileSync(join(root, '.env'), 'VK_DOTENV_TEST=loaded\n');
    expect(loadDotEnv(root, { VK_NO_DOTENV: '1' })).toBe(false);
    expect(process.env.VK_DOTENV_TEST).toBeUndefined();
    expect(loadDotEnv(root, {})).toBe(true);
    expect(process.env.VK_DOTENV_TEST).toBe('loaded');
    delete process.env.VK_DOTENV_TEST;
    expect(loadDotEnv(join(root, 'nowhere'), {})).toBe(false);
  });
});

describe('writeJsonAtomic', () => {
  const dir = () => mkdtempSync(join(tmpdir(), 'vk-atomic-'));
  const eperm = () => Object.assign(new Error('EPERM'), { code: 'EPERM' });
  it('writes the json and leaves no .tmp behind', () => {
    const p = join(dir(), 'a.json');
    writeJsonAtomic(p, { a: 1 });
    expect(readFileSync(p, 'utf8')).toBe(toJson({ a: 1 }));
    expect(existsSync(`${p}.tmp`)).toBe(false);
  });
  it('retries a rename refused by EPERM and then succeeds', () => {
    const p = join(dir(), 'b.json');
    let refusals = 2;
    const io = {
      writeFileSync,
      renameSync: (a: string, b: string) => {
        if (refusals-- > 0) throw eperm();
        renameSync(a, b);
      },
    };
    writeJsonAtomic(p, { b: 2 }, io, 0);
    expect(readFileSync(p, 'utf8')).toBe(toJson({ b: 2 }));
    expect(existsSync(`${p}.tmp`)).toBe(false);
  });
  it('leaves the old file intact when the rename never succeeds', () => {
    const p = join(dir(), 'c.json');
    writeFileSync(p, toJson({ old: true }));
    const io = {
      writeFileSync,
      renameSync: () => {
        throw eperm();
      },
    };
    expect(() => writeJsonAtomic(p, { c: 3 }, io, 0)).toThrow(/EPERM/);
    expect(readFileSync(p, 'utf8')).toBe(toJson({ old: true }));
  });
});

describe('layout', () => {
  it('scriptDir', () =>
    expect(scriptDir('heat-pumps', 'decision:when-does-it-pay', ROOT)).toBe(
      join(topicDir('heat-pumps', ROOT), 'scripts', 'decision-when-does-it-pay'),
    ));
  it('short folder', () =>
    expect(scriptDir('t', 's:x/shorts/one', ROOT)).toBe(join(ROOT, 'topics', 't', 'scripts', 's-x', 'shorts', 'one')));
  it('shortOf', () => expect(shortOf('s:x/shorts/one')).toEqual({ parent: 's:x', slug: 'one' }));
  it('shortId builds a Short of a story, never a Short of a Short', () => {
    expect(shortId('s:x', 'one')).toBe('s:x/shorts/one');
    expect(() => shortId('s:x/shorts/one', 'two')).toThrow('a Short has no Shorts: s:x/shorts/one');
  });
  it('storySlug', () => expect(storySlug('decision:a--b')).toBe('decision-a-b'));
});
