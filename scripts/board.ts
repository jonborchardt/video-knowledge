// npm run board -- next <topic> <story-id> [--json]
//   next <topic> <story-id> [--json]   the board's stage and next step for one story (src/lib/production.ts, boardNext);
//                                      with --json the whole answer (stage, next, steps, halt, done), else "<stage>: <next>"
import { readFileSync } from 'node:fs';
import { toJson } from '../src/shared/io';
import { boardNext } from '../src/lib/production';

const [cmd, topic, storyId, ...rest] = process.argv.slice(2);
if (cmd !== 'next' || !topic || !storyId) {
  console.error(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 3)
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'),
  );
  process.exit(1);
}
const n = boardNext(topic, storyId);
process.stdout.write(rest.includes('--json') ? toJson(n) : `${n.stage}: ${n.next}\n`);
