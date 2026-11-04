// The draft and release request mails (phase 2 Task 6, spec §7.2, §7.3): what they say, that the person reads no
// internal id outside the footer, and that each is sent once through the outbox.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { MANIFEST_FILE, REVIEW_DIR, readJson, toJson } from '../../src/shared/io';
import { FakeMailer } from './fake-mailer';
import type { ReleaseManifest } from '../../src/shared/types';
import { writeManifest } from '../../src/modules/packaging/manifest';
import {
  addOutputTo,
  loadLedger,
  openRequest,
  recordRequested,
  recordUploaded,
  recordVerified,
} from '../../src/modules/publishing/publish';
import { readOutbox } from '../../src/orchestration/run/notify';
import {
  bodyOf,
  draftRequests,
  draftView,
  renderDraftRequest,
  renderReleaseRequest,
  sendCorrectionRequest,
  sendDraftRequest,
  sendReleaseRequest,
} from '../../src/orchestration/run/requests';
import { ARTICLE_FILES, type ArticleRelease, type ArticleRequest, loadArticleRequest } from '../../src/modules/article';
import { runCli } from '../../src/shared/cli';
import { type Fixture, cliRoot, syntheticProduction } from '../production-helpers';

const fixtures: Fixture[] = [];
afterAll(() => fixtures.forEach((f) => f.cleanup()), 120_000); // many temp roots: slow under full-suite load
const a = {
  ...DEFAULTS,
  approvals: { ...DEFAULTS.approvals, to: 'jon@example.test', from: 'automation@example.test', approverName: 'Jon' },
  notifications: { to: 'jon@example.test', digest: { weekday: 'monday', hour: 8 } },
};
const SECRET = 'a-test-secret-of-some-length';
const now = new Date('2026-10-30T12:00:00Z');

