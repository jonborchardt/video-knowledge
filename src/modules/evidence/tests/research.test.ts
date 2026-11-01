// The research verbs (spec §5.2; phase 5 Task 1): the YouTube results parser, the extraction groups, the exact
// duplicate conversion, the collisions with an injected similarity, fetch-doc's refusals and its header, thinness.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../../shared/automation';
import type { ExtractionBatch } from '../batches';
import { collisions, localSimilarity } from '../collide';
import { dedupeBatches } from '../dedupe';
import { fetchDoc, fetchDocProblem, htmlToText } from '../fetch-doc';
import { splitGroups } from '../groups';
import { lengthSeconds, parseSearchPage, viewCount } from '../search';
import { thinness } from '../thin';

const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

describe('search', () => {
  it('parses the videoRenderer entries of a results page, each id once', () => {
    const data = {
      contents: {
        twoColumnSearchResultsRenderer: {
          primaryContents: {
            sectionListRenderer: {
              contents: [
                {
                  itemSectionRenderer: {
                    contents: [
                      {
                        videoRenderer: {
                          videoId: 'abcdefghijk',
                          title: { runs: [{ text: 'Heat pumps ' }, { text: 'explained' }] },
                          ownerText: { runs: [{ text: 'Some Channel' }] },
                          lengthText: { simpleText: '12:34' },
                          viewCountText: { simpleText: '1,234,567 views' },
                        },
                      },
                      { channelRenderer: { channelId: 'x' } },
                      {
                        videoRenderer: {
                          videoId: 'abcdefghijk',
                          title: { simpleText: 'a repeat of the first' },
                        },
                      },
                      {
                        videoRenderer: {
                          videoId: 'lmnopqrstuv',
                          title: { simpleText: 'No views yet' },
                          longBylineText: { runs: [{ text: 'Other' }] },
                          lengthText: { simpleText: '1:02:03' },
                          viewCountText: { simpleText: 'No views' },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    };
    const html = `<html><script>var ytInitialData = ${JSON.stringify(data)};</script><script>other</script></html>`;
    expect(parseSearchPage(html)).toEqual([
      { id: 'abcdefghijk', title: 'Heat pumps explained', channel: 'Some Channel', seconds: 754, views: 1234567 },
      { id: 'lmnopqrstuv', title: 'No views yet', channel: 'Other', seconds: 3723, views: 0 },
    ]);
    expect(parseSearchPage('<html>nothing</html>')).toEqual([]);
    expect(lengthSeconds('0:45')).toBe(45);
    expect(viewCount('2.3M views')).toBe(2_300_000);
  });
});

describe('groups', () => {
  it('splits in order under the cap; an oversized entry gets its own group', () => {
    const e = (id: string, chars: number) => ({ id, chars });
    expect(splitGroups([e('a', 300), e('b', 300), e('c', 300), e('d', 1000), e('e', 10)], 700)).toEqual([
      [e('a', 300), e('b', 300)],
      [e('c', 300)],
      [e('d', 1000)],
      [e('e', 10)],
    ]);
    expect(splitGroups([])).toEqual([]);
  });
});

describe('dedupe', () => {
  it("converts a later file's identical new claim to an n2 of the first and keeps the canonical's index", () => {
    const same = 'Heat pumps cut heating bills in most homes';
    const files: Record<string, ExtractionBatch[]> = {
      'h2.json': [
        {
          video: 'v3',
          as: [{ n: same, q: 'q3', v: ['right', 0.5, 'n3'], l: 'pro', f: true }],
        },
      ],
      'h1.json': [
        { video: 'v1', as: [{ n: same, q: 'q1', v: ['right', 0.6, 'n1'], l: 'pro' }] },
        {
          video: 'v2',
          as: [
            { n: same, q: 'q2', v: ['right', 0.4, 'n2'] },
            { c: 'other', q: 'x' },
          ],
        },
      ],
    };
    const { batches, converted } = dedupeBatches(files);
    expect(converted).toBe(2);
    expect(batches['h1.json'][0].as[0]).toMatchObject({ n: same, v: ['right', 0.6, 'n1'] });
    expect(batches['h1.json'][1].as[0]).toEqual({ n2: same, q: 'q2' });
    expect(batches['h1.json'][1].as[1]).toEqual({ c: 'other', q: 'x' });
    expect(batches['h2.json'][0].as[0]).toEqual({ n2: same, q: 'q3' }); // the force flag and the guess go with the n
  });
});

describe('collisions', () => {
  it('returns the pairs over the threshold with an injected similarity, against existing claims and earlier new ones', () => {
    const sim = (a: string, b: string) => (a.split(' ')[0] === b.split(' ')[0] ? 0.8 : 0.1);
    const out = collisions(
      ['heat pumps save money', 'solar panels pay back', 'heat pumps cost more'],
      [{ id: 't/heat-pumps-cut-bills', text: 'heat pumps cut bills' }],
      sim,
    );
    expect(out).toEqual([
      { claim: 'heat pumps save money', against: 't/heat-pumps-cut-bills', score: 0.8 },
      { claim: 'heat pumps cost more', against: 't/heat-pumps-cut-bills', score: 0.8 },
      { claim: 'heat pumps cost more', against: 'heat pumps save money', score: 0.8 },
    ]);
    // the local copy of the watcher's formula: a negation halves the score, a rewording stays close
    expect(
      localSimilarity(
        'Heat pumps lower heating bills in cold climates',
        'Heat pumps lower heating bills in most cold climates',
      ),
    ).toBeGreaterThan(0.6);
    expect(localSimilarity('Heat pumps lower heating bills', 'Heat pumps do not lower heating bills')).toBeLessThan(
      0.6,
    );
  });
});

describe('fetch-doc', () => {
  const fresh = () => {
    const root = mkdtempSync(join(tmpdir(), 'vk-fetch-doc-'));
    roots.push(root);
    mkdirSync(join(root, 'topics', 'ev'), { recursive: true });
    return root;
  };
  it('refuses http, a path, a non-txt name and a missing topic', () => {
    const root = fresh();
    expect(fetchDocProblem('ev', 'http://x.test/a.pdf', 'a.txt', root)).toMatch(/https/);
    expect(fetchDocProblem('ev', 'https://x.test/a.pdf', '../a.txt', root)).toMatch(/bare name/);
    expect(fetchDocProblem('ev', 'https://x.test/a.pdf', 'sub/a.txt', root)).toMatch(/bare name/);
    expect(fetchDocProblem('ev', 'https://x.test/a.pdf', 'a.pdf', root)).toMatch(/\.txt/);
    expect(fetchDocProblem('nope', 'https://x.test/a.pdf', 'a.txt', root)).toMatch(/no topic folder/);
    expect(fetchDocProblem('ev', 'https://x.test/a.pdf', 'tco-2024.txt', root)).toBeNull();
  });
  it('writes the Source header and the converted text under sources/: a PDF through the converter, HTML stripped', async () => {
    const root = fresh();
    const pdf = Buffer.from('%PDF-1.4 fake');
    const fetchFn = (async (u: string | URL | Request) =>
      String(u).endsWith('.pdf')
        ? new Response(pdf, { status: 200, headers: { 'content-type': 'application/pdf' } })
        : new Response(
            '<html><head><style>x{}</style></head><body><h1>Title</h1><p>Line one &amp; two.</p><script>bad()</script><p>Three</p></body></html>',
            {
              status: 200,
              headers: { 'content-type': 'text/html' },
            },
          )) as unknown as typeof fetch;
    const r = await fetchDoc('ev', 'https://x.test/paper.pdf', 'paper.txt', {
      root,
      fetchFn,
      today: '2026-11-01',
      pdfToText: (b, pages) => `converted ${b.length} bytes${pages ? ` pages ${pages}` : ''}\nsecond line`,
      pages: '2-5',
    });
    expect(r.kind).toBe('pdf');
    const text = readFileSync(join(root, 'topics', 'ev', 'sources', 'paper.txt'), 'utf8');
    expect(text).toBe(
      'Source: https://x.test/paper.pdf (retrieved 2026-11-01)\n\nconverted 13 bytes pages 2-5\nsecond line\n',
    );
    expect(r.lines).toBe(4);
    const h = await fetchDoc('ev', 'https://x.test/page', 'page.txt', { root, fetchFn, today: '2026-11-01' });
    expect(h.kind).toBe('text');
    expect(readFileSync(join(root, 'topics', 'ev', 'sources', 'page.txt'), 'utf8')).toBe(
      'Source: https://x.test/page (retrieved 2026-11-01)\n\nTitle\nLine one & two.\nThree\n',
    );
    await expect(fetchDoc('ev', 'http://x.test/a', 'a.txt', { root, fetchFn })).rejects.toThrow(/refused/);
    expect(htmlToText('<p>a</p><p>b</p>')).toBe('a\nb');
  });
});

describe('thinness', () => {
  const a = { ...DEFAULTS.topics, minSources: 40, minStudies: 12, minDecided: 0.5 };
  it('names each shortfall and passes a sufficient topic', () => {
    expect(thinness({ sources: 50, withCaptions: 45, documents: 14, claims: 100, decided: 60 }, a)).toEqual({
      thin: false,
      why: null,
    });
    const t = thinness({ sources: 50, withCaptions: 30, documents: 5, claims: 100, decided: 20 }, a);
    expect(t.thin).toBe(true);
    expect(t.why).toMatch(/30 of the 40 sources with captions/);
    expect(t.why).toMatch(/5 of the 12 study documents/);
    expect(t.why).toMatch(/20 of 100 claims decided by a study \(20%, under the 50%/);
    expect(thinness({ sources: 50, withCaptions: 45, documents: 14, claims: 0, decided: 0 }, a).why).toMatch(
      /0 of 0 claims/,
    );
  });
});
