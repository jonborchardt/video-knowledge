#!/usr/bin/env node
// A stand-in for `npm run article -- validate|reaffirm` in the maintenance tests: validate writes a passing (or
// blocked) validation, reaffirm appends a reaffirmation to the release; the request verbs are the real module's
// (the tests route only these two here). Run as
// `node fake-article-cli.mjs <verb> <topic> <story-id> [...]` in the root; FAKE_ARTICLE_CONFIG: { validation?: 'passed' | 'blocked' }.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [verb, topic, storyId, ...rest] = process.argv.slice(2);
const root = process.cwd();
const cfg = process.env.FAKE_ARTICLE_CONFIG ? JSON.parse(readFileSync(process.env.FAKE_ARTICLE_CONFIG, 'utf8')) : {};
const flag = (name) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : undefined);
const slug = storyId.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '');
const dir = join(root, 'topics', topic, 'scripts', slug);
const read = (f) => (existsSync(join(dir, f)) ? JSON.parse(readFileSync(join(dir, f), 'utf8')) : null);
const write = (f, x) => writeFileSync(join(dir, f), JSON.stringify(x, null, 1) + '\n');
const log = (p) => {
  if (process.env.FAKE_ARTICLE_LOG)
    writeFileSync(process.env.FAKE_ARTICLE_LOG, [verb, ...rest].join(' ') + '\n', { flag: 'a' });
  return p;
};
log();
switch (verb) {
  case 'validate': {
    const status = cfg.validation ?? 'passed';
    write('article-validation.json', { status, sentences: [], issues: [], counts: {} });
    console.log(status === 'passed' ? 'RESULT: PASSED' : `RESULT: FAILED (${status})`);
    process.exit(status === 'blocked' ? 2 : 0);
  }
  // eslint-disable-next-line no-fallthrough -- process.exit above ends the case
  case 'reaffirm': {
    const r = read('article-release.json');
    r.date = new Date().toISOString().slice(0, 10);
    r.history.push({
      revision: r.revision,
      date: r.date,
      approvedBy: flag('--approved-by'),
      note: flag('--note'),
      reaffirmed: true,
    });
    write('article-release.json', r);
    console.log(`reaffirmed: revision ${r.revision} stands`);
    process.exit(0);
  }
  // eslint-disable-next-line no-fallthrough -- process.exit above ends the case
  default:
    console.error(`fake article cli: no ${verb}`);
    process.exit(1);
}
