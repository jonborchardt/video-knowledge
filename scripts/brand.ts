// npm run brand
//   Renders every brand's kit into brand/<brand>/ (brand/README.md): the Commonwealth (`cor`) and each commission in
//   src/config/site.ts, every slot in brand/slots.json except templates, drawn by scripts/brand/draw.js from the brand's
//   kit.json (palette, emblem, slogan). Text is fitted in the real fonts (brand/fonts) inside Remotion's headless Chrome,
//   then each SVG is saved (committed) and rasterized to the PNG or JPG its slot names (gitignored, for uploads). Writes
//   each kit's `assets` and the site's copies: share cards public/og/, seals public/commissions/, stamps public/stamps/,
//   the favicon set and src/assets/logo.svg (the Commonwealth's small mark), and one inquiry card per public story
//   (template og-inquiry, public/og/stories/). Re-run after changing a drawing, a kit or a story's question.
import { execFile } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { commissionBody, commissionKey, commissionOf, commissions, site } from '../src/config/site';
import { ROOT, readJson } from '../src/lib/io';
import { loadStories, storyUrlSlug } from '../src/lib/stories';
import { publicTopicNames } from '../src/lib/topics';

interface Slot {
  id: string;
  format: string;
  grounds?: string[];
  forms?: string[];
  template?: boolean;
}
interface Kit {
  brand: string;
  palette: Record<string, string>;
  slogan: { text: string };
  assets: Record<string, unknown>;
  [k: string]: unknown;
}
interface Asset {
  slot: string;
  key: string | null;
  w: number;
  h: number;
  svg: string;
}

const BRAND = join(ROOT, 'brand');
// The stamps the site uses, copied per institution into public/stamps/<key>/ (src/components/Stamp.astro).
const SITE_STAMPS = [
  ['stamp-record', 'rect'],
  ['stamp-finding', 'round'],
  ['stamp-examination', 'round'],
] as const;
const slots = readJson<{ slots: Slot[] }>(join(BRAND, 'slots.json'))!.slots.filter((s) => !s.template);
const FONTS = `
@font-face { font-family: 'Libre Baskerville'; font-weight: 400 700; src: url('${pathToFileURL(join(BRAND, 'fonts/LibreBaskerville.woff2'))}'); }
@font-face { font-family: 'Libre Baskerville'; font-style: italic; src: url('${pathToFileURL(join(BRAND, 'fonts/LibreBaskerville-Italic.woff2'))}'); }
@font-face { font-family: 'IBM Plex Sans'; font-weight: 400 600; src: url('${pathToFileURL(join(BRAND, 'fonts/IBMPlexSans.woff2'))}'); }
@font-face { font-family: 'IBM Plex Mono'; font-weight: 400; src: url('${pathToFileURL(join(BRAND, 'fonts/IBMPlexMono-400.woff2'))}'); }
@font-face { font-family: 'IBM Plex Mono'; font-weight: 500; src: url('${pathToFileURL(join(BRAND, 'fonts/IBMPlexMono-500.woff2'))}'); }
html, body { margin: 0; background: transparent; } svg { display: block; }`;
const LOAD_FONTS = `Promise.all(['16px "Libre Baskerville"', 'bold 16px "Libre Baskerville"', 'italic 16px "Libre Baskerville"', '16px "IBM Plex Sans"', '16px "IBM Plex Mono"', '500 16px "IBM Plex Mono"'].map((f) => document.fonts.load(f)))`;

// Remotion downloads chrome-headless-shell for video renders; the kit uses the same binary.
function chrome(): string {
  const base = join(ROOT, 'node_modules/.remotion/chrome-headless-shell');
  const e = (existsSync(base) ? readdirSync(base, { recursive: true, withFileTypes: true }) : []).find(
    (e) => e.isFile() && /^chrome-headless-shell(\.exe)?$/.test(e.name),
  );
  const bin = e && join(e.parentPath, e.name);
  if (!bin) throw new Error(`no chrome-headless-shell under ${base}: run \`npx remotion browser ensure\` first`);
  return bin;
}
const CHROME = chrome();
const run = (args: string[]) =>
  new Promise<string>((ok, fail) =>
    execFile(
      CHROME,
      ['--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--virtual-time-budget=15000', ...args],
      { maxBuffer: 1 << 28 },
      (err, out) => (err ? fail(err) : ok(out)),
    ),
  );
async function pool<T>(items: T[], n: number, f: (x: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (queue.length) await f(queue.shift()!);
    }),
  );
}