/** A release fixture with one packaged Short, a paid link, everything uploaded and verified, and the request written. */
function requested() {
  const f = syntheticProduction('packaged', { release: true });
  fixtures.push(f);
  cliRoot(f.root);
  const dir = join(f.dir, 'shorts', 'one', 'video', REVIEW_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'review.json'),
    toJson({
      generatedAt: 'd',
      status: 'release build',
      buildReport: 'br',
      mp4: 's.mp4',
      mp4Sha: 'shortsha',
      thumbnailSha: null,
      captionsSha: null,
      seconds: 7.5,
      title: 'Short one',
      chapters: [],
      short: { parent: f.story, slug: 'one', format: 'ONE FIGURE FROM THE RECORD', fullVideo: null },
    }),
  );
  writeFileSync(join(dir, 'description.txt'), 'Short one\n');
  addOutputTo(f.topic, f.story, 'short:one', 'youtube-short', {
    derivedFrom: 'youtube',
    source: relative(f.root, join(f.dir, 'shorts', 'one')).replaceAll('\\', '/'),
    root: f.root,
  });
  writeFileSync(
    join(f.dir, 'cta.json'),
    toJson({
      primary: { type: 'inquiry', target: 'heat-pumps', text: 'The full record' },
      secondary: [
        {
          type: 'commercial',
          url: 'https://example.com/pump',
          text: 'A pump we are paid for',
          disclosure: 'Paid placement',
        },
      ],
    }),
  );
  writeFileSync(join(f.dir, 'video', REVIEW_DIR, 'thumbnail.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  writeManifest(f.topic, f.story, f.root, { x: '@CORSpending' });
  const manifest = readJson<ReleaseManifest>(join(f.dir, 'video', REVIEW_DIR, MANIFEST_FILE))!;
  const base = { root: f.root, by: 'automation', now };
  ['youtube', 'short:one'].forEach((output, i) => {
    recordUploaded(f.topic, f.story, { ...base, output, id: `vid0000000${i}`, visibility: 'private' });
    recordVerified(f.topic, f.story, {
      ...base,
      output,
      result: 'passed',
      checks: [{ name: 'title', result: 'pass' }],
    });
  });
  recordRequested(f.topic, f.story, { ...base, manifest, secret: SECRET, expiresDays: 7, channel: 'email' });
  const req = openRequest(loadLedger(f.topic, f.story, f.root)!, manifest.releaseSha, now)!;
  return { f, manifest, req };
}

describe('the release request mail', () => {
  it('names every output, the article, the institution, the URLs, the paid link numbered and pending, the X post; no id outside the footer', () => {
    const { manifest, req } = requested();
    const m = renderReleaseRequest(manifest, req, a, {
      thumbnail: Buffer.from('png'),
      urls: { youtube: 'https://youtu.be/vid00000000', 'short:one': 'https://youtu.be/vid00000001' },
    });
    expect(m.subject).toBe(`[CoR release] ${manifest.outputs.youtube.title} (${req.request})`);
    expect(m.to).toBe('jon@example.test');
    const body = bodyOf(m.text);
    expect(body).toContain('This is the whole publication');
    expect(body).toContain('1. Video: ');
    expect(body).toContain('2. Short: Short one');
    expect(body).toContain('https://youtu.be/vid00000001');
    expect(body).toContain(manifest.article!.headline);
    expect(body).toContain(`by the spending commission`);
    expect(body).toContain(manifest.site.matterUrl);
    expect(body).toContain(
      'Paid link 1: A pump we are paid for -> https://example.com/pump, disclosure: Paid placement',
    );
    expect(body).toContain('PENDING: reply PAID OK');
    expect(body).toContain('@CORSpending will post:');
    expect(body).toContain('Reply with one of these as the first line:');
    expect(body).toContain('Replying OK confirms every item above');
    const listed = renderReleaseRequest(manifest, req, a, {
      checklist: ['Opening: does it land?', 'Narration: clear?'],
    });
    expect(bodyOf(listed.text)).toContain('1. Opening: does it land?');
    expect(bodyOf(listed.text)).toContain('2. Narration: clear?');
    expect(body).not.toMatch(/rq-[0-9a-f]{12}/); // review focus 6: the id lives in the subject and the footer
    expect(m.text).toContain(`Request ${req.request}`);
    expect(m.attachments).toEqual([{ name: 'thumbnail.png', contentType: 'image/png', data: Buffer.from('png') }]);
    const fx = renderReleaseRequest(
      { ...manifest, fixtureRun: '20261101-0307-8ee4', distribution: { x: null } },
      req,
      a,
    );
    expect(bodyOf(fx.text)).toContain('unlisted at most, never public');
    expect(bodyOf(fx.text)).toContain('No social post');
  });

  it('is sent once per request through the outbox with the thumbnail, and its Message-ID is recorded on the ledger', async () => {
    const { f, manifest, req } = requested();
    const mail = new FakeMailer(f.root);
    const id = await sendReleaseRequest(f.topic, f.story, manifest, a, mail, {
      root: f.root,
      now: () => now.getTime(),
      env: { ...process.env, VK_NO_DOTENV: '1' },
    });
    expect(id).toMatch(/^<.+@/);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].attachments?.[0].name).toBe('thumbnail.png');
    expect(mail.sent[0].text).toContain('https://youtu.be/vid00000000');
    expect(readOutbox(f.root)[0]).toMatchObject({
      kind: 'release-request',
      meta: { request: req.request, topic: f.topic, storyId: f.story },
    });
    const ev = loadLedger(f.topic, f.story, f.root)!.outputs.youtube.events;
    expect(ev.find((e) => e.type === 'message-sent')).toMatchObject({ request: req.request, messageId: id });
    expect(openRequest(loadLedger(f.topic, f.story, f.root)!, undefined, now)?.messageId).toBe(id);
    // a second send for the same request is a no-op
    expect(
      await sendReleaseRequest(f.topic, f.story, manifest, a, mail, { root: f.root, now: () => now.getTime() }),
    ).toBeNull();
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].text).toContain('1. '); // the checklist is listed, numbered
  }, 120_000);

  it('a crash between the send and the ledger record is completed from the outbox, not re-sent (review finding 8)', async () => {
    const { f, manifest, req } = requested();
    const mail = new FakeMailer(f.root);
    mail.failNext = 'after'; // delivered, then the crash before any record
    await expect(
      sendReleaseRequest(f.topic, f.story, manifest, a, mail, {
        root: f.root,
        now: () => now.getTime(),
        env: { ...process.env, VK_NO_DOTENV: '1' },
      }),
    ).rejects.toThrow(/after/);
    expect(mail.sent).toHaveLength(1);
    const ev = loadLedger(f.topic, f.story, f.root)!.outputs.youtube.events;
    expect(ev.some((e) => e.type === 'message-sent')).toBe(false);
    const id = await sendReleaseRequest(f.topic, f.story, manifest, a, mail, {
      root: f.root,
      now: () => now.getTime(),
      env: { ...process.env, VK_NO_DOTENV: '1' },
    });
    expect(id).toBe(mail.sent[0].messageId); // the record, from the outbox entry
    expect(mail.sent).toHaveLength(1);
    expect(openRequest(loadLedger(f.topic, f.story, f.root)!, undefined, now)?.messageId).toBe(id);
    expect(req.request).toBe(readOutbox(f.root)[0].meta?.request);
  }, 120_000);
});

