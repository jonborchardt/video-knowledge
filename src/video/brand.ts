// The brand kit inside a render: the story's institution's kit (brand/<key>/, written by `npm run brand`) is copied into
// the video folder's brand/ before bundling, so a scene loads any slot with staticFile('brand/<slot>.png') (or .svg,
// .jpg; slot names in brand/slots.json). A topic no institution claims uses the Commonwealth's kit.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../lib/io';
import { brandKey, kitPaletteOf } from '../lib/look';
import type { KitPalette } from './types';

export { brandKey } from '../lib/look';

export function stageBrand(topic: string, publicDir: string): string {
  const key = brandKey(topic);
  const from = join(ROOT, 'brand', key);
  const files = existsSync(from) ? readdirSync(from).filter((f) => /\.(svg|png|jpg)$/.test(f)) : [];
  // The rasters are gitignored and a scene loads them (the Short's seal), so a render needs them generated.
  if (!files.some((f) => f.endsWith('.png'))) throw new Error(`brand/${key} has no PNG/JPG: run npm run brand`);
  const to = join(publicDir, 'brand');
  mkdirSync(to, { recursive: true });
  for (const f of files) copyFileSync(join(from, f), join(to, f));
  return key;
}

/** The four colour roles of the owning institution's kit; a render refuses a kit `npm run brand` has not written. */
export function kitPalette(topic: string, root = ROOT): KitPalette {
  const palette = kitPaletteOf(topic, root);
  if (!palette) throw new Error(`brand/${brandKey(topic)}/kit.json missing: run npm run brand`);
  return palette;
}
