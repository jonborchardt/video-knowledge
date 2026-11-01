// The publishing verbs in process, as the CLI would run them, for the tick tests: the same functions the CLI calls,
// the same exit codes (a Refusal is 2, an error 1), over the fake YouTube client; the website's and packaging's
// children (`links -- cta approve`, `video package`, `social post`) are recorded as commands and answered 0. A
// requested release group (a video and one Short uploaded private, verified, requested) is the shared stage.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { MANIFEST_FILE, REVIEW_DIR, readJson, sha, toJson } from '../../src/shared/io';
import { FakeMail } from '../../src/shared/mail';
import { Refusal } from '../../src/shared/refusal';
import type { ReleaseManifest } from '../../src/shared/types';
import { writeManifest } from '../../src/modules/packaging/manifest';
import { type DecideVerdict, decide } from '../../src/modules/publishing/decide';
import {
  emptyFakeState,
  fakeAnonymous,
  fakeYoutubeClient,
  readFakeState,
  writeFakeState,
} from '../../src/modules/publishing/fake-youtube';
import {
  type PublishEvent,
  type ReviewNote,
  addOutputTo,
  loadLedger,
  openOutput,
  openRequest,
  recordChangesRequested,
  recordMessageSent,
  recordRequested,
  recordUploaded,
  recordVerified,
  videoDirOf,
} from '../../src/modules/publishing/publish';
import { goLive, push, sync, verify } from '../../src/modules/publishing/uploader';
import { sendTracked } from '../../src/orchestration/run/notify';
import { site } from '../../src/config/site';
import { post as postOnX, textFor } from '../../src/modules/social/social';
import type { XClient } from '../../src/modules/social/x';
import { type Fixture, cliRoot, syntheticProduction } from '../production-helpers';

export const SECRET = 'a-test-secret-of-some-length';
export type Result = { status: number | null; stdout: string; stderr: string };
/** What the tick's steps take: a child CLI run, awaited (the real one wraps a synchronous spawn). */
export type Run = (cli: string, args: string[]) => Promise<Result>;

export interface Stage {
  f: Fixture;
  fake: string;
  manifest: ReleaseManifest;
  request: string;
  run: Run;
  ran: string[][]; // every child the dispatcher answered without running (links, video, social)
  events: (output?: string) => PublishEvent[];
  calls: (method: string) => { method: string; args: unknown[] }[];
  publicUpdates: (id?: string) => { method: string; args: unknown[] }[];
  manifestOf: () => ReleaseManifest | null;
  /** The dispatcher's clock: a test moves it before a verb that reads the time. */
  clock: { now: Date };
}

