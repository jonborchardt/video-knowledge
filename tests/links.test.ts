import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadMoved, manifestProblems } from '../src/lib/content-graph';
import { site } from '../src/config/site';
import { readJson, toJson, topicDir } from '../src/lib/io';
import { loadStories } from '../src/lib/stories';
import { publicTopicNames } from '../src/lib/topics';
import { scriptDir } from '../src/lib/script';
import { uploadProblem } from '../src/lib/uploader';
import {
  assertWithinLimits,
  descriptionLinks,
  type DescriptionLinks,
  keywordsOf,
  renderDescription,
  type ReviewPackage,
} from '../src/video/package';
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
    expect(lines.slice(3, 9)).toEqual([
      'Is it?',
      '',
      `Every claim and its evidence: ${matter}`,
      `Commission on Spending: ${site.url}commissions/spending/`,
      `The full record on this inquiry: ${site.url}heat-pumps/`,
      '',
    ]);
  });

  it('without cta.json the primary is the matter page', () => {
    story();
    const links = descriptionLinks('heat-pumps', 'decision:a', null, root);
    expect(links.cta).toBe('default');
    expect(describe_(links)[5]).toBe(`The evidence and the full answer: ${matter}`);
  });

  it("a Short links its parent's matter page", () => {
    story();
    const links = descriptionLinks('heat-pumps', 'decision:a/shorts/s', 'decision:a', root);
    expect(links.links[0]).toEqual({
      type: 'parent-matter',
      node: 'heat-pumps/decision:a',
      url: matter,
      text: 'The evidence and the full answer',
    });
    expect(describe_(links, true)).toContain(`The evidence and the full answer: ${matter}`);
  });

  it('links.json lists exactly the description links', () => {
    story({
      primary: { type: 'evidence', text: 'Every claim' },
      secondary: [{ type: 'reference', url: 'https://www.energystar.gov/', text: 'The programme' }],
    });
    const links = descriptionLinks('heat-pumps', 'decision:a', null, root);
    const lines = describe_(links);
    const block = lines.slice(5, lines.indexOf('', 5));
    expect(block.map((l) => l.slice(l.lastIndexOf(' ') + 1))).toEqual([
      ...links.links.slice(0, -1).map((l) => l.url),
      `${site.url}commissions/spending/`,
      links.links.at(-1)!.url,
    ]);
    expect(links.links.map((l) => l.type)).toEqual(['evidence', 'reference', 'inquiry-record']);
  });

  const record: DescriptionLinks = { cta: 'default', links: [] };
  const as = (topic: string) =>
    renderDescription(
      { status: 'release build', short: null, chapters: [], sources: { studies: [] } } as unknown as ReviewPackage,
      { pkg: { question: 'Is it?' } } as unknown as Segment,
      { title: 'T', topic } as Timeline,
      { music: null } as unknown as BuildReport,
      record,
    );

  it('the description opens as the institution', () => {
    const d = as('heat-pumps');
    expect(
      d.startsWith('Commonwealth of Reason: Commission on Spending\nAn inquiry into what things actually cost.\n'),
    ).toBe(true);
    expect(d).toContain('https://commonwealthofreason.com/commissions/spending/');
  });
  it('an institution without a slogan opens with its name only, and an unclaimed topic with none', () => {
    expect(as('ai-coding').split('\n').slice(0, 3)).toEqual([
      'Commonwealth of Reason: Office of Code Pending',
      '',
      'Is it?',
    ]);
    expect(as('nobody-claims-this')).not.toContain('Commonwealth of Reason:');
  });
  it('packaging refuses a description over 5000 bytes', () => {
    const tags = ['Commission on Spending'];
    expect(() => assertWithinLimits({ title: 't', description: 'x'.repeat(5000), tags })).not.toThrow();
    expect(() => assertWithinLimits({ title: 't', description: 'x'.repeat(5001), tags })).toThrow(
      /YouTube allows 5000/,
    );
  });
  it('keywords fit YouTube; a tag too long for the budget is skipped, shorter ones still fit', () => {
    const terms = Array(80)
      .fill(0)
      .map((_, i) => `term number ${i}`);
    const tags = keywordsOf({ institution: 'Commission on Spending', inquiry: 'Heat pumps', question: 'q', terms });
    expect(uploadProblem({ title: 't', description: 'd', tags })).toBeNull();
    expect(tags[0]).toBe('Commission on Spending');
    expect(keywordsOf({ institution: 'a'.repeat(490), inquiry: 'b'.repeat(20), question: 'c', terms: ['C'] })).toEqual([
      'a'.repeat(490),
      'c',
    ]);
    // the comma between two tags counts: 490 + 9 + 1 leaves no room for 'c'
    expect(keywordsOf({ institution: 'a'.repeat(490), inquiry: 'b'.repeat(9), question: 'c', terms: [] })).toEqual([
      'a'.repeat(490),
      'b'.repeat(9),
    ]);
  });
  it('a term with < or > is no keyword', () => {
    expect(
      keywordsOf({ institution: 'I', inquiry: 'Q', question: 'Why', terms: ['cost < gas', 'heat <b>', 'COP'] }),
    ).toEqual(['I', 'Q', 'Why', 'COP']);
  });

  it('a description always links its matter page, whatever the primary', () => {
    story({ primary: { type: 'inquiry', target: 'heat-pumps', text: 'The full record' } });
    const links = descriptionLinks('heat-pumps', 'decision:a', null, root);
    expect(links.links.map((l) => l.url)).toEqual([`${site.url}heat-pumps/`, matter]);
    expect(links.links[1]).toMatchObject({ type: 'matter', text: 'The evidence and the full answer' });
  });

  it('every committed links.json matches the graph and cta.json today (else re-package)', () => {
    for (const t of publicTopicNames())
      for (const s of loadStories(t)?.stories ?? []) {
        const dir = join(scriptDir(t, s.id), 'video', 'review');
        const file = readJson<DescriptionLinks>(join(dir, 'links.json'));
        if (file) expect(descriptionLinks(t, s.id, null), `${t}/${s.id}: npm run video -- package`).toEqual(file);
        const shorts = join(scriptDir(t, s.id), 'shorts');
        if (!existsSync(shorts)) continue;
        for (const x of readdirSync(shorts)) {
          const f = readJson<DescriptionLinks>(join(shorts, x, 'video', 'review', 'links.json'));
          if (f) expect(descriptionLinks(t, `${s.id}/shorts/${x}`, s.id), `${t}/${s.id}/shorts/${x}`).toEqual(f);
        }
      }
  });
});
