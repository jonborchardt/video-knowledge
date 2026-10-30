// Brand kits and accounts (brand/README.md). brand/slots.json lists every asset slot; brand/<brand>/kit.json maps a
// brand's slots to the SVGs `npm run brand` writes; brand/<brand>/accounts.json records what each public account shows (YouTube today; X, Bluesky
// and the rest as they are created), its avatar and banner by slot id. Accounts must agree with the commission in
// src/config/site.ts and fit each platform's limits.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { commissions, site } from '../src/config/site';
import { contentGraph, storyNode } from '../src/modules/website';
import { readJson, ROOT } from '../src/shared/io';
import { loadStories, storyUrlSlug } from '../src/modules/stories';
import { publicTopicNames } from '../src/lib/topics';

interface Kit {
  brand: string;
  palette: Record<string, string>;
  assets: Record<string, { file?: string; files?: Record<string, string>; status: string }>;
}
interface Account {
  name: string;
  handle: string;
  url: string;
  avatar: string; // slot id in the kit
  banner?: string; // slot id in the kit
  watermark?: string; // slot id in the kit (YouTube's branding watermark)
  description: string;
  keywords?: string[];
  links?: { title: string; url: string }[];
}

// Profile-text limits per platform; a platform not listed here fails until its limit is added.
const DESCRIPTION_LIMIT: Record<string, number> = { youtube: 1000, twitter: 160, bluesky: 256 };
const STATUS = ['DECIDED', 'RECOMMENDED', 'PROPOSED'];

const BRAND = join(ROOT, 'brand');
const slots = new Map(
  readJson<{ slots: { id: string; grounds?: string[]; forms?: string[]; template?: boolean }[] }>(
    join(BRAND, 'slots.json'),
  )!.slots.map((s) => [s.id, s]),
);
const brands = readdirSync(BRAND, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(BRAND, d.name, 'kit.json')))
  .map((d) => d.name);

describe('brand kits', () => {
  it('one per commission and the Commonwealth', () => {
    expect(brands.sort()).toEqual(['cor', ...Object.keys(commissions)].sort());
  });

  for (const b of brands) {
    it(b, () => {
      const kit = readJson<Kit>(join(BRAND, b, 'kit.json'))!;
      expect(kit.brand).toBe(b);
      for (const k of ['ground', 'accent', 'paper', 'ink']) expect(kit.palette[k], k).toMatch(/^#[0-9A-F]{6}$/i);
      for (const [slot, a] of Object.entries(kit.assets)) {
        expect(slots.has(slot), `unknown slot ${slot}`).toBe(true);
        expect(STATUS).toContain(a.status);
        // A slot that ships on several grounds lists one file per ground; any other slot lists one file.
        // (a stamp has both: one per form and ground, `<form>-<ground>`)
        const sl = slots.get(slot);
        const keys =
          sl?.forms && sl.grounds
            ? sl.forms.flatMap((f) => sl.grounds!.map((g) => `${f}-${g}`))
            : (sl?.grounds ?? sl?.forms);
        const files = keys ? keys.map((g) => a.files?.[g]) : [a.file];
        for (const f of files) expect(f && existsSync(join(BRAND, b, f)), `${slot}: ${f}`).toBe(true);
      }
      // The kit is complete: `npm run brand` wrote every slot but the templates (and the site's copy of the seal).
      for (const [id, s] of slots)
        if (!s.template) expect(kit.assets[id], `${b} has no ${id}: run npm run brand`).toBeDefined();
      if (b !== 'cor')
        expect(existsSync(join(ROOT, 'public/commissions', `${b}.png`)), `public/commissions/${b}.png`).toBe(true);
      // the site's stamps (src/components/Stamp.astro), in paper and ground ink
      if (b !== 'cor')
        for (const f of ['stamp-record-rect', 'stamp-finding-round', 'stamp-examination-round'])
          for (const g of ['paper', 'ground'])
            expect(existsSync(join(ROOT, 'public/stamps', b, `${f}-${g}.png`)), `${b}: ${f}-${g}`).toBe(true);

      const acc = readJson<{ commission: string; accounts: Record<string, Account> }>(join(BRAND, b, 'accounts.json'));
      const c = commissions[b];
      if (c?.handle) expect(acc?.accounts.youtube, `${b} has a channel but no accounts.youtube`).toBeDefined();
      if (!acc) return;
      expect(acc.commission).toBe(b);
      const yt = acc.accounts.youtube;
      if (yt) {
        expect(yt.name).toBe(c.fullName);
        expect(yt.handle).toBe(c.handle);
        expect(yt.url).toBe(c.youtube);
        expect(yt.description).toContain(site.disclosure);
      }
      for (const [platform, a] of Object.entries(acc.accounts)) {
        for (const slot of [a.avatar, a.banner, a.watermark].filter(Boolean) as string[])
          expect(kit.assets[slot], `${platform}: slot ${slot} not in the kit`).toBeDefined();
        expect(DESCRIPTION_LIMIT[platform], `no description limit for ${platform}`).toBeDefined();
        expect(a.description.length, platform).toBeLessThanOrEqual(DESCRIPTION_LIMIT[platform]);
        for (const u of [a.url, ...(a.links ?? []).map((l) => l.url)]) expect(u).toMatch(/^https:\/\//);
      }
    });
  }

  it('every live story has an inquiry card drawn from its current question', () => {
    const g = contentGraph(ROOT, publicTopicNames(), 'live');
    const want = Object.fromEntries(
      publicTopicNames().flatMap((topic) =>
        (loadStories(topic)?.stories ?? [])
          .filter((s) => g.nodes.get(storyNode(topic, s.id))?.public)
          .map((s) => [`${topic}/${storyUrlSlug(s)}`, s.question]),
      ),
    );
    // brand/og-inquiry.json is what `npm run brand` drew; a changed or new question needs a re-run
    expect(readJson(join(BRAND, 'og-inquiry.json')), 'stale inquiry cards: run npm run brand').toEqual(want);
    for (const card of Object.keys(want))
      expect(existsSync(join(ROOT, 'public/og/stories', `${card}.jpg`)), card).toBe(true);
  });
});
