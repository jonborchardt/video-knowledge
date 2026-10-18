// Repo-wide file helpers: content hashes, line endings and JSON artifacts. Every stage imports them from here, so no
// stage depends on another stage's module for a utility.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
