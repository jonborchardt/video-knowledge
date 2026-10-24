// npm run publish -- <verb> <topic> <story-id> [--output <id>] [flags]
//   show <topic> <story-id>                                   the build, every output's state and next step, the composed upload metadata, the event log
//   uploaded <topic> <story-id> --id <youtube id> [--url <u>] [--visibility private|unlisted|public] [--by <name>]
//                                                             record an upload of the packaged build (public needs a prior approve; it also records published)
//   approve <topic> <story-id> --by <name> [--note <text>]    approve the uploaded build, or the release build on disk (a draft is accepted by video final)
//   thumbnail <topic> <story-id> <file>                       use this PNG/JPEG (under the script directory, e.g. video/publish/) as the output's thumbnail
//   request-changes <topic> <story-id> --by <name> --note <text> [--note <text> ...]
//                                                             send the current build back; a note may start [m:ss sc20 s31]
//   scheduled <topic> <story-id> --at <ISO> [--by <name>]     the approved upload is scheduled on YouTube for that time
//   published <topic> <story-id> [--url <u>] [--by <name>]    the approved or scheduled upload is live
//   updated <topic> <story-id> --fields a,b [--by <name>]     title, description, tags or thumbnail were updated on YouTube to the current metadata
//   failed <topic> <story-id> --step <s> --error <text> [--retryable] [--by <name>]
//   unpublished | retracted <topic> <story-id> --note <text> [--by <name>]
//   add <topic> <story-id> <output-id> --kind <kind> [--from <output>] [--source <file>]
//                                                             a new output (youtube-video, youtube-short, blog-post, web-page, post, ...)
// Through the YouTube Data API (YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and YOUTUBE_REFRESH_TOKEN or .youtube-token.json; README, Publishing):
//   auth <topic> <story-id>                                   one-time consent in the browser; writes .youtube-token.json (gitignored)
//   upload <topic> <story-id> [--output <id>] [--by <name>]   upload the packaged build (or the output's source) PRIVATELY with its thumbnail and
//                                                             captions, and record it; resumes an interrupted upload, never uploads the same build twice
//   push <topic> <story-id> [--output <id>]                   send the composed title, description, tags, thumbnail and captions when they changed
//   go-live <topic> <story-id> [--at <ISO>] [--output <id>]   make the APPROVED upload public now, or schedule it (private until --at); records it
//   sync <topic> <story-id> [--output <id>]                   read the video back: records a scheduled video gone public, a rejection, a deletion
// Every verb is idempotent: a key already in the ledger prints the existing event and exits 0. A refusal prints one line and
// exits 2 without writing. --by defaults to $PUBLISH_BY, else git's user.name; approve needs it explicitly.
// The ledger is topics/<topic>/scripts/<slug>/publish.json (src/lib/publish.ts); events are written only here, metadata may
// be hand-edited.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, toJson } from '../src/lib/io';
import {
  Refusal,
  type VerbResult,
  type Visibility,
  addOutputTo,
  currentBuild,
  loadLedger,
  emptyLedger,
  outputStates,
  parentUrlOf,
  recordApproved,
  recordChangesRequested,
  openOutput,
  recordFailed,
  recordPublished,
  recordScheduled,
  recordSimple,
  recordUpdated,
  recordUploaded,
  setThumbnail,
  uploadMetadataOf,
} from '../src/lib/publish';
import { scriptDir, shortOf, storySlug } from '../src/lib/script';
import { goLive, push, sync, upload } from '../src/lib/uploader';
import { TOKEN_FILE, YouTubeError, authorize, loadCredentials, youtubeClient } from '../src/lib/youtube';

if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env')); // keys only; never committed

const [cmd, topic, rawStory, ...rest] = process.argv.slice(2);
// A Short (<story-id>/shorts/<slug>) is recorded in its parent's ledger as the output short:<slug>.
const shortArg = rawStory ? shortOf(rawStory) : null;
const storyId = shortArg ? shortArg.parent : rawStory;
const flag = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const has = (name: string) => rest.includes(name);
const VALUED = [
  '--output',
  '--id',
  '--url',
  '--visibility',
  '--by',
  '--note',
  '--at',
  '--fields',
  '--step',
  '--error',
  '--kind',
  '--from',
  '--source',
];
const positional = rest.filter((a, i) => !a.startsWith('--') && !VALUED.includes(rest[i - 1]));
const usage = () => {
  console.error(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 25)
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'),
  );
  process.exit(1);
};
if (!cmd || !topic || !storyId) usage();

const by = () => {
  const b = flag('--by') ?? process.env.PUBLISH_BY;
  if (b) return b;
  try {
    return execFileSync('git', ['config', 'user.name'], { encoding: 'utf8' }).trim();
  } catch {
    throw new Refusal('--by <name> is needed (or set PUBLISH_BY)');
  }
};
const need = (name: string) => {
  const v = flag(name);
  if (!v) throw new Refusal(`${cmd} needs ${name}`);
  return v;
};
const output = flag('--output') ?? (shortArg ? `short:${shortArg.slug}` : undefined);
const common = () => ({ output, by: by() });
const api = () => ({ ...common(), client: youtubeClient(loadCredentials()) });

