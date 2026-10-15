// node --test scripts/ — build the site and check what a broken page would look like.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SITE = join(ROOT, '_site');
execFileSync(process.execPath, [join(ROOT, 'scripts', 'build-site.mjs')], { stdio: 'ignore' });
const pages = ['index.html', ...readdirSync(SITE, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => join(d.name, 'index.html'))];

test('builds a home page and at least one subject page', () => {
  assert.ok(pages.length >= 2, 'expected a subject page');
  for (const p of pages) assert.ok(existsSync(join(SITE, p)), p);
});

for (const p of pages) {
  const html = readFileSync(join(SITE, p), 'utf8');
  const text = html.replace(/<script>[\s\S]*?<\/script>/g, '');
  test(`${p}: no template leaks`, () => {
    for (const bad of ['undefined', 'NaN', '[object Object]', '${']) assert.ok(!text.includes(bad), `found "${bad}"`);
  });
  test(`${p}: inline scripts parse`, () => {
    for (const [, js] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(js);
  });
  test(`${p}: local links resolve`, () => {
    for (const [, href] of html.matchAll(/href="([^"#:]+\.html)"/g)) assert.ok(existsSync(join(SITE, p, '..', href)), `${href} missing`);
  });
}

test('subject pages have their tab sections and data', () => {
  for (const p of pages.slice(1)) {
    const html = readFileSync(join(SITE, p), 'utf8');
    for (const id of ['recap', 'top', 'claims', 'sources']) assert.match(html, new RegExp(`<section id="${id}" data-tab=`), `${p} #${id}`);
    const data = JSON.parse(html.match(/const D = (\{[\s\S]*?\});\n/)[1].replace(/\\u003c/g, '<'));
    assert.ok(data.claims.length > 0 && data.videos.length > 0, `${p} has no claims or videos`);
  }
});
