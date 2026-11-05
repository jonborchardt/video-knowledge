// A consumer of an unattended answer, as a session or a script would be written: one run, idempotent. It reads the
// unseen answers about one work item, does its one harmless action only if the action's own record is absent (the
// record is keyed by the question id), acknowledges with a note, and reports one-way. VK_TEST_CRASH_AFTER=action
// kills it between the action and the acknowledgment, the way an interrupted session would die.
// argv: <root> <about>
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from '../../../shared/cli';

const [root, about] = process.argv.slice(2);
const mail = (args: string[]) => {
  const r = runCli('mail', args, { cwd: root, env: process.env });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(r.status ?? 1);
  }
  return r.stdout;
};
const listed = JSON.parse(mail(['questions', '--fetch', '--unseen', '--about', about, '--json'])) as {
  questions: { id: string; answers: { text: string }[] }[];
};
const q = listed.questions[0];
if (!q) {
  console.log('NOTHING');
  process.exit(0);
}
const action = join(root, `action-${q.id}.txt`);
if (!existsSync(action)) writeFileSync(action, q.answers[0].text);
if (process.env.VK_TEST_CRASH_AFTER === 'action') process.exit(137);
mail(['questions', '--ack', q.id, '--note', `wrote action-${q.id}.txt`]);
mail(['report', `done ${q.id}`, '--text', `Did as answered: ${q.answers[0].text}`, '--about', about]);
console.log(`DONE ${q.id}`);