// The names a brand's drawings use. The stacked name splits the ceremonial name into two lines of near-equal length.
const twoLines = (s: string) => {
  const w = s.split(' ');
  let best = [s];
  for (let i = 1; i < w.length; i++) {
    const l = [w.slice(0, i).join(' '), w.slice(i).join(' ')];
    if (best.length === 1 || Math.max(...l.map((x) => x.length)) < Math.max(...best.map((x) => x.length))) best = l;
  }
  return best;
};
function brandData(key: string, kit: Kit) {
  const c = commissions[key];
  const name = c ? c.ceremonialName : site.name;
  return {
    key,
    palette: kit.palette,
    tagline: kit.slogan.text,
    disclosure: site.disclosure,
    name,
    short: c ? c.name : 'Commonwealth',
    fullName: c ? c.fullName : site.name,
    handle: c?.handle ?? null,
    body: c ? commissionBody(c) : 'Commonwealth',
    ringTop: name.toUpperCase(),
    nameLines: twoLines(name),
  };
}

const unescape = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
/** The files a slot ships: one per form and ground (the stamps), per ground, per form, or one. */
const keysOf = (s: Pick<Slot, 'grounds' | 'forms'>) =>
  s.forms && s.grounds ? s.forms.flatMap((f) => s.grounds!.map((g) => `${f}-${g}`)) : (s.grounds ?? s.forms);
const fileOf = (a: Asset) => `${a.slot}${a.key ? '-' + a.key : ''}`;
const tmp = join(tmpdir(), `brand-kit-${process.pid}`); // per run: another checkout may be drawing too
mkdirSync(tmp, { recursive: true });
const draw = readFileSync(join(ROOT, 'scripts/brand/draw.js'), 'utf8');

/** Draws `list` (a BrandKit expression) in a page, fits its text in the real fonts and reads the fitted SVGs back. */
async function drawn<T extends { svg: string }>(name: string, list: string): Promise<T[]> {
  const page = join(tmp, `${name}.html`);
  writeFileSync(
    page,
    `<!doctype html><meta charset="utf-8"><style>${FONTS}</style><div id="kit"></div><pre id="out"></pre>
<script>${draw}</script><script>
const list = ${list};
const root = document.getElementById('kit');
root.innerHTML = list.map((a) => a.svg).join('');
${LOAD_FONTS}.then(() => {
  BrandKit.fitText(root);
  const svgs = [...root.children].map((s) => new XMLSerializer().serializeToString(s));
  document.getElementById('out').textContent = JSON.stringify(list.map((a, i) => ({ ...a, svg: svgs[i] })));
  root.remove();
}).catch((e) => (document.getElementById('out').textContent = 'ERROR ' + e.message));
</script>`,
  );
  const dom = await run(['--dump-dom', pathToFileURL(page).href]);
  const m = /<pre id="out">([\s\S]*?)<\/pre>/.exec(dom);
  if (!m || !m[1]) throw new Error(`${name}: the page did not finish drawing`);
  if (m[1].startsWith('ERROR '))
    throw new Error(`${name}: ${unescape(m[1].slice(6))} (a font failed to load, or text does not fit)`);
  return JSON.parse(unescape(m[1])) as T[];
}
/** Rasterizes one fitted SVG in the same fonts to `png` (transparent where the drawing is). */
async function shoot(name: string, a: { svg: string; w: number; h: number }, png: string) {
  const shot = join(tmp, `${name}.html`);
  writeFileSync(
    shot,
    `<!doctype html><meta charset="utf-8"><style>${FONTS}</style>${a.svg}<script>${LOAD_FONTS}</script>`,
  );
  await run([
    `--window-size=${a.w},${a.h}`,
    '--default-background-color=00000000',
    `--screenshot=${png}`,
    pathToFileURL(shot).href,
  ]);
}
const toJpg = async (png: string, jpg: string) => {
  await sharp(png).flatten({ background: '#ffffff' }).jpeg({ quality: 90, mozjpeg: true }).toFile(jpg);
  rmSync(png);
};

