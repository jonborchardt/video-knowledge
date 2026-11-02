// The release manifest (spec §7.2): video/review/release-manifest.json, written by `package` for a release build and
// removed when a draft is packaged. It describes the immutable publication a person approves: every output's media
// and metadata (the video and each packaged Short registered in its ledger), the companion article's released text,
// the public URLs the site will have, the calls to action (paid ones numbered, approved or not), the institution.
// `releaseSha` binds exactly those; generatedAt, the evidence counts and the composed X post are shown, not bound.
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { commissionKey, commissionOf, site } from '../../config/site';
import {
  MANIFEST_FILE,
  REVIEW_DIR,
  ROOT,
  fileSha,
  readJson,
  scriptDir,
  sha,
  toJson,
  topicDir,
  writeJsonAtomic,
} from '../../shared/io';
import { FILES } from '../../shared/io';
import { composePost } from '../../shared/social-text';
import type { EvidencePackage, ManifestCta, ManifestOutput, ReleaseManifest } from '../../shared/types';
import { type ArticleRelease, loadArticleRelease } from '../article';
import { loadLedger, openOutput } from '../publishing';
import { loadCta, publicUrlsOf, resolveCtas, contentGraph, storyNode } from '../website';
import type { ReviewPackage } from './package';

export const manifestPath = (topic: string, storyId: string, root = ROOT) =>
  join(scriptDir(topic, storyId, root), 'video', REVIEW_DIR, MANIFEST_FILE);
export const loadManifest = (topic: string, storyId: string, root = ROOT) =>
  readJson<ReleaseManifest>(manifestPath(topic, storyId, root));

/** JSON with every object's keys sorted, so a sha over it never depends on insertion order. */
const canonical = (x: unknown): string =>
  JSON.stringify(x, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v as object)
            .sort()
            .map((k) => [k, (v as Record<string, unknown>)[k]]),
        )
      : v,
  );

const words = (release: ArticleRelease): number => {
  const text: string[] = [];
  const walk = (x: unknown): void => {
    if (typeof x === 'string') text.push(x);
    else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object')
      for (const [k, v] of Object.entries(x)) if (k !== 'id' && k !== 'ref' && k !== 'kind') walk(v);
  };
  walk(release.article.sections);
  return text.join(' ').split(/\s+/).filter(Boolean).length;
};

export interface ManifestOptions {
  now?: Date;
  /** The institution's X handle (`Commission.x`); the commission's by default. Tests inject one. */
  x?: string | null;
}

/** The manifest of a packaged release build, from the files; throws for a draft package or a story no institution
 *  claims (a release needs one). Pure over the files: nothing written. */
