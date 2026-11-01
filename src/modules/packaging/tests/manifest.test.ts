// The release manifest (spec §7.2): one file binding the whole publication a person approves: every output's media
// and metadata, the article's released text, the public URLs, the calls to action and the institution. Written for
// a release build, removed for a draft; `releaseSha` moves with what the person approves and with nothing else.
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { site } from '../../../config/site';
import { MANIFEST_FILE, REVIEW_DIR, fileSha, readJson, sha, toJson } from '../../../shared/io';
import type { ReleaseManifest } from '../../../shared/types';
import { addOutputTo, loadLedger, publishPath, saveLedger } from '../../publishing/publish';
import { ARTICLE_FILES } from '../../article';
import { buildManifest, loadManifest, manifestPath, removeManifest, writeManifest } from '../manifest';
import { type Fixture, syntheticProduction } from '../../../../tests/production-helpers';

const fixtures: Fixture[] = [];
afterAll(() => fixtures.forEach((f) => f.cleanup()));

/** A packaged release fixture with two packaged Shorts registered in its ledger and a cta.json with a paid link. */
function staged(opts: { release?: boolean; shorts?: string[]; cta?: object } = {}) {
  const f = syntheticProduction('packaged', { release: opts.release ?? true });
  fixtures.push(f);
  const rel = (p: string) => relative(f.root, p).replaceAll('\\', '/');
  for (const slug of opts.shorts ?? ['one', 'two']) {
    const dir = join(f.dir, 'shorts', slug, 'video', REVIEW_DIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'review.json'),
      toJson({
        generatedAt: '2026-01-01',
        status: 'release build',
        buildReport: `br-${slug}`,
        mp4: `short-${slug}.mp4`,
        mp4Sha: `short${slug}sha`,
        thumbnailSha: `thumb-${slug}`,
        captionsSha: `caps-${slug}`,
        seconds: 7.5,
        title: `Short ${slug}`,
        chapters: [],
        short: { parent: f.story, slug, format: 'ONE FIGURE FROM THE RECORD', fullVideo: null },
      }),
    );
    writeFileSync(join(dir, 'description.txt'), `Short ${slug}\n\n${site.disclosure}\n#Shorts\n`);
    addOutputTo(f.topic, f.story, `short:${slug}`, 'youtube-short', {
      derivedFrom: 'youtube',
      source: rel(join(f.dir, 'shorts', slug)),
      root: f.root,
    });
  }
  if (opts.cta !== null) writeFileSync(join(f.dir, 'cta.json'), toJson(opts.cta ?? PAID));
  return { f, rel };
}
const PAID = {
  primary: { type: 'inquiry', target: 'heat-pumps', text: 'The full record on heat pumps' },
  secondary: [
    {
      type: 'commercial',
      url: 'https://example.com/pump',
      text: 'A heat pump we were paid to link',
      disclosure: 'Paid placement',
    },
  ],
};

