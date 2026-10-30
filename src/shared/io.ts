// Repo-wide file helpers: content hashes, line endings and JSON artifacts. Every stage imports them from here, so no
// stage depends on another stage's module for a utility.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PassageReader } from './types';

/** The repo root: the nearest folder at or above the working directory whose package.json is this repo's, else
 *  (launched from outside the repo) the folder this file lives in. Every module that reads the repo takes its root
 *  from here, or from a `root` argument that defaults to it, so a script run from anywhere agrees with itself. The
 *  working directory comes first because the site build bundles this file away from src/lib. */
const isRepo = (d: string) =>
  existsSync(join(d, 'package.json')) &&
  (JSON.parse(readFileSync(join(d, 'package.json'), 'utf8')) as { name?: string }).name === 'video-knowledge';
export const ROOT = (() => {
  for (let d = resolve(process.cwd()); ; d = dirname(d)) {
    if (isRepo(d)) return d;
    if (dirname(d) === d) return resolve(fileURLToPath(new URL('../..', import.meta.url)));
  }
})();

/** Topic folders live under `topics/`. A cite (`<topic>/sources/<file>.txt#L10-L24`) is relative to that folder, so
 *  the store, reports and approved scripts keep the same cite text wherever the folder sits. */
export const TOPICS = 'topics';
export const topicDir = (topic: string, root = ROOT) => join(root, TOPICS, topic);

export const sha = (s: string | Buffer) => createHash('sha1').update(s).digest('hex').slice(0, 10);
export const lf = (s: string) => s.replace(/\r\n?/g, '\n');
/** The sha of a text file with its line endings normalised (checkout-independent); 'missing' when it is not there. */
export const fileSha = (f: string) => (existsSync(f) ? sha(lf(readFileSync(f, 'utf8'))) : 'missing');
export const readJson = <T>(p: string): T | null => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : null);
/** Serialises without passages: provenance stays with the citation, and the CLI re-reads them on demand. */
export const toJson = (x: unknown) => JSON.stringify(x, (k, v) => (k === 'passage' ? undefined : v), 1) + '\n';
export function writeArtifact(dir: string, name: string, content: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), content);
}

// ---- script folders ----

export const storySlug = (storyId: string) => storyId.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '');
/** A Short's id is `<story-id>/shorts/<slug>`: the parent and the slug, or null for a story. */
export function shortOf(storyId: string): { parent: string; slug: string } | null {
  const m = /^(.+)\/shorts\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(storyId);
  return m ? { parent: m[1], slug: m[2] } : null;
}
export const shortId = (parent: string, slug: string) => `${parent}/shorts/${slug}`;
/** A story's folder, or a Short's nested in its parent's: the id carries the nesting, so every CLI keyed by
 *  (topic, storyId) works on a Short unchanged. */
export const scriptDir = (topic: string, storyId: string, root = ROOT) => {
  const s = shortOf(storyId);
  return s
    ? join(topicDir(topic, root), 'scripts', storySlug(s.parent), 'shorts', s.slug)
    : join(topicDir(topic, root), 'scripts', storySlug(storyId));
};
export const FILES = {
  pkg: 'evidence-package.json',
  script: 'script.json',
  review: 'script-review.json',
  validation: 'validation.json',
  scriptMd: 'script.md',
  storyboard: 'storyboard.json',
  storyboardMd: 'storyboard.md',
  reviewMd: 'review.md',
  release: 'release.json',
} as const;
/** Every topics/<topic>/scripts/<slug> with a script.json, for the site and the tests. */
export function scriptDirs(root = ROOT): { topic: string; slug: string; dir: string }[] {
  const topics = readdirSync(join(root, TOPICS), { withFileTypes: true }).filter(
    (d) => d.isDirectory() && !d.name.startsWith('.'),
  );
  return topics.flatMap(({ name: topic }) => {
    const base = join(topicDir(topic, root), 'scripts');
    if (!existsSync(base)) return [];
    return readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(base, d.name, FILES.script)))
      .map((d) => ({ topic, slug: d.name, dir: join(base, d.name) }));
  });
}

/** Reads `<topic>/sources/<file>.txt#L10-L24` from topics/; null when the file or the lines do not exist. */
export function passageReader(root = ROOT): PassageReader {
  return (cite) => {
    const m = cite.match(/^([^#]+\.txt)#L(\d+)(?:-L(\d+))?$/);
    if (!m) return null;
    const file = join(root, TOPICS, m[1]);
    if (!existsSync(file)) return null;
    const lines = lf(readFileSync(file, 'utf8')).split('\n');
    const [from, to] = [Number(m[2]), Number(m[3] ?? m[2])];
    if (from < 1 || to < from || to > lines.length) return null;
    return lines.slice(from - 1, to).join('\n');
  };
}

/** Reads a document by its cite path (`<topic>/sources/<file>.txt`, under topics/) with normalised line endings; null when it is gone. */
export type DocReader = (file: string) => string | null;
export function docReader(root = ROOT): DocReader {
  return (file) => {
    const p = join(root, TOPICS, file);
    return existsSync(p) ? lf(readFileSync(p, 'utf8')) : null;
  };
}
export type DocHasher = (file: string) => string | null;
/** The sha the package records for a document; null when the reader has no such file. */
export function docHasher(r: DocReader = docReader()): DocHasher {
  return (file) => {
    const text = r(file);
    return text === null ? null : sha(text);
  };
}
