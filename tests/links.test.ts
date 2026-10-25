import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadMoved, manifestProblems } from '../src/lib/content-graph';
import { site } from '../src/config/site';
import { toJson, topicDir } from '../src/lib/io';
import { scriptDir } from '../src/lib/script';
import { descriptionLinks, type DescriptionLinks, renderDescription, type ReviewPackage } from '../src/video/package';
import type { BuildReport } from '../src/video/report';
import type { Segment } from '../src/video/select';
import type { Timeline } from '../src/video/types';

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

  // A temp root with one ready story `decision:a` and, when given, its cta.json.
  function story(cta?: object) {
    root = mkdtempSync(join(tmpdir(), 'desc-'));
    mkdirSync(scriptDir('heat-pumps', 'decision:a', root), { recursive: true });
    const s = {
      id: 'decision:a',
      title: 'A',
      question: 'A?',
      claims: ['c1'],
      readiness: 'ready',
      scores: { overall: 1 },
    };
    writeFileSync(join(topicDir('heat-pumps', root), 'stories.json'), toJson({ stories: [s] }));
    if (cta) writeFileSync(join(scriptDir('heat-pumps', 'decision:a', root), 'cta.json'), toJson(cta));
  }
  const describe_ = (links: DescriptionLinks, short = false) =>
    renderDescription(
      {
        status: 'release build',
        short: short ? {} : null,
        chapters: [],
        sources: { studies: [] },
      } as unknown as ReviewPackage,
      { pkg: { question: 'Is it?', short: short ? { hook: 'One figure.' } : undefined } } as unknown as Segment,
      { title: 'T', topic: 'heat-pumps' } as Timeline,
      { music: null } as unknown as BuildReport,
      links,
    ).split('\n');
  const matter = `${site.url}heat-pumps/a/`;

  it('the description opens with the primary call to action and the record link', () => {
    story({ primary: { type: 'evidence', text: 'Every claim and its evidence' } });
    const lines = describe_(descriptionLinks('heat-pumps', 'decision:a', null, root));
    expect(lines.slice(0, 5)).toEqual([
      'Is it?',
      '',
      `Every claim and its evidence: ${matter}`,
      `The full record on this inquiry: ${site.url}heat-pumps/`,
      '',
    ]);
  });

  it('without cta.json the primary is the matter page', () => {
    story();
    const links = descriptionLinks('heat-pumps', 'decision:a', null, root);
    expect(links.cta).toBe('default');
    expect(describe_(links)[2]).toBe(`The evidence and the full answer: ${matter}`);
  });

  it("a Short links its parent's matter page", () => {
    story();
    const links = descriptionLinks('heat-pumps', 'decision:a/shorts/s', 'decision:a', root);
    expect(links.links[0]).toEqual({
      type: 'parent-matter',
      node: 'heat-pumps/decision:a',
      url: matter,
      text: 'Full inquiry',
    });
    expect(describe_(links, true)).toContain(`Full inquiry: ${matter}`);
  });

  it('links.json lists exactly the description links', () => {
    story({
      primary: { type: 'evidence', text: 'Every claim' },
      secondary: [{ type: 'reference', url: 'https://www.energystar.gov/', text: 'The programme' }],
    });
    const links = descriptionLinks('heat-pumps', 'decision:a', null, root);
    const lines = describe_(links);
    const block = lines.slice(2, lines.indexOf('', 2));
    expect(block.map((l) => l.slice(l.lastIndexOf(' ') + 1))).toEqual(links.links.map((l) => l.url));
    expect(links.links.map((l) => l.type)).toEqual(['evidence', 'reference', 'inquiry-record']);
  });
});
