// npm run social -- <command> <topic> <story-id> [--output <id>] [--dry-run]
//   show <topic> <story-id>                        every post recorded in social.json, per output
//   compose <topic> <story-id> [--output <id>]     the text a post would carry (the title, the watch URL, the disclosure) and its length
//   post <topic> <story-id> [--output <id>] [--dry-run]
//                                                  post about one live output from the institution's X account, once: refuses (exit 2)
//                                                  while automation.json enabled.social is off or the output is not live; prints
//                                                  "not configured" and exits 0 when the institution has no handle or keys
//                                                  (X_<KEY>_API_KEY, _API_SECRET, _ACCESS_TOKEN, _ACCESS_SECRET, _USER_ID in .env; the
//                                                  handle from src/config/site.ts or X_<KEY>_HANDLE); --dry-run prints and writes nothing;
//                                                  RESULT: POSTED <url> | FAILED (retryable) | FAILED, exit 1 on a failure
// X_FAKE=<state file> (tests only): a recording client over a JSON file instead of the network.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { site } from '../../config/site';
import { loadAutomation } from '../../shared/automation';
import { ROOT, loadDotEnv } from '../../shared/io';
import { Refusal } from '../../shared/refusal';
import { postLength } from '../../shared/social-text';
import { loadLedger } from '../publishing';
import { accountFor, loadSocial, post, postProblem, textFor } from './social';
import { type XClient, XError, xClient } from './x';

loadDotEnv();
const [cmd, topic, storyId, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const usage = () => {
  console.error(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 11)
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'),
  );
  process.exit(1);
};
if (!cmd || !topic || !storyId) usage();
const output = flag('--output') ?? 'youtube';

/** A fake X over a JSON file: `{ posts: [{ id, text }], fail?: { status, body } }`; tests plant it. */
function fakeClient(file: string): XClient {
  const read = () =>
    (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { posts: [] }) as {
      posts: { id: string; text: string }[];
      fail?: { status: number; body: string };
    };
  return {
    async post(text) {
      const s = read();
      if (s.fail)
        throw new XError(
          `X ${s.fail.status}: ${s.fail.body}`,
          s.fail.status,
          s.fail.status === 429 || s.fail.status >= 500,
          s.fail.status === 403 && /duplicate/i.test(s.fail.body),
        );
      const id = `fake${s.posts.length + 1}`;
      s.posts.push({ id, text });
      writeFileSync(file, JSON.stringify(s, null, 1));
      return { id, url: `https://x.com/i/status/${id}` };
    },
    async recent() {
      return read().posts.slice(-5).reverse();
    },
  };
}

async function main() {
  switch (cmd) {
    case 'show': {
      const f = loadSocial(topic, storyId);
      if (!f) {
        console.log('no posts (no social.json)');
        break;
      }
      for (const [id, o] of Object.entries(f.outputs))
        for (const p of o.posts)
          console.log(
            `${id}: ${p.status}${p.id ? ` ${p.url ?? p.id}` : ''} at ${p.at} by ${p.account}${p.error ? ` (${p.error})` : ''}`,
          );
      break;
    }
    case 'compose': {
      const t = textFor(topic, storyId, output, site.disclosure);
      if (!t) throw new Refusal(`${output} is not live: nothing to compose`);
      console.log(t.text);
      console.log(`(${postLength(t.text)} of 280 as X counts, sha ${t.textSha})`);
      break;
    }
    case 'post': {
      const a = loadAutomation(ROOT);
      if (!a.enabled.social) throw new Refusal('social is off: enabled.social in automation.json is false');
      const account = accountFor(topic);
      if (!account) {
        console.log(`not configured: ${topic}'s institution has no x handle or keys; nothing posted`);
        break;
      }
      const t = textFor(topic, storyId, output, site.disclosure);
      if (!t) throw new Refusal(`${output} is not live`);
      const problem = postProblem(
        loadLedger(topic, storyId),
        loadSocial(topic, storyId),
        output,
        t.textSha,
        topic,
        storyId,
      );
      if (problem && !/already posted/.test(problem)) throw new Refusal(problem);
      if (rest.includes('--dry-run')) {
        console.log(`dry run: ${account.handle} would post:\n${t.text}`);
        break;
      }
      const client = process.env.X_FAKE ? fakeClient(process.env.X_FAKE) : xClient(account.creds);
      const r = await post(topic, storyId, output, account.handle, t, { client });
      if (r.status === 'posted') {
        console.log(
          `RESULT: POSTED ${r.url ?? '(duplicate: the id follows from a read-back)'}${r.reconciled ? ' (found on the account)' : ''}`,
        );
        break;
      }
      console.log(`RESULT: FAILED${r.retryable ? ' (retryable)' : ''}: ${r.error}`);
      process.exit(1);
      break;
    }
    default:
      usage();
  }
}

main().catch((e) => {
  if (e instanceof Refusal) {
    console.error(`refused: ${e.message}`);
    process.exit(2);
  }
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
