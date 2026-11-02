// A study document saved as text (spec §4.6: the one verb the collect role runs with arguments it chose, so it is
// strict about where it writes): an https URL, a bare `<name>.txt` target under topics/<topic>/sources/, a size cap,
// `pdftotext -layout` for a PDF and a tag-stripper for HTML, the `Source:` header line first. Pure checks here; the
// download and the conversion in `fetchDoc`, injected for tests.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, topicDir } from '../../shared/io';
import { USER_AGENT } from './search';

export const MAX_DOC_BYTES = 50 * 1024 * 1024;

/** Why the verb refuses: a non-https URL, a file name with a path, not `.txt`, no topic folder. */
export function fetchDocProblem(topic: string, url: string, file: string, root = ROOT): string | null {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(topic)) return `the topic must be a slug (got ${topic})`;
  if (!/^https:\/\/\S+$/.test(url)) return `the URL must be https (got ${url})`;
  if (!/^[a-z0-9][a-z0-9._-]*\.txt$/i.test(file) || /[\\/]/.test(file) || file.includes('..'))
    return `the file must be a bare name ending in .txt under topics/${topic}/sources/ (got ${file})`;
  if (!existsSync(topicDir(topic, root))) return `no topic folder topics/${topic}`;
  return null;
}

/** HTML to readable text: scripts and styles dropped, block tags to line breaks, entities decoded, blank runs squeezed. */
export function htmlToText(html: string): string {
  const noScript = html.replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ');
  const blocks = noScript
    .replace(/<\/(p|div|li|h[1-6]|tr|br|section|article|table|blockquote|pre)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  const stripped = blocks.replace(/<[^>]+>/g, ' ');
  const decoded = stripped
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  return decoded
    .split('\n')
    .map((l) => l.replace(/[ \t\r]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface FetchDocDeps {
  fetchFn?: typeof fetch;
  /** `pdftotext -layout [-f a -l b] <pdf> -` as text; the default runs the binary. */
  pdfToText?: (pdf: Buffer, pages?: string) => string;
  today?: string;
}

const pdftotext = (pdf: Buffer, pages?: string): string => {
  const dir = join(tmpdir(), `vk-fetch-doc-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'doc.pdf');
  writeFileSync(file, pdf);
  try {
    const range = pages ? pages.split('-') : [];
    const args = ['-layout', ...(range.length === 2 ? ['-f', range[0], '-l', range[1]] : []), file, '-'];
    return execFileSync('pdftotext', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/** Downloads, converts and writes `topics/<topic>/sources/<file>`; returns the line count. Throws on a refusal or a
 *  failed download (the CLI maps them to exit codes). */
export async function fetchDoc(
  topic: string,
  url: string,
  file: string,
  opts: { pages?: string; root?: string } & FetchDocDeps = {},
): Promise<{ path: string; lines: number; kind: 'pdf' | 'text' }> {
  const root = opts.root ?? ROOT;
  const problem = fetchDocProblem(topic, url, file, root);
  if (problem) throw new Error(`refused: ${problem}`);
  const fetchFn = opts.fetchFn ?? fetch;
  const res = await fetchFn(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8' },
  });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_DOC_BYTES) throw new Error(`${url} is ${bytes.length} bytes, over the ${MAX_DOC_BYTES} cap`);
  const type = res.headers.get('content-type') ?? '';
  const isPdf = /application\/pdf/i.test(type) || bytes.subarray(0, 5).toString('latin1') === '%PDF-';
  const body = isPdf ? (opts.pdfToText ?? pdftotext)(bytes, opts.pages) : htmlToText(bytes.toString('utf8'));
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const text = `Source: ${url} (retrieved ${today})\n\n${body.replace(/\r/g, '').trim()}\n`;
  const dir = join(topicDir(topic, root), 'sources');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, file);
  writeFileSync(path, text);
  return { path, lines: text.split('\n').length - 1, kind: isPdf ? 'pdf' : 'text' };
}

/** The `Source:` URL of a saved document, or null. */
export const sourceUrlOf = (path: string): string | null =>
  existsSync(path) ? (/^Source: (\S+)/.exec(readFileSync(path, 'utf8'))?.[1] ?? null) : null;
