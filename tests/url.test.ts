import { afterEach, describe, expect, it, vi } from 'vitest';
import { absoluteUrl, datasetSource, sitePath, textUrls } from '../src/lib/url';

describe('absolute urls', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('absoluteUrl is on the canonical host, never the base', () => {
    vi.stubEnv('BASE_URL', '/video-knowledge/');
    expect(absoluteUrl('/heat-pumps/x/')).toBe('https://commonwealthofreason.com/heat-pumps/x/');
    expect(absoluteUrl('/')).toBe('https://commonwealthofreason.com/');
  });
  it('sitePath strips the base', () => {
    vi.stubEnv('BASE_URL', '/video-knowledge/');
    expect(sitePath('/video-knowledge/about/')).toBe('/about/');
    expect(sitePath('/video-knowledge/')).toBe('/');
    vi.stubEnv('BASE_URL', '/');
    expect(sitePath('/about/')).toBe('/about/');
    expect(sitePath('/')).toBe('/');
  });
});

describe('datasetSource', () => {
  it('names each document once with its overall line range and the period', () => {
    const cites = [
      'h/sources/a.txt#L140-L150',
      'h/sources/a.txt#L135-L139',
      'h/sources/a.txt#L180-L186',
      'h/sources/a.txt#L140',
    ];
    expect(datasetSource({ 'a.txt': 'EIA table' }, cites, '2024 annual')).toBe(
      'EIA table, lines 135-186 (2024 annual)',
    );
  });
  it('keeps documents apart and falls back to the file name', () => {
    expect(datasetSource({ 'a.txt': 'A' }, ['h/sources/a.txt#L1-L2', 'h/sources/b.txt#L5-L9'], '2024')).toBe(
      'A, lines 1-2; b.txt, lines 5-9 (2024)',
    );
  });
});

describe('textUrls', () => {
  it('leaves trailing punctuation off each url in prose', () => {
    expect(
      textUrls(
        'Made with Strudel Bench (https://github.com/x/strudel-bench), see https://a.org/p; or https://b.org/q.',
      ),
    ).toEqual(['https://github.com/x/strudel-bench', 'https://a.org/p', 'https://b.org/q']);
  });
});