for (const key of ['cor', ...Object.keys(commissions)]) {
  const kitPath = join(BRAND, key, 'kit.json');
  const kit = readJson<Kit>(kitPath)!;
  // 1. Draw every asset, fit its text in the real fonts and read the fitted SVGs back out of the page.
  const assets = await drawn<Asset>(key, `BrandKit.assets(${JSON.stringify(brandData(key, kit))})`);

  // 2. Save the SVGs, rasterize each in the same fonts, and record them in the kit.
  const dir = join(BRAND, key);
  for (const f of readdirSync(dir)) if (/\.(svg|png|jpg)$/.test(f)) rmSync(join(dir, f));
  const recorded: Record<string, unknown> = {};
  for (const slot of slots) {
    const mine = assets.filter((a) => a.slot === slot.id);
    const keys = keysOf(slot);
    if (!mine.length || (keys && keys.some((k) => !mine.find((a) => a.key === k))))
      throw new Error(`${key}: draw.js has no ${slot.id}`);
    recorded[slot.id] = keys
      ? {
          files: Object.fromEntries(keys.map((k) => [k, `${slot.id}-${k}.svg`])),
          status: 'DECIDED',
          source: 'npm run brand',
        }
      : { file: `${slot.id}.svg`, status: 'DECIDED', source: 'npm run brand' };
  }
  await pool(assets, 6, async (a) => {
    const name = fileOf(a);
    writeFileSync(join(dir, `${name}.svg`), a.svg + '\n');
    const png = join(dir, `${name}.png`);
    await shoot(`${key}-${name}`, a, png);
    if (slots.find((s) => s.id === a.slot)!.format.includes('jpg')) await toJpg(png, join(dir, `${name}.jpg`));
  });
  writeFileSync(kitPath, JSON.stringify({ ...kit, assets: recorded }, null, 2) + '\n');
  // The site's copies: the share card (public/og/<key>.jpg, the Commonwealth's is site.jpg) and an institution's seal.
  mkdirSync(join(ROOT, 'public/og'), { recursive: true });
  copyFileSync(join(dir, 'og-default.jpg'), join(ROOT, 'public/og', `${key === 'cor' ? 'site' : key}.jpg`));
  if (key !== 'cor') {
    mkdirSync(join(ROOT, 'public/commissions'), { recursive: true });
    await sharp(join(dir, 'seal.png'))
      .resize(256, 256)
      .png({ compressionLevel: 9 })
      .toFile(join(ROOT, 'public/commissions', `${key}.png`));
    // the stamps the site shows (src/components/Stamp.astro), on paper and on the ground for dark mode
    const stamps = join(ROOT, 'public/stamps', key);
    rmSync(stamps, { recursive: true, force: true });
    mkdirSync(stamps, { recursive: true });
    for (const [slot, form] of SITE_STAMPS)
      for (const g of ['paper', 'ground'])
        await sharp(join(dir, `${slot}-${form}-${g}.png`))
          .resize(form === 'rect' ? 480 : 200)
          .png({ compressionLevel: 9 })
          .toFile(join(stamps, `${slot}-${form}-${g}.png`));
  }
  console.log(`${key}: ${assets.length} files`);
}
// The per-inquiry share cards (template og-inquiry): one per public story at public/og/stories/<topic>/<story slug>.jpg,
// all rewritten each run so a removed story's card goes too. brand/og-inquiry.json records the question each was drawn
// from; tests/accounts.test.ts fails when a story's question has changed since.
const CARDS = join(ROOT, 'public/og/stories');
rmSync(CARDS, { recursive: true, force: true });
const cardQuestions: Record<string, string> = {};
for (const topic of publicTopicNames()) {
  const key = commissionKey(commissionOf(topic)!);
  const stories = loadStories(topic)?.stories ?? [];
  if (!stories.length) continue;
  const data = JSON.stringify(brandData(key, readJson<Kit>(join(BRAND, key, 'kit.json'))!));
  const cards = await drawn<{ svg: string; w: number; h: number }>(
    `cards-${topic}`,
    `${JSON.stringify(stories.map((s) => s.question))}.map((q) => BrandKit.inquiryCard(${data}, q))`,
  );
  mkdirSync(join(CARDS, topic), { recursive: true });
  await pool(
    stories.map((s, i) => [s, cards[i]] as const),
    6,
    async ([s, card]) => {
      const png = join(tmp, `card-${topic}-${storyUrlSlug(s)}.png`);
      await shoot(`card-${topic}-${storyUrlSlug(s)}`, card, png);
      await toJpg(png, join(CARDS, topic, `${storyUrlSlug(s)}.jpg`));
    },
  );
  for (const s of stories) cardQuestions[`${topic}/${storyUrlSlug(s)}`] = s.question;
  console.log(`${topic}: ${stories.length} inquiry cards`);
}
writeFileSync(join(BRAND, 'og-inquiry.json'), JSON.stringify(cardQuestions, null, 2) + '\n');
// The site's mark: the Commonwealth's small mark as the favicon set and the header logo (no text, so sharp can draw it).
const mark = readFileSync(join(BRAND, 'cor/mark-small.svg'), 'utf8')
  .replace(/<defs>[\s\S]*?<\/defs>/, '')
  .replace('<svg ', `<svg role="img" aria-label="${site.name}" `);
writeFileSync(join(ROOT, 'public/favicon.svg'), mark);
writeFileSync(join(ROOT, 'src/assets/logo.svg'), mark);
await sharp(Buffer.from(mark), { density: 300 }).resize(96, 96).png().toFile(join(ROOT, 'public/favicon.png'));
await sharp(Buffer.from(mark), { density: 300 })
  .resize(180, 180)
  .png()
  .toFile(join(ROOT, 'public/apple-touch-icon.png'));
console.log('site: public/og, public/commissions, favicon set, src/assets/logo.svg');
rmSync(tmp, { recursive: true, force: true });
