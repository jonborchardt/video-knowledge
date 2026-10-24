// The review page's media, streamed from disk by the dev server only (astro.config.mjs injects it when command ===
// 'dev'): the packaged mp4, its thumbnail and the QA contact sheet. Nothing here is copied into public/ or dist/, and the
// mp4s stay gitignored. Range requests so the player can seek.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { APIRoute } from 'astro';
import { readJson } from '../lib/io';
import { storyIdOfPath } from '../lib/review-view';
import { scriptDir } from '../lib/script';

/** The byte range a Range header asks for (end inclusive, clamped to the file), null for the whole file, or 'invalid'
 *  for one this server cannot satisfy (several ranges, a start past the end, a malformed header). */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null | 'invalid' {
  if (header === null) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (!m[1] && !m[2])) return 'invalid';
  if (!m[1]) {
    const n = Number(m[2]);
    return n > 0 ? { start: Math.max(0, size - n), end: size - 1 } : 'invalid';
  }
  const start = Number(m[1]);
  const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  return start < size && start <= end ? { start, end } : 'invalid';
}

const TYPES = { 'review.mp4': 'video/mp4', 'thumbnail.png': 'image/png', 'contact-sheet.png': 'image/png' } as const;

/** The file on disk a media name stands for, in the production's folder, or null. */
function fileOf(dir: string, name: string): string | null {
  if (name === 'review.mp4') {
    const mp4 = readJson<{ mp4?: string }>(join(dir, 'video', 'review', 'review.json'))?.mp4;
    return mp4 && /^[\w.-]+\.mp4$/.test(mp4) ? join(dir, 'video', 'review', mp4) : null;
  }
  if (name === 'thumbnail.png') return join(dir, 'video', 'review', 'thumbnail.png');
  if (name === 'contact-sheet.png') return join(dir, 'video', 'contact-sheet.png');
  return null;
}

export const GET: APIRoute = ({ params, request }) => {
  const { topic = '', file = '', path = '' } = params;
  const storyId = storyIdOfPath(topic, path);
  const abs = storyId && file in TYPES ? fileOf(scriptDir(topic, storyId), file) : null;
  if (!abs || !existsSync(abs)) return new Response('not found', { status: 404 });
  const size = statSync(abs).size;
  const range = parseRange(request.headers.get('range'), size);
  const type = TYPES[file as keyof typeof TYPES];
  if (range === 'invalid') return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  const { start, end } = range ?? { start: 0, end: size - 1 };
  const body = Readable.toWeb(createReadStream(abs, { start, end })) as ReadableStream;
  return new Response(body, {
    status: range ? 206 : 200,
    headers: {
      'Content-Type': type,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
    },
  });
};
