// npm run stories -- <command> <topic> [...]
//   discover <topic> [--json]           draft, audit, evaluate and rank candidates; writes topics/<topic>/stories.json
//                                       (merges topics/<topic>/story-review.json when present; see src/modules/stories/briefs/stories.md)
//   show <topic> [story-id] [--json]    the ranked list, or one story with its audit and cited passages
//   validate <topic> <assertions.json> [--json]   run the evidence gate on your own assertions (exit 2 if any is blocked)
// Reads topics/<topic>/report.json and topics/<topic>/store/ through src/lib/topics.ts; no watcher checkout needed.
import { readFileSync, writeFileSync } from 'node:fs';
import { passageReader, toJson } from '../../shared/io';
import { validate } from '../../shared/evidence-gate';
import type { Assertion, Validation, Story } from '../../shared/types';
import { loadReview } from './review';
import { discover, loadStories, storiesPath } from './stories';
import { loadTopic } from '../../lib/topics';

const [cmd, topic, ...rest] = process.argv.slice(2);
const json = rest.includes('--json');
const args = rest.filter((a) => a !== '--json');
const usage = () => {
  console.error(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 6)
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'),
  );
  process.exit(1);
};
if (!cmd || !topic) usage();
const read = passageReader();
const pad = (s: string | number, w: number) => String(s).padEnd(w);

function list(stories: Story[]) {
  console.log(
    `${pad('#', 3)}${pad('overall', 8)}${pad('edit.', 6)}${pad('evid.', 6)}${pad('readiness', 15)}${pad('id', 58)}title`,
  );
  stories.forEach((s, i) =>
    console.log(
      `${pad(i + 1, 3)}${pad(s.scores.overall.toFixed(2), 8)}${pad(s.scores.editorial.toFixed(2), 6)}${pad(s.scores.evidence.toFixed(2), 6)}${pad(s.readiness, 15)}${pad(s.id, 58)}${s.title}`,
    ),
  );
}
function printValidation(v: Validation, indent = '  ') {
  const line = (s: string) => console.log(indent + s);
  line(`[${v.status} / ${v.decision}${v.review ? ' / review' : ''}] ${v.text}`);
  line(`  ${v.explanation} (modality: ${v.modality})`);
  for (const p of v.problems) line(`  PROBLEM: ${p}`);
  for (const l of v.limitations) line(`  limit: ${l}`);
  for (const s of v.suggestions) line(`  suggest: ${s}`);
  for (const [label, items] of [
    ['supports', v.supporting],
    ['contradicts', v.contradicting],
    ['qualifies', v.qualifying],
    ['context', v.context.filter((x) => x.role === 'context')],
  ] as const)
    for (const x of items) {
      const cite = 'cite' in x.ref ? x.ref.cite : 'source' in x.ref ? x.ref.source : 'AI guess';
      line(
        `  ${label}${x.cited ? '' : ' (uncited)'}: ${x.by} ${x.verdict ?? ''} ${x.confidence ?? ''} ${x.applicability ?? ''}${x.basis === 'review' ? ' [reviewed]' : x.basis === 'recorded' ? ' [recorded]' : ''} ${cite}`,
      );
      if (x.note) line(`    ${x.note}`);
      if (x.why && x.applicability !== 'direct') line(`    applicability: ${x.why}`);
      const passage = x.passage ?? ('cite' in x.ref ? read(x.ref.cite) : null);
      if (passage)
        line(
          `    | ${passage
            .trim()
            .split('\n')
            .slice(0, 6)
            .join('\n' + indent + '    | ')}`,
        );
    }
}
function printStory(s: Story, rank: number) {
  console.log(
    `#${rank} ${s.title}  [${s.readiness}]  overall ${s.scores.overall} (editorial ${s.scores.editorial}, evidence ${s.scores.evidence})`,
  );
  console.log(`id: ${s.id} (${s.kind}${s.reviewed ? ', reviewed' : ', unreviewed'})`);
  console.log(`question: ${s.question}`);
  console.log(`alternates: ${s.alternates.join(' | ')}`);
  console.log(`why watch: ${s.whyWatch}\ntension: ${s.tension}\npremise: ${s.premise}`);
  console.log(`coherence: ${s.coherence.score} (${s.coherence.basis}) ${s.coherence.explanation}`);
  console.log(`ranking: ${s.scores.explanation}`);
  console.log(`readiness: ${s.readinessWhy}`);
  for (const b of s.blocking) console.log(`blocking: ${b}`);
  console.log(`evidence needed: ${s.evidenceNeeded}`);
  for (const e of s.evidenceAvailable) console.log(`evidence available: ${e}`);
  for (const g of s.gaps) console.log(`gap: ${g}`);
  console.log(
    `claims: ${s.claims.join(', ')}${s.related.length ? `\nrelated (left out): ${s.related.join(', ')}` : ''}`,
  );
  for (const [k, v] of Object.entries(s.arc)) console.log(`arc.${k}: ${v}`);
  console.log('central conclusion:');
  printValidation(s.audit.central);
  console.log('key findings:');
  s.audit.findings.forEach((f) => {
    console.log(`  (${f.role})`);
    printValidation(f.validation);
  });
}

switch (cmd) {
  case 'discover': {
    const file = discover(loadTopic(topic), read, loadReview(topic));
    const out = toJson(file);
    writeFileSync(storiesPath(topic), out);
    if (json) console.log(out);
    else {
      list(file.stories);
      const reviewed = file.stories.filter((s) => s.reviewed).length;
      console.log(
        `\nwrote ${storiesPath(topic)}: ${file.stories.length} stories (${reviewed} reviewed) from ${file.basis.candidates} candidates, ${file.rejected.length} rejected; ${file.basis.claims} claims, ${file.basis.studies} studies`,
      );
      for (const r of file.rejected) console.log(`  rejected ${r.id}: ${r.reason}`);
    }
    break;
  }
  case 'show': {
    const file = loadStories(topic);
    if (!file) throw new Error(`no ${storiesPath(topic)}; run discover first`);
    const id = args[0];
    if (json) console.log(JSON.stringify(id ? file.stories.find((s) => s.id === id) : file, null, 1));
    else if (id) {
      const i = file.stories.findIndex((s) => s.id === id);
      if (i < 0) throw new Error(`no story ${id}`);
      printStory(file.stories[i], i + 1);
    } else list(file.stories);
    break;
  }
  case 'validate': {
    if (!args[0]) usage();
    const topicData = loadTopic(topic);
    const assertions = JSON.parse(readFileSync(args[0], 'utf8')) as Assertion[];
    const results = assertions.map((a) => validate(a, topicData, read, loadReview(topic).applicability));
    if (json) console.log(JSON.stringify(results, null, 1));
    else results.forEach((v) => printValidation(v, ''));
    const blocked = results.filter((r) => r.decision === 'blocked').length;
    console.error(`${results.length} assertions: ${results.length - blocked} usable, ${blocked} blocked`);
    process.exitCode = blocked ? 2 : 0;
    break;
  }
  default:
    usage();
}
