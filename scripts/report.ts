// npm run report [-- <command>]
//   (none)                        write topics/<topic>/report.json for every topic with a store (the watcher library),
//                                 then keep its public-record.json: exhibit numbers, and a revision for each claim whose
//                                 finding label or verdict changed; prints the revisions that need a note
//   seed [topic]                  no watcher: exhibit numbers only, for every topic with a report (or one); runs anywhere
//   note <topic> <claim> "<note>" explain the latest unexplained revision of a claim (exit 2 when there is none)
// The watcher lives in ../retire-sim (or $WATCHER_DIR), so the default command only runs locally; commit the results.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type ClaimState,
  claimStates,
  loadPublicRecord,
  nextPublicRecord,
  noteRevision,
  publicRecordPath,
  type PublicRecord,
} from '../src/lib/public-record';
import { ROOT, toJson, TOPICS, topicDir } from '../src/lib/io';
import { loadTopic, topicNames } from '../src/lib/topics';
import { watcher } from './watcher.mjs';

const [cmd, ...args] = process.argv.slice(2);
const today = new Date().toISOString().slice(0, 10);
const save = (topic: string, rec: PublicRecord) => writeFileSync(publicRecordPath(topic), toJson(rec));
const keep = (topic: string, before: Record<string, ClaimState> | null) =>
  save(topic, nextPublicRecord(loadPublicRecord(topic), before, loadTopic(topic), today));

if (cmd === 'note') {
  const [topic, claim, note] = args;
  if (!topic || !claim || !note?.trim()) {
    console.error('usage: npm run report -- note <topic> <claim> "<note>"');
    process.exit(1);
  }
  try {
    save(topic, noteRevision(loadPublicRecord(topic), claim, note.trim()));
    console.log(`noted ${claim} in ${TOPICS}/${topic}/public-record.json`);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(2);
  }
} else if (cmd === 'seed') {
  for (const topic of args[0] ? [args[0]] : topicNames()) {
    keep(topic, null);
    console.log('seeded', `${TOPICS}/${topic}/public-record.json`);
  }
} else if (cmd) {
  console.error(`unknown command ${cmd}: (none), seed [topic], note <topic> <claim> "<note>"`);
  process.exit(1);
} else {
  const reported = new Set(topicNames());
  for (const d of readdirSync(join(ROOT, TOPICS), { withFileTypes: true })) {
    if (!d.isDirectory() || !existsSync(join(topicDir(d.name), 'store', 'topics.json'))) continue;
    const before = reported.has(d.name) ? claimStates(loadTopic(d.name)) : null;
    const path = join(topicDir(d.name), 'report.json');
    const old = existsSync(path) ? readFileSync(path, 'utf8') : null;
    writeFileSync(path, watcher(['report', '--json', '--store', join(TOPICS, d.name, 'store')]));
    // The old report is the only record of the claims' previous states: if the new one cannot be applied, put it back,
    // so the next run still sees the change. ponytail: a kill between the two writes still loses it; diff against
    // states kept in public-record.json if that ever happens.
    try {
      if (topicNames().includes(d.name)) keep(d.name, before); // a report with no claims yet has nothing to number
    } catch (e) {
      if (old === null) rmSync(path);
      else writeFileSync(path, old);
      throw e;
    }
    console.log('wrote', `${TOPICS}/${d.name}/report.json`);
    const open = loadPublicRecord(d.name).revisions.filter((r) => !r.note.trim());
    if (open.length) {
      console.log(`${d.name}: ${open.length} revisions need a note:`);
      for (const r of open) console.log(`  ${r.id}  (npm run report -- note ${d.name} ${r.id} "<note>")`);
    }
  }
}