describe('the draft request mail', () => {
  it('carries the link, the checklist, the findings at their moment and, under shadow, the agent notes', () => {
    const f = syntheticProduction('packaged');
    fixtures.push(f);
    const rp = join(f.dir, 'video', REVIEW_DIR, 'review.json');
    writeFileSync(
      rp,
      toJson({ ...readJson<object>(rp)!, checklist: ['Opening: does it land?', 'Narration: intelligible?'] }),
    );
    const v = draftView(f.topic, f.story, 'https://youtu.be/draft000001', f.root);
    expect(v.checklist).toHaveLength(2);
    const m = renderDraftRequest(
      f.topic,
      f.story,
      { ...v, shadowNotes: [{ n: 1, text: 'the figure is wrong', seconds: 31, scene: 'sc4' }] },
      a,
      [],
    );
    expect(m.subject).toBe(`[CoR draft] ${v.title}`);
    expect(m.text).toContain('https://youtu.be/draft000001');
    expect(m.text).toContain('1. Opening: does it land?');
    expect(m.text).toContain('1. [0:31 sc4] the figure is wrong');
    expect(m.text).toContain('NOTES: 1 agree, 2 disagree');
    expect(m.text).toContain('Reply OK to accept the draft');
    expect(m.text).toContain('CHANGES:');
    expect(renderDraftRequest(f.topic, f.story, v, a, []).text).not.toContain("reviewing agent's notes");
  });

  it("a Short's draft mail names the Short, not its parent (review finding 3)", async () => {
    const f = syntheticProduction('packaged', { release: true });
    fixtures.push(f);
    cliRoot(f.root);
    const dir = join(f.dir, 'shorts', 'one', 'video', REVIEW_DIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'review.json'),
      toJson({
        generatedAt: 'd',
        status: 'private review build',
        buildReport: 'br',
        mp4: 's.mp4',
        mp4Sha: 'shortdraft',
        thumbnailSha: null,
        captionsSha: null,
        seconds: 7.5,
        title: 'Short one',
        chapters: [],
        checklist: ['Short: readable at phone size?'],
        short: { parent: f.story, slug: 'one', format: 'ONE FIGURE FROM THE RECORD', fullVideo: null },
      }),
    );
    writeFileSync(join(dir, 'description.txt'), 'Short one\n');
    addOutputTo(f.topic, f.story, 'short:one', 'youtube-short', {
      derivedFrom: 'youtube',
      source: relative(f.root, join(f.dir, 'shorts', 'one')).replaceAll('\\', '/'),
      root: f.root,
    });
    recordUploaded(f.topic, f.story, {
      root: f.root,
      by: 'x',
      now,
      output: 'short:one',
      id: 'shortdraft1',
      visibility: 'private',
    });
    const mail = new FakeMailer(f.root);
    const shortStory = `${f.story}/shorts/one`;
    const id = await sendDraftRequest(
      f.topic,
      shortStory,
      'shortdraft',
      'https://youtu.be/shortdraft1',
      null,
      a,
      mail,
      { root: f.root, now: () => now.getTime() },
    );
    expect(id).toBeTruthy();
    expect(mail.sent[0].subject).toBe('[CoR draft] Short one');
    expect(mail.sent[0].text).toContain('https://youtu.be/shortdraft1');
    expect(mail.sent[0].text).toContain(shortStory);
    expect(mail.sent[0].text).toContain('1. Short: readable at phone size?');
    expect(draftRequests(f.topic, shortStory, f.root)).toHaveProperty('shortdraft');
    expect(draftRequests(f.topic, f.story, f.root)).toEqual({});
  });

  it('is sent once per draft build through the outbox', async () => {
    const f = syntheticProduction('packaged');
    fixtures.push(f);
    cliRoot(f.root);
    recordUploaded(f.topic, f.story, { root: f.root, by: 'x', now, id: 'draft000001', visibility: 'private' });
    const mail = new FakeMailer(f.root);
    const id = await sendDraftRequest(f.topic, f.story, 'draftsha', 'https://youtu.be/draft000001', null, a, mail, {
      root: f.root,
      now: () => now.getTime(),
    });
    expect(id).toMatch(/^<.+@/);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].text).toContain('https://youtu.be/draft000001');
    expect(draftRequests(f.topic, f.story, f.root)).toEqual({ draftsha: { messageId: id, at: now.toISOString() } });
    expect(
      await sendDraftRequest(f.topic, f.story, 'draftsha', 'https://youtu.be/draft000001', null, a, mail, {
        root: f.root,
        now: () => now.getTime(),
      }),
    ).toBeNull();
    expect(mail.sent).toHaveLength(1);
    expect(readOutbox(f.root)[0]).toMatchObject({ kind: 'draft-request', meta: { topic: f.topic, storyId: f.story } });
  });
});

