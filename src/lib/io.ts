// Repo-wide file helpers: content hashes, line endings and JSON artifacts. Every stage imports them from here, so no
// stage depends on another stage's module for a utility.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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