function show() {
  const dir = scriptDir(topic, storyId);
  const ledger = loadLedger(topic, storyId) ?? emptyLedger(`${topic}/${storyId}`);
  const build = currentBuild(dir);
  const rel = (f: string) => `topics/${topic}/scripts/${storySlug(storyId)}/${f}`;
  const lines = [`build: ${build ? `${build.status} ${build.sha}` : 'none (no review package)'}`];
  const metas = Object.fromEntries(
    Object.entries(ledger.outputs).map(([id, o]) => [id, uploadMetadataOf(dir, rel, o, parentUrlOf(ledger, o))]),
  );
  const states = outputStates(ledger, build, (id) => metas[id]?.sha ?? null, { topic, story: storyId });
  for (const [id, out] of Object.entries(ledger.outputs)) {
    const meta = metas[id];
    const s = states[id];
    lines.push(
      '',
      `${id} (${out.kind}): ${s.status}${s.failed ? ' FAILED' : ''}${s.id ? ` ${s.url}` : ''}`,
      `  next: ${s.next}`,
    );
    if (meta) {
      lines.push(`  title: ${meta.title}`, `  file: ${meta.file}`, `  tags: ${meta.tags.join(', ') || '(none)'}`);
      lines.push(
        `  thumbnail: ${meta.thumbnail ? `${meta.thumbnail.file} (${meta.thumbnail.sha})` : 'none'}`,
        `  captions: ${meta.captions ? `${meta.captions.file} (${meta.captions.sha})` : 'none'}`,
        `  metadata sha: ${meta.sha}`,
      );
    }
    for (const e of out.events)
      lines.push(
        `  ${e.at} ${e.type}${e.id ? ` ${e.id}` : ''}${e.build ? ` build ${e.build}` : ''}${e.publishAt ? ` at ${e.publishAt}` : ''}${e.fields ? ` ${e.fields.join(',')}` : ''}${e.error ? ` ${e.step}: ${e.error}` : ''} by ${e.by}${e.note ? ` (${e.note})` : ''}`,
      );
  }
  console.log(lines.join('\n'));
}

async function main() {
  let r: VerbResult | null = null;
  switch (cmd) {
    case 'show':
      show();
      break;
    case 'uploaded':
      r = recordUploaded(topic, storyId, {
        ...common(),
        id: need('--id'),
        url: flag('--url'),
        visibility: flag('--visibility') as Visibility | undefined,
      });
      break;
    case 'approve':
      r = recordApproved(topic, storyId, { output, by: flag('--by') ?? '', note: flag('--note') });
      break;
    case 'request-changes': {
      const notes = rest.flatMap((x, i) => (rest[i - 1] === '--note' ? [{ text: x }] : []));
      const build = openOutput(topic, storyId, { output }).build?.sha ?? '';
      r = recordChangesRequested(topic, storyId, { output, by: flag('--by') ?? '', build, notes });
      break;
    }
    case 'thumbnail':
      console.log(`thumbnail sha ${setThumbnail(topic, storyId, { output, file: positional[0] ?? '' })}`);
      break;
    case 'scheduled':
      r = recordScheduled(topic, storyId, { ...common(), at: need('--at') });
      break;
    case 'published':
      r = recordPublished(topic, storyId, { ...common(), url: flag('--url') });
      break;
    case 'updated':
      r = recordUpdated(topic, storyId, { ...common(), fields: need('--fields').split(',') });
      break;
    case 'failed':
      r = recordFailed(topic, storyId, {
        ...common(),
        step: need('--step'),
        error: need('--error'),
        retryable: has('--retryable'),
      });
      break;
    case 'unpublished':
    case 'retracted':
      r = recordSimple(topic, storyId, cmd, { ...common(), note: need('--note') });
      break;
    case 'add':
      if (!positional[0]) throw new Refusal('add needs <output-id>');
      addOutputTo(topic, storyId, positional[0], need('--kind'), {
        derivedFrom: flag('--from'),
        source: flag('--source'),
      });
      console.log(`added ${positional[0]} (${flag('--kind')})`);
      break;
    case 'auth': {
      const creds = loadCredentials(ROOT, process.env, { requireToken: false });
      await authorize(creds, ROOT, (url) => {
        console.log(`Grant access in the browser (opening it now):\n${url}`);
        if (process.platform === 'win32') spawnSync('rundll32', ['url.dll,FileProtocolHandler', url]); // no shell parsing of &
      });
      console.log(`stored the refresh token in ${creds.store ?? TOKEN_FILE} (gitignored)`);
      break;
    }
    case 'upload': {
      const results = await upload(topic, storyId, api());
      for (const x of results) console.log(x.message);
      if (results.some((x) => x.event?.type === 'failed')) process.exitCode = 1;
      break;
    }
    case 'push':
      r = await push(topic, storyId, api());
      break;
    case 'go-live':
      r = await goLive(topic, storyId, { ...api(), at: flag('--at') });
      break;
    case 'sync': {
      const x = await sync(topic, storyId, api());
      if ('event' in x) r = x;
      else
        console.log(
          `${x.id}: ${x.privacyStatus}, upload ${x.uploadStatus}, processing ${x.processingStatus ?? 'n/a'}${x.publishAt ? `, publishAt ${x.publishAt}` : ''}`,
        );
      break;
    }
    default:
      usage();
  }
  if (r) console.log(r.message + (r.event && !r.existing ? `\n${toJson(r.event).trim()}` : ''));
}

main().catch((e: unknown) => {
  if (e instanceof Refusal) {
    console.error(`refused: ${e.message}`);
    process.exit(2);
  }
  if (e instanceof YouTubeError) {
    console.error(
      `YouTube ${e.reason} (${e.retryable ? 'retryable: run the verb again' : 'a person decides'}): ${e.message}; recorded in publish.json`,
    );
    process.exit(1);
  }
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