describe('buildManifest', () => {
  it('binds the video, its packaged Shorts, the article, the site URLs, the institution and the calls to action', () => {
    const { f } = staged();
    const m = buildManifest(f.topic, f.story, f.root);
    expect(Object.keys(m.outputs)).toEqual(['youtube', 'short:one', 'short:two']);
    expect(m.sequence).toEqual(['youtube', 'short:one', 'short:two']);
    expect(m.institution).toBe('spending');
    expect(m.topic).toBe(f.topic);
    expect(m.story).toBe(f.story);
    const v = m.outputs.youtube;
    expect(v.kind).toBe('youtube-video');
    expect(v.mp4Sha).toBe('releasesha');
    expect(v.thumbnailSha).toBe('thumbsha');
    expect(v.captionsSha).toBe('capsha');
    expect(v.title).toBe(readJson<{ title: string }>(join(f.dir, 'video', REVIEW_DIR, 'review.json'))!.title);
    expect(v.description).toContain('Chapters');
    expect(v.chapters).toEqual([]);
    expect(v.disclosurePresent).toBe(false); // the synthetic description carries no disclosure line
    const s = m.outputs['short:one'];
    expect(s).toMatchObject({ kind: 'youtube-short', mp4Sha: 'shortonesha', derivedFrom: 'youtube', seconds: 7.5 });
    expect(s.disclosurePresent).toBe(true);
    expect(s.source).toMatch(/shorts\/one$/);
    expect(m.article).toEqual({
      releaseSha: fileSha(join(f.dir, ARTICLE_FILES.release)),
      headline: expect.any(String),
      words: expect.any(Number),
    });
    expect(m.article!.words).toBeGreaterThan(0);
    expect(m.site.matterUrl).toMatch(new RegExp(`^${site.url}heat-pumps/`));
    expect(m.site.articleUrl).toBe(`${m.site.matterUrl}#article`);
    expect(m.site.dataUrl).toBeNull();
    expect(m.ctas.primary).toEqual({
      type: 'inquiry',
      url: `${site.url}heat-pumps/`,
      text: 'The full record on heat pumps',
    });
    expect(m.ctas.secondary).toEqual([]); // the paid link waits for a person: dropped from the description
    expect(m.ctas.commercial).toEqual([
      {
        n: 1,
        id: sha('commercial|https://example.com/pump'),
        type: 'commercial',
        url: 'https://example.com/pump',
        text: 'A heat pump we were paid to link',
        disclosure: 'Paid placement',
        approvedBy: null,
      },
    ]);
    expect(m.evidence.claims).toBeGreaterThan(0);
    expect(m.evidence.publicRecordSha).toBe(fileSha(join(f.root, 'topics', f.topic, 'public-record.json')));
    expect(m.distribution.x).toBeNull(); // the commission has no X account
    expect(m.releaseSha).toMatch(/^[0-9a-f]{10}$/);
    expect(m.fixtureRun).toBeUndefined();
  });

  it('metadataSha is the composed upload metadata sha, what push sends', () => {
    const { f } = staged();
    const m = buildManifest(f.topic, f.story, f.root);
    const ledger = loadLedger(f.topic, f.story, f.root)!;
    ledger.outputs.youtube.metadata.title = 'A hand-set title';
    saveLedger(publishPath(f.topic, f.story, f.root), ledger);
    const m2 = buildManifest(f.topic, f.story, f.root);
    expect(m2.outputs.youtube.title).toBe('A hand-set title');
    expect(m2.outputs.youtube.metadataSha).not.toBe(m.outputs.youtube.metadataSha);
    expect(m2.releaseSha).not.toBe(m.releaseSha);
  });

  it('releaseSha moves with what the person approves and with nothing else', () => {
    const { f } = staged();
    const base = buildManifest(f.topic, f.story, f.root);
    // a Short re-packaged
    const rp = join(f.dir, 'shorts', 'one', 'video', REVIEW_DIR, 'review.json');
    writeFileSync(rp, toJson({ ...readJson<object>(rp)!, mp4Sha: 'shortonesha2' }));
    expect(buildManifest(f.topic, f.story, f.root).releaseSha).not.toBe(base.releaseSha);
    writeFileSync(rp, toJson({ ...readJson<object>(rp)!, mp4Sha: 'shortonesha' }));
    expect(buildManifest(f.topic, f.story, f.root).releaseSha).toBe(base.releaseSha);
    // the article re-locked
    const ar = join(f.dir, ARTICLE_FILES.release);
    const release = readJson<{ revision: number }>(ar)!;
    writeFileSync(ar, toJson({ ...release, revision: release.revision + 1 }));
    expect(buildManifest(f.topic, f.story, f.root).releaseSha).not.toBe(base.releaseSha);
    writeFileSync(ar, toJson(release));
    // a call-to-action url changed
    writeFileSync(
      join(f.dir, 'cta.json'),
      toJson({ ...PAID, secondary: [{ ...PAID.secondary[0], url: 'https://example.com/other' }] }),
    );
    expect(buildManifest(f.topic, f.story, f.root).releaseSha).not.toBe(base.releaseSha);
    // a paid link approved: the sha the person saw stands (approvedBy is outside it), and the link now shows
    writeFileSync(
      join(f.dir, 'cta.json'),
      toJson({ ...PAID, secondary: [{ ...PAID.secondary[0], approvedBy: 'Jon' }] }),
    );
    const approved = buildManifest(f.topic, f.story, f.root);
    expect(approved.ctas.commercial[0].approvedBy).toBe('Jon');
    expect(approved.ctas.secondary).toHaveLength(1);
    expect(approved.releaseSha).toBe(base.releaseSha);
  });

  it('generatedAt, evidence and distribution are outside releaseSha', () => {
    const { f } = staged();
    const a = buildManifest(f.topic, f.story, f.root, { now: new Date('2026-01-01T00:00:00Z') });
    const b = buildManifest(f.topic, f.story, f.root, { now: new Date('2026-02-01T00:00:00Z') });
    expect(a.generatedAt).not.toBe(b.generatedAt);
    expect(a.releaseSha).toBe(b.releaseSha);
    const pr = join(f.root, 'topics', f.topic, 'public-record.json');
    writeFileSync(pr, readFileSync(pr, 'utf8') + '\n');
    const c = buildManifest(f.topic, f.story, f.root);
    expect(c.evidence.publicRecordSha).not.toBe(a.evidence.publicRecordSha);
    expect(c.releaseSha).toBe(a.releaseSha);
  });

  it('a release package writes it, a draft package removes it', () => {
    const { f } = staged();
    const p = manifestPath(f.topic, f.story, f.root);
    expect(p).toBe(join(f.dir, 'video', REVIEW_DIR, MANIFEST_FILE));
    expect(writeManifest(f.topic, f.story, f.root)).toBe('written');
    expect(loadManifest(f.topic, f.story, f.root)?.releaseSha).toMatch(/^[0-9a-f]{10}$/);
    expect(writeManifest(f.topic, f.story, f.root)).toBe('unchanged'); // only generatedAt would move: not rewritten
    removeManifest(f.topic, f.story, f.root);
    expect(existsSync(p)).toBe(false);
    const draft = staged({ release: false });
    expect(() => buildManifest(draft.f.topic, draft.f.story, draft.f.root)).toThrow(/release build/);
  });

  it('a story without an article or a cta.json has null article and the default calls to action', () => {
    const { f } = staged({ shorts: [], cta: null as unknown as undefined });
    writeFileSync(join(f.dir, ARTICLE_FILES.release), ''); // gone
    expect(() => buildManifest(f.topic, f.story, f.root)).toThrow();
    const ar = join(f.dir, ARTICLE_FILES.release);
    unlinkSync(ar);
    const m = buildManifest(f.topic, f.story, f.root);
    expect(m.article).toBeNull();
    expect(m.site.articleUrl).toBeNull();
    expect(m.ctas.primary.type).toBe('evidence');
    expect(m.ctas.commercial).toEqual([]);
    expect(Object.keys(m.outputs)).toEqual(['youtube']);
  });

  it('a fixture story carries its run id', () => {
    const { f } = staged({ shorts: [] });
    const rp = join(f.dir, 'video', REVIEW_DIR, 'review.json');
    writeFileSync(rp, toJson({ ...readJson<object>(rp)!, fixtureRun: '20261101-0307-8ee4' }));
    expect(buildManifest(f.topic, f.story, f.root).fixtureRun).toBe('20261101-0307-8ee4');
  });

  it('an X account on the commission composes the post the manifest shows', () => {
    const { f } = staged({ shorts: [] });
    const m = buildManifest(f.topic, f.story, f.root, { x: '@CORSpending' });
    expect(m.distribution.x?.account).toBe('@CORSpending');
    expect(m.distribution.x?.text).toContain(m.site.matterUrl);
    expect(m.distribution.x?.text).toContain(site.disclosure);
    const r: ReleaseManifest = m;
    expect(r.distribution.x?.text.split('\n\n')[0]).toBe(m.outputs.youtube.title);
  });
});