describe('the correction request mail (M3 1.3: ownership of the sent record)', () => {
  /** A released article with an open correction request written by the module's verb. */
  function corrected() {
    const f = syntheticProduction('packaged', { release: true });
    fixtures.push(f);
    cliRoot(f.root);
    const env = { ...process.env, VK_NO_DOTENV: '1', APPROVAL_SECRET: SECRET };
    const release = readJson<ArticleRelease>(join(f.dir, ARTICLE_FILES.release))!;
    writeFileSync(join(f.dir, ARTICLE_FILES.article), toJson(release.article));
    writeFileSync(join(f.dir, ARTICLE_FILES.review), toJson({ packageFingerprint: 'x', approved: {}, findings: [] }));
    writeFileSync(
      join(f.dir, ARTICLE_FILES.validation),
      toJson({ status: 'passed', sentences: [], issues: [], counts: {} }),
    );
    const r = runCli('article', ['request-correction', f.topic, f.story, '--by', 'automated: maintenance t1'], {
      cwd: f.root,
      env,
    });
    expect(r.status, r.stderr).toBe(0);
    const req = loadArticleRequest(f.topic, f.story, f.root)!;
    const calls: string[][] = [];
    // the module's verb, run for real, with every call recorded: the orchestration must never write the file itself
    const run = (cli: string, args: string[]) => {
      calls.push([cli, ...args]);
      return runCli(cli, args, { cwd: f.root, env });
    };
    return { f, req, env, calls, run };
  }
  it('is sent once and its Message-ID is recorded through `article sent`, never by writing the request file', async () => {
    const { f, req, env, calls, run } = corrected();
    const mail = new FakeMailer(f.root);
    const id = await sendCorrectionRequest(f.topic, f.story, req, a, mail, {
      root: f.root,
      now: () => now.getTime(),
      env,
      run,
    });
    expect(mail.sent).toHaveLength(1);
    expect(id).toBe(mail.sent[0].messageId);
    expect(calls).toEqual([['article', 'sent', f.topic, f.story, '--request', req.request, '--message-id', id]]);
    expect(loadArticleRequest(f.topic, f.story, f.root)!.messageId).toBe(id);
    // again: nothing sent, nothing run
    const again = await sendCorrectionRequest(
      f.topic,
      f.story,
      loadArticleRequest(f.topic, f.story, f.root)!,
      a,
      mail,
      {
        root: f.root,
        now: () => now.getTime(),
        env,
        run,
      },
    );
    expect(again).toBeNull();
    expect(mail.sent).toHaveLength(1);
    expect(calls).toHaveLength(1);
  }, 120_000);
  it('a crash between the send and the verb is completed from the outbox: the same Message-ID recorded, no second mail', async () => {
    const { f, req, env, calls, run } = corrected();
    const mail = new FakeMailer(f.root);
    mail.failNext = 'after';
    await expect(
      sendCorrectionRequest(f.topic, f.story, req, a, mail, { root: f.root, now: () => now.getTime(), env, run }),
    ).rejects.toThrow(/after/);
    expect(mail.sent).toHaveLength(1);
    expect(loadArticleRequest(f.topic, f.story, f.root)!.messageId).toBeUndefined();
    expect(calls).toEqual([]);
    const id = await sendCorrectionRequest(f.topic, f.story, req, a, mail, {
      root: f.root,
      now: () => now.getTime(),
      env,
      run,
    });
    expect(id).toBe(mail.sent[0].messageId);
    expect(mail.sent).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(loadArticleRequest(f.topic, f.story, f.root)!.messageId).toBe(id);
    expect(readOutbox(f.root).find((e) => e.meta?.request === req.request)?.kind).toBe('correction-request');
    const file = readJson<ArticleRequest>(join(f.dir, ARTICLE_FILES.request))!;
    expect(file.messageId).toBe(id);
  }, 120_000);
});