export function buildManifest(
  topic: string,
  storyId: string,
  root = ROOT,
  opts: ManifestOptions = {},
): ReleaseManifest {
  const dir = scriptDir(topic, storyId, root);
  const review = readJson<ReviewPackage>(join(dir, 'video', REVIEW_DIR, 'review.json'));
  if (!review) throw new Error(`no review package for ${topic} ${storyId}; npm run video -- package first`);
  if (review.status !== 'release build')
    throw new Error(`the package is a ${review.status}, not a release build: npm run video -- final makes one`);
  const c = commissionOf(topic);
  if (!c) throw new Error(`no institution claims ${topic}: a release needs one (commissions in src/config/site.ts)`);
  const ledger = loadLedger(topic, storyId, root);
  const main = 'youtube';
  const outputs: Record<string, ManifestOutput> = {};
  const outputOf = (id: string, rp: ReviewPackage): ManifestOutput => {
    const o = openOutput(topic, storyId, { output: id, root });
    if (!o.metadata) throw new Error(`no metadata for ${id}`);
    const description = o.metadata.description;
    const out: ManifestOutput = {
      kind: o.out.kind === 'youtube-short' ? 'youtube-short' : 'youtube-video',
      mp4Sha: rp.mp4Sha,
      buildReport: rp.buildReport,
      metadataSha: o.metadata.sha,
      title: o.metadata.title,
      description,
      tags: o.metadata.tags,
      chapters: (rp.chapters ?? []).map((ch) => ({ at: ch.seconds, title: ch.title })),
      thumbnailSha: o.metadata.thumbnail?.sha ?? null,
      captionsSha: o.metadata.captions?.sha ?? null,
      seconds: rp.seconds,
      disclosurePresent: description.includes(site.disclosure),
    };
    if (o.out.source) out.source = o.out.source;
    if (o.out.derivedFrom) out.derivedFrom = o.out.derivedFrom;
    return out;
  };
  outputs[main] = outputOf(main, review);
  for (const [id, o] of Object.entries(ledger?.outputs ?? {})) {
    if (!id.startsWith('short:') || !o.source) continue;
    const rp = readJson<ReviewPackage>(join(root, o.source, 'video', REVIEW_DIR, 'review.json'));
    if (!rp) continue; // registered, not packaged now: not part of this release
    outputs[id] = outputOf(id, rp);
  }
  const release = loadArticleRelease(topic, storyId, root);
  const article = release
    ? {
        releaseSha: fileSha(join(dir, 'article-release.json')),
        headline: release.article.meta.headline,
        words: words(release),
      }
    : null;
  const urls = publicUrlsOf(topic, storyId, root);
  const node = storyNode(topic, storyId);
  const g = contentGraph(root, [topic], 'live', [node]);
  const r = resolveCtas(loadCta(topic, storyId, root), g, node, root);
  if (r.problems.length) throw new Error(`cta.json: ${r.problems.join('; ')}`);
  const cta = (x: { type: string; url: string; text: string }): ManifestCta => ({
    type: x.type,
    url: x.url,
    text: x.text,
  });
  const ctas: ReleaseManifest['ctas'] = {
    primary: cta(r.primary),
    secondary: r.secondary.map(cta),
    commercial: r.commercial.map((x, i) => ({
      n: i + 1,
      id: x.id,
      type: 'commercial',
      url: x.url,
      text: x.text,
      disclosure: x.disclosure,
      approvedBy: x.approvedBy,
    })),
  };
  const pkg = readJson<EvidencePackage>(join(dir, FILES.pkg));
  const evidence = {
    claims: pkg?.claims.length ?? 0,
    verdictsCited: pkg?.claims.reduce((n, cl) => n + cl.evidence.length, 0) ?? 0,
    publicRecordSha: fileSha(join(topicDir(topic, root), 'public-record.json')),
  };
  const institution = commissionKey(c);
  const x = opts.x === undefined ? (c.x ?? null) : opts.x;
  const distribution = {
    x: x ? { account: x, text: composePost(outputs[main].title, urls.matterUrl, site.disclosure) } : null,
  };
  // What the sha binds (spec §7.2): every output's media, text and assets, the article, the URLs, the calls to action
  // and the institution. A paid link is bound through `commercial` (without approvedBy): a `PAID OK` lets packaging
  // add that very link to the description and the metadata sha move, while the sha the person approved stands.
  const paidUrls = ctas.commercial.map((x) => x.url);
  const withoutPaid = (text: string) =>
    text
      .split('\n')
      .filter((l) => !paidUrls.some((u) => l.includes(u)))
      .join('\n');
  const bound = {
    outputs: Object.fromEntries(
      Object.entries(outputs).map(([id, o]) => {
        const { metadataSha, ...rest } = o;
        void metadataSha;
        return [id, { ...rest, description: withoutPaid(o.description) }];
      }),
    ),
    article,
    site: urls,
    ctas: {
      primary: ctas.primary.type === 'commercial' ? null : ctas.primary,
      secondary: ctas.secondary.filter((x) => x.type !== 'commercial'),
      commercial: ctas.commercial.map((x) => ({
        n: x.n,
        id: x.id,
        type: x.type,
        url: x.url,
        text: x.text,
        disclosure: x.disclosure,
      })),
    },
    institution,
  };
  const m: ReleaseManifest = {
    generatedAt: (opts.now ?? new Date()).toISOString(),
    topic,
    story: storyId,
    institution,
    ...(review.fixtureRun && { fixtureRun: review.fixtureRun }),
    outputs,
    article,
    site: urls,
    ctas,
    evidence,
    sequence: Object.keys(outputs),
    distribution,
    releaseSha: sha(canonical(bound)),
  };
  return m;
}

/** Writes the manifest unless the one on disk differs only in `generatedAt` (so a rebuild never churns the file). */
export function writeManifest(
  topic: string,
  storyId: string,
  root = ROOT,
  opts: ManifestOptions = {},
): 'written' | 'unchanged' {
  const m = buildManifest(topic, storyId, root, opts);
  const p = manifestPath(topic, storyId, root);
  const old = readJson<ReleaseManifest>(p);
  if (old && toJson({ ...old, generatedAt: '' }) === toJson({ ...m, generatedAt: '' })) return 'unchanged';
  writeJsonAtomic(p, m);
  return 'written';
}

export function removeManifest(topic: string, storyId: string, root = ROOT): boolean {
  const p = manifestPath(topic, storyId, root);
  if (!existsSync(p)) return false;
  unlinkSync(p);
  return true;
}
