// Shared by the web-quality gate: the built pages, the limits and exceptions in web-quality.json, and the triage that
// splits findings into new ones (fail) and approved ones, and flags exceptions nothing matches any more (fail).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT } from '../src/lib/io';

export const DIST = join(ROOT, 'dist');

export type Check = 'html' | 'axe' | 'browser';
export interface Finding {
  check: Check;
  rule: string;
  page: string; // dist path with forward slashes, e.g. heat-pumps/index.html
  detail: string;
}
export interface Exception {
  check: Check;
  rule: string;
  page: string; // regex over the dist path
  target?: string; // regex over the finding's detail (its selector), to narrow it to one component
  reason: string;
}
interface Limits {
  js: number;
  css: number;
  html: number;
}
export interface QualityConfig {
  budgets: { default: Limits; overrides: (Partial<Limits> & { page: string; reason: string })[] };
  thirdParty: { origin: string; reason: string }[];
  headers: string[];
  exceptions: Exception[];
}

export const config: QualityConfig = JSON.parse(readFileSync(join(ROOT, 'tests', 'web-quality.json'), 'utf8'));

/** Every built HTML page, as a dist path with forward slashes. */
export function distPages(): string[] {
  if (!existsSync(DIST)) return [];
  const walk = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.html') ? [join(d, e.name)] : [],
    );
  return walk(DIST)
    .map((f) => relative(DIST, f).replaceAll('\\', '/'))
    .sort();
}

/** The opening tag of every control (a link, button, form field or tabindex) inside a <summary>: axe's
 *  nested-interactive. Summaries do not nest, so the non-greedy match is exact. */
export const summaryControls = (html: string): string[] =>
  [...html.matchAll(/<summary\b[\s\S]*?<\/summary>/g)].flatMap((m) =>
    [
      ...m[0].matchAll(
        /<(?:a\b[^>]*\shref=|button\b|input\b|select\b|textarea\b|[a-z][\w-]*\b[^>]*\stabindex=)[^>]*>/gi,
      ),
    ].map((t) => t[0]),
  );

/** One page per template (home, about, directory, commission, topic, story, 404, and a story with its article when
 *  one is released): the representative set the browser suite runs. */
export function representativePages(all = distPages()): string[] {
  const size = (p: string) => readFileSync(join(DIST, p)).length;
  const smallest = (ps: string[]) => ps.sort((a, b) => size(a) - size(b))[0];
  const depth = (p: string) => p.split('/').length;
  const stories = all.filter((p) => !p.startsWith('commissions/') && depth(p) === 3);
  const withArticle = stories.filter((p) => readFileSync(join(DIST, p), 'utf8').includes('data-article'));
  const picks = [
    'index.html',
    'about/index.html',
    'privacy/index.html',
    'publishing/index.html',
    'inquiries/index.html',
    'institutions/index.html',
    smallest(all.filter((p) => p.startsWith('commissions/') && depth(p) === 3)),
    smallest(
      all.filter((p) => !/^(about|commissions|inquiries|institutions|privacy|publishing)\//.test(p) && depth(p) === 2),
    ), // topic page
    smallest(stories.filter((p) => !withArticle.includes(p))), // story page
    smallest(withArticle), // a story with its article
    '404.html',
  ];
  return picks.filter((p) => p && all.includes(p));
}

/** Splits findings by the approved exceptions: `fresh` fail the gate, `stale` exceptions fail it too. */
export function triage(check: Check, findings: Finding[], exceptions = config.exceptions) {
  const mine = exceptions.filter((e) => e.check === check);
  const used = new Set<Exception>();
  const fresh = findings.filter((f) => {
    const e = mine.find(
      (e) => e.rule === f.rule && new RegExp(e.page).test(f.page) && (!e.target || new RegExp(e.target).test(f.detail)),
    );
    if (e) used.add(e);
    return !e;
  });
  return { fresh, stale: mine.filter((e) => !used.has(e)) };
}

/** Readable failure text: one line per rule and page, so a 600-card page does not print 600 lines. */
export function summarize(findings: Finding[]): string {
  const groups = new Map<string, Finding[]>();
  for (const f of findings) groups.set(`${f.rule} @ ${f.page}`, [...(groups.get(`${f.rule} @ ${f.page}`) ?? []), f]);
  return [...groups].map(([k, fs]) => `${k} (x${fs.length}): ${fs[0].detail}`).join('\n');
}