/** A requested release group over the fake client at `now`. */
export function stagedRelease(
  now: Date,
  opts: { shorts?: string[]; expiresDays?: number; x?: { client: XClient; handle: string } | null } = {},
): Stage {
  const f = syntheticProduction('packaged', { release: true });
  cliRoot(f.root);
  const review = join(f.dir, 'video', REVIEW_DIR);
  const bytes = Buffer.alloc(1024, 3);
  writeFileSync(join(review, 'fixture.mp4'), bytes);
  writeFileSync(join(review, 'thumbnail.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const rp = join(review, 'review.json');
  writeFileSync(rp, toJson({ ...readJson<object>(rp)!, mp4Sha: sha(bytes) }));
  for (const slug of opts.shorts ?? ['one']) {
    const dir = join(f.dir, 'shorts', slug, 'video', REVIEW_DIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'review.json'),
      toJson({
        generatedAt: '2026-01-01',
        status: 'release build',
        buildReport: `br-${slug}`,
        mp4: `short-${slug}.mp4`,
        mp4Sha: `short${slug}sha`,
        thumbnailSha: null,
        captionsSha: null,
        seconds: 7.5,
        title: `Short ${slug}`,
        chapters: [],
        short: { parent: f.story, slug, format: 'ONE FIGURE FROM THE RECORD', fullVideo: null },
      }),
    );
    writeFileSync(join(dir, 'description.txt'), `Short ${slug}\n`);
    addOutputTo(f.topic, f.story, `short:${slug}`, 'youtube-short', {
      derivedFrom: 'youtube',
      source: relative(f.root, join(f.dir, 'shorts', slug)).replaceAll('\\', '/'),
      root: f.root,
    });
  }
  writeManifest(f.topic, f.story, f.root);
  const manifestOf = () => readJson<ReleaseManifest>(join(review, MANIFEST_FILE));
  const fake = join(f.root, 'youtube-fake.json');
  writeFakeState(fake, emptyFakeState());
  const base = { root: f.root, by: 'automation', now };
  const m = manifestOf()!;
  Object.keys(m.outputs).forEach((id, i) => {
    const vid = `vid0000000${i}`;
    const s = readFakeState(fake);
    s.videos[vid] = {
      snippet: {
        title: m.outputs[id].title,
        description: m.outputs[id].description,
        tags: [],
        categoryId: '27',
        defaultLanguage: 'en',
      },
      status: { privacyStatus: 'private' },
      privacyStatus: 'private',
      publishAt: null,
      uploadStatus: 'processed',
      processingStatus: 'succeeded',
      captions: [{ id: 'cap-1', language: 'en', trackKind: 'standard', status: 'serving' }],
      thumbnail: true,
      fileSize: 1024,
      gets: 0,
    };
    writeFakeState(fake, s);
    recordUploaded(f.topic, f.story, { ...base, output: id, id: vid, visibility: 'private' });
    recordVerified(f.topic, f.story, {
      ...base,
      output: id,
      result: 'passed',
      checks: [{ name: 'title', result: 'pass' }],
    });
  });
  recordRequested(f.topic, f.story, {
    ...base,
    manifest: m,
    secret: SECRET,
    expiresDays: opts.expiresDays ?? 7,
    channel: 'email',
  });
  const request = openRequest(loadLedger(f.topic, f.story, f.root)!, m.releaseSha, now)!.request;
  const ran: string[][] = [];
  const clock = { now };
  const run = fakePublishCli(f, fake, manifestOf, ran, { now: () => clock.now, x: opts.x ?? null });
  const events = (output = 'youtube') => loadLedger(f.topic, f.story, f.root)!.outputs[output].events;
  const calls = (method: string) => readFakeState(fake).calls.filter((c) => c.method === method);
  const publicUpdates = (id?: string) =>
    calls('updateVideo').filter(
      (c) =>
        (c.args[1] as { status?: { privacyStatus?: string } }).status?.privacyStatus === 'public' &&
        (!id || c.args[0] === id),
    );
  return { f, fake, manifest: m, request, run, ran, events, calls, publicUpdates, manifestOf, clock };
}

/** The release request mail as the release loop sends it: through the outbox, the Message-ID on the ledger. */
export async function sentRequest(s: Stage, mail: FakeMail, now: () => number, request = s.request): Promise<string> {
  const { messageId } = await sendTracked(
    mail,
    {
      from: 'automation@example.test',
      to: 'jon@example.test',
      subject: `[CoR release] ${s.manifest.outputs.youtube.title} (${request})`,
      text: `Request ${request}`,
    },
    'release-request',
    s.f.root,
    { request, topic: s.f.topic, storyId: s.f.story, now },
  );
  recordMessageSent(s.f.topic, s.f.story, {
    root: s.f.root,
    by: 'automation',
    request,
    messageId,
    now: new Date(now()),
  });
  return messageId;
}

/** The dispatcher: `publish <verb>` runs the verb in process; other CLIs are recorded and answered 0. */
export function fakePublishCli(
  f: Fixture,
  fake: string,
  manifestOf: () => ReleaseManifest | null,
  ran: string[][],
  opts: { now?: () => Date; scheduleLeadMinutes?: number; x?: { client: XClient; handle: string } | null } = {},
): Run {
  const client = fakeYoutubeClient(fake);
  const flag = (args: string[], name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const flags = (args: string[], name: string) =>
    args.flatMap((a, i) => (a === name && args[i + 1] !== undefined ? [args[i + 1]] : []));
  const via = (args: string[]) => {
    const v = flag(args, '--via');
    if (!v) return undefined;
    const [channel, ...rest] = v.split(':');
    const detail = rest.join(':');
    const key = channel === 'tick' ? 'request' : 'messageId';
    return { channel: channel as 'email' | 'tick', ...(detail && { [key]: detail }) };
  };
  const notes = (args: string[], timeFlag: string): ReviewNote[] => {
    const out: ReviewNote[] = [];
    for (let i = 0; i < args.length - 1; i++) {
      const [name, value] = [args[i], args[i + 1]];
      if (name === '--note') out.push({ text: value });
      else if (name === timeFlag && out.length) out[out.length - 1].seconds = Number(value);
      else if ((name === '--scene' || name === '--sentence') && out.length)
        out[out.length - 1][name === '--scene' ? 'scene' : 'sentence'] = value;
      else continue;
      i++;
    }
    return out;
  };
  const child = (cli: string, args: string[]): Result => {
    ran.push([cli, ...args]);
    return {
      status: 0,
      stdout: cli === 'social' && args[0] === 'post' ? 'not configured: no x handle\n' : '',
      stderr: '',
    };
  };
  // `social post` in process over an injected X when the stage names one (the CLI's answers), else not configured
  const social = async (args: string[]): Promise<Result> => {
    ran.push(['social', ...args]);
    if (!opts.x) return { status: 0, stdout: 'not configured: no x handle or keys\n', stderr: '' };
    const [, topic, storyId] = args;
    const i = args.indexOf('--output');
    const output = i >= 0 ? args[i + 1] : 'youtube';
    const t = textFor(topic, storyId, output, site.disclosure, f.root);
    if (!t) return { status: 2, stdout: '', stderr: `refused: ${output} is not live\n` };
    const r = await postOnX(topic, storyId, output, opts.x.handle, t, { client: opts.x.client }, f.root);
    return r.status === 'posted'
      ? { status: 0, stdout: `RESULT: POSTED ${r.url ?? ''}\n`, stderr: '' }
      : { status: 1, stdout: `RESULT: FAILED${r.retryable ? ' (retryable)' : ''}: ${r.error}\n`, stderr: '' };
  };
  const run: Run = async (cli, args) => {
    if (cli === 'social' && args[0] === 'post') return social(args);
    if (cli !== 'publish') return child(cli, args);
    const [verb, topic, story, ...rest] = args;
    const shortMatch = /^(.+)\/shorts\/([a-z0-9-]+)$/.exec(story);
    const storyId = shortMatch ? shortMatch[1] : story;
    const output = flag(rest, '--output') ?? (shortMatch ? `short:${shortMatch[2]}` : undefined);
    const ctx = {
      root: f.root,
      by: flag(rest, '--by') ?? 'automation',
      now: opts.now?.(),
      output,
      client,
      anonymous: fakeAnonymous(fake),
    };
    const done = (r: { message?: string } | unknown) => ({
      status: 0,
      stdout: (typeof r === 'object' && r && 'message' in r ? String((r as { message: string }).message) : '') + '\n',
      stderr: '',
    });
    const exec = async () => {
      switch (verb) {
        case 'decide':
          return done(
            await decide(
              topic,
              storyId,
              {
                request: flag(rest, '--request')!,
                by: flag(rest, '--by') ?? '',
                verdict: flag(rest, '--verdict') as DecideVerdict,
                at: flag(rest, '--at'),
                notes: notes(rest, '--at-seconds'),
                paid: flags(rest, '--paid'),
                via: { ...via(rest)!, channel: 'email' },
                root: f.root,
                now: opts.now?.(),
              },
              { client, run: child, manifestOf, scheduleLeadMinutes: opts.scheduleLeadMinutes ?? 30 },
            ),
          );
        case 'request-changes': {
          const o = openOutput(topic, storyId, { root: f.root, output });
          return done(
            recordChangesRequested(topic, storyId, {
              ...ctx,
              build: o.build?.sha ?? '',
              notes: notes(rest, '--at'),
              via: via(rest),
            }),
          );
        }
        case 'sync':
          return done(await sync(topic, storyId, ctx));
        case 'verify':
          return done((await verify(topic, storyId, ctx)).result);
        case 'push':
          return done(await push(topic, storyId, ctx));
        case 'go-live':
          return done(await goLive(topic, storyId, { ...ctx, at: flag(rest, '--at'), via: via(rest) }));
        case 'message-sent':
          return done(
            recordMessageSent(topic, storyId, {
              ...ctx,
              request: flag(rest, '--request')!,
              messageId: flag(rest, '--message-id')!,
            }),
          );
        case 'request': {
          const o = openOutput(topic, storyId, { root: f.root });
          const manifest = readJson<ReleaseManifest>(join(videoDirOf(o), REVIEW_DIR, MANIFEST_FILE));
          if (!manifest) throw new Refusal('no release manifest');
          return done(
            recordRequested(topic, storyId, {
              ...ctx,
              manifest,
              secret: SECRET,
              expiresDays: 7,
              channel: 'email',
              renew: rest.includes('--renew'),
            }),
          );
        }
        default:
          throw new Error(`fake publish cli: no verb ${verb}`);
      }
    };
    try {
      return await exec();
    } catch (e) {
      if (e instanceof Refusal) return { status: 2, stdout: '', stderr: `refused: ${e.message}\n` };
      return { status: 1, stdout: '', stderr: `${(e as Error).message}\n` };
    }
  };
  return run;
}

/** Makes a fixture root a git clone of a bare origin on `main` (git 2.15: the branch named by a checkout). */
export function gitOrigin(root: string): {
  bare: string;
  git: (...args: string[]) => string;
  originHead: () => string;
} {
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  writeFileSync(join(root, '.gitignore'), '.automation/\ntopics/*/scripts/*/run/\nyoutube-fake.json\nx-fake.json\n');
  git('init', '-q');
  git('checkout', '-q', '-b', 'main');
  git('config', 'core.autocrlf', 'false');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  git('add', '-A');
  git('commit', '-q', '-m', 'fixture');
  const bare = mkdtempSync(join(tmpdir(), 'vk-origin-'));
  execFileSync('git', ['init', '-q', '--bare', bare]);
  execFileSync('git', ['symbolic-ref', 'HEAD', 'refs/heads/main'], { cwd: bare });
  git('remote', 'add', 'origin', bare);
  git('push', '-q', '-u', 'origin', 'main');
  const originHead = () => execFileSync('git', ['rev-parse', 'main'], { cwd: bare, encoding: 'utf8' }).trim();
  return { bare, git, originHead };
}
