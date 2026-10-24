// The brand kit inside a render: the story's institution's kit (brand/<key>/, written by `npm run brand`) is copied into
// the video folder's brand/ before bundling, so a scene loads any slot with staticFile('brand/<slot>.png') (or .svg,
// .jpg; slot names in brand/slots.json). A topic no institution claims uses the Commonwealth's kit.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { commissionKey, commissionOf } from '../config/site';
import { ROOT } from '../lib/io';

export const brandKey = (topic: string): string => {
  const c = commissionOf(topic);
  return c ? commissionKey(c) : 'cor';
};

export function stageBrand(topic: string, publicDir: string): string {
  const key = brandKey(topic);
  const from = join(ROOT, 'brand', key);
  const files = existsSync(from) ? readdirSync(from).filter((f) => /\.(svg|png|jpg)$/.test(f)) : [];
  // The rasters are gitignored; without them a scene can still use the SVGs.
  if (!files.some((f) => f.endsWith('.png'))) console.warn(`brand/${key} has no PNG/JPG: run npm run brand`);
  const to = join(publicDir, 'brand');
  mkdirSync(to, { recursive: true });
  for (const f of files) copyFileSync(join(from, f), join(to, f));
  return key;
}
