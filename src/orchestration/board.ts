// npm run board -- next <topic> <story-id> [--json] | topic <topic> [--json]
//   next <topic> <story-id> [--json]   the board's stage and next step for one story (src/orchestration/production.ts, boardNext);
//                                      with --json the whole answer (stage, next, steps, halt, done), else "<stage>: <next>"
//   topic <topic> [--json]             the research stage and next step for one topic (src/orchestration/research.ts, topicNext)
import { readFileSync } from 'node:fs';
import { toJson } from '../shared/io';
import { boardNext, topicNext } from './index';

const [cmd, topic, storyId, ...rest] = process.argv.slice(2);
if (cmd === 'topic' && topic) {
  const t = topicNext(topic);
  process.stdout.write(
    [...(storyId ? [storyId] : []), ...rest].includes('--json') ? toJson(t) : `${t.stage}: ${t.next}\n`,
  );
  process.exit(0);
}
if (cmd !== 'next' || !topic || !storyId) {
  console.error(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 4)
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'),
  );
  process.exit(1);
}
const n = boardNext(topic, storyId);
process.stdout.write(rest.includes('--json') ? toJson(n) : `${n.stage}: ${n.next}\n`);
