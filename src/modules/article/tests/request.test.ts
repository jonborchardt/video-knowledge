// The correction request (register D10; phase 6 Task 4): bound to the exact article.json fingerprint, voided by a
// later revision, decided once; the verbs refuse without a release, a review, a passing validation or the secret,
// and `decide changes` records the person's notes for the writer.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runCli } from '../../../shared/cli';
import { readJson, toJson } from '../../../shared/io';
import type { Article, ArticleRelease } from '../article';
import { correctArticle } from '../article';
import { ARTICLE_FILES, articleFingerprint } from '../article';
import { type ArticleRequest, articleRequestPath, correctionProblem, markSent, requestCorrection } from '../request';
import { type Fixture, cliRoot, syntheticProduction } from '../../../../tests/production-helpers';

const fixtures: Fixture[] = [];
afterAll(() => fixtures.forEach((f) => f.cleanup()), 60_000);
const SECRET = 'a-test-secret-of-some-length';
const now = new Date('2026-12-01T12:00:00Z');

describe('requestCorrection and correctionProblem', () => {
  it('binds the fingerprint with an ar- id, reuses an open request for the same fingerprint, and refuses a decided, expired, wrong or moved one', () => {
    const r1 = requestCorrection(null, 'fp1', SECRET, 'automated: maintenance x', now, 7);
    expect(r1.existing).toBe(false);
    expect(r1.request.request).toMatch(/^ar-[0-9a-f]{12}$/);
    expect(r1.request.expiresAt).toBe('2026-12-08T12:00:00.000Z');
    expect(requestCorrection(r1.request, 'fp1', SECRET, 'x', now, 7)).toEqual({ request: r1.request, existing: true });
    const r2 = requestCorrection(r1.request, 'fp2', SECRET, 'x', now, 7);
    expect(r2.existing).toBe(false);
    expect(r2.request.request).not.toBe(r1.request.request);
    expect(correctionProblem(r1.request, r1.request.request, 'fp1', now)).toBeNull();
    expect(correctionProblem(null, r1.request.request, 'fp1', now)).toMatch(/no correction request/);
    expect(correctionProblem(r1.request, 'ar-000000000000', 'fp1', now)).toMatch(/the open request is/);
    expect(correctionProblem(r1.request, r1.request.request, 'fp2', now)).toMatch(/changed since/);
    expect(correctionProblem(r1.request, r1.request.request, 'fp1', new Date('2026-12-09T00:00:00Z'))).toMatch(
      /expired/,
    );
    const decided: ArticleRequest = { ...r1.request, decided: { verdict: 'ok', by: 'Jon', at: now.toISOString() } };
    expect(correctionProblem(decided, r1.request.request, 'fp1', now)).toMatch(/was decided \(ok\) by Jon/);
    expect(requestCorrection(decided, 'fp1', SECRET, 'x', now, 7).existing).toBe(false); // a decided one is spent
  });
});

describe("markSent and the `sent` verb (M3 1.3: the request file is the module's; the mail record goes through the verb)", () => {
  it('sets the Message-ID once; the same id again is a no-op; a different id, another request or no request is refused', () => {
    const r1 = requestCorrection(null, 'fp1', SECRET, 'automated: maintenance x', now, 7).request;
    const first = markSent(r1, r1.request, '<m1@x>');
    expect(first.changed).toBe(true);
    expect(first.request.messageId).toBe('<m1@x>');
    const again = markSent(first.request, r1.request, '<m1@x>');
    expect(again.changed).toBe(false);
    expect(again.request).toEqual(first.request);
    expect(() => markSent(first.request, r1.request, '<m2@x>')).toThrow(/already sent as <m1@x>/);
    expect(() => markSent(first.request, 'ar-000000000000', '<m1@x>')).toThrow(/the open request is/);
    expect(() => markSent(null, r1.request, '<m1@x>')).toThrow(/no correction request/);
  });
  it('the verb writes the id (exit 0), repeats idempotently (exit 0), and refuses a different id (exit 2, file unchanged)', () => {
    const f = syntheticProduction('packaged');
    fixtures.push(f);
    cliRoot(f.root);
    const env = { ...process.env, VK_NO_DOTENV: '1', APPROVAL_SECRET: SECRET };
    const article = (args: string[]) =>
      runCli('article', [args[0], f.topic, f.story, ...args.slice(1)], { cwd: f.root, env });
    const release = readJson<ArticleRelease>(join(f.dir, ARTICLE_FILES.release))!;
    writeFileSync(join(f.dir, ARTICLE_FILES.article), toJson(release.article));
    writeFileSync(join(f.dir, ARTICLE_FILES.review), toJson({ packageFingerprint: 'x', approved: {}, findings: [] }));
    writeFileSync(
      join(f.dir, ARTICLE_FILES.validation),
      toJson({ status: 'passed', sentences: [], issues: [], counts: {} }),
    );
    expect(article(['sent', '--request', 'ar-000000000000', '--message-id', '<m0@x>']).status).toBe(2); // no request yet
    expect(article(['request-correction', '--by', 'automated: maintenance t1']).status).toBe(0);
    const req = readJson<ArticleRequest>(articleRequestPath(f.topic, f.story, f.root))!;
    const ok = article(['sent', '--request', req.request, '--message-id', '<m1@x>']);
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toMatch(/sent/);
    expect(readJson<ArticleRequest>(articleRequestPath(f.topic, f.story, f.root))!.messageId).toBe('<m1@x>');
    const again = article(['sent', '--request', req.request, '--message-id', '<m1@x>']);
    expect(again.status).toBe(0);
    expect(again.stdout).toMatch(/already/);
    const other = article(['sent', '--request', req.request, '--message-id', '<m2@x>']);
    expect(other.status).toBe(2);
    expect(other.stderr).toMatch(/already sent as <m1@x>/);
    expect(readJson<ArticleRequest>(articleRequestPath(f.topic, f.story, f.root))!.messageId).toBe('<m1@x>');
    expect(article(['sent', '--request', req.request]).status).toBe(2); // no --message-id
  }, 120_000);
});

describe('a correction is released only under a person (register D10), enforced by the module', () => {
  it('correctArticle and `correct` refuse an automated actor; a person releases; decide carries the person', () => {
    const f = syntheticProduction('packaged');
    fixtures.push(f);
    cliRoot(f.root);
    const env = { ...process.env, VK_NO_DOTENV: '1', APPROVAL_SECRET: SECRET };
    const article = (args: string[]) =>
      runCli('article', [args[0], f.topic, f.story, ...args.slice(1)], { cwd: f.root, env });
    const release = readJson<ArticleRelease>(join(f.dir, ARTICLE_FILES.release))!;
    const edited: Article = {
      ...release.article,
      meta: { ...release.article.meta, headline: `${release.article.meta.headline} (corrected)` },
    };
    writeFileSync(join(f.dir, ARTICLE_FILES.article), toJson(edited));
    const v = { status: 'passed', sentences: [], issues: [], counts: {} } as unknown as Parameters<
      typeof correctArticle
    >[2];
    expect(() => correctArticle(release, edited, v, 'automated: maintenance m1', 'a note', '2026-12-01', {})).toThrow(
      /person/,
    );
    expect(() =>
      correctArticle(release, edited, v, 'automated: draft-review by x session y', 'n', '2026-12-01', {}),
    ).toThrow(/person/);
    const r = article(['correct', '--approved-by', 'automated: maintenance m1', '--note', 'the survey year']);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/person/);
    expect(readJson<ArticleRelease>(join(f.dir, ARTICLE_FILES.release))!.revision).toBe(release.revision);
  }, 120_000);
});

describe('decide ok after the correction already went out (a crash before the record; review finding 9)', () => {
  it('records the decision and releases nothing more when the released text is the requested text', () => {
    const f = syntheticProduction('packaged');
    fixtures.push(f);
    cliRoot(f.root);
    const env = { ...process.env, VK_NO_DOTENV: '1', APPROVAL_SECRET: SECRET };
    const article = (args: string[]) =>
      runCli('article', [args[0], f.topic, f.story, ...args.slice(1)], { cwd: f.root, env });
    const release = readJson<ArticleRelease>(join(f.dir, ARTICLE_FILES.release))!;
    writeFileSync(join(f.dir, ARTICLE_FILES.article), toJson(release.article)); // as released: the correction is out
    writeFileSync(join(f.dir, ARTICLE_FILES.review), toJson({ packageFingerprint: 'x', approved: {}, findings: [] }));
    writeFileSync(
      join(f.dir, ARTICLE_FILES.validation),
      toJson({ status: 'passed', sentences: [], issues: [], counts: {} }),
    );
    expect(article(['request-correction', '--by', 'automated: maintenance t1']).status).toBe(0);
    const req = readJson<ArticleRequest>(articleRequestPath(f.topic, f.story, f.root))!;
    const ok = article(['decide', '--request', req.request, '--verdict', 'ok', '--by', 'Jon', '--via', 'email:<m1@x>']);
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toMatch(/already released/);
    expect(readJson<ArticleRequest>(articleRequestPath(f.topic, f.story, f.root))!.decided).toMatchObject({
      verdict: 'ok',
      by: 'Jon',
    });
    expect(readJson<ArticleRelease>(join(f.dir, ARTICLE_FILES.release))!.revision).toBe(release.revision);
  }, 120_000);
});

describe('npm run article -- request-correction and decide', () => {
  it('refuses without a review or a passing validation; requests once for the fingerprint; decide changes records the notes; a changed text voids the request', () => {
    const f = syntheticProduction('packaged');
    fixtures.push(f);
    cliRoot(f.root);
    const env = { ...process.env, VK_NO_DOTENV: '1', APPROVAL_SECRET: SECRET };
    const article = (args: string[], extra: NodeJS.ProcessEnv = {}) =>
      runCli('article', [args[0], f.topic, f.story, ...args.slice(1)], { cwd: f.root, env: { ...env, ...extra } });
    const release = readJson<ArticleRelease>(join(f.dir, ARTICLE_FILES.release))!;
    // the article as released, on disk, with a review and a passing validation (the maintenance pass leaves these)
    writeFileSync(join(f.dir, ARTICLE_FILES.article), toJson(release.article));
    const noReview = article(['request-correction', '--by', 'automated: maintenance t1']);
    expect(noReview.status).toBe(2);
    expect(noReview.stderr).toMatch(/review/);
    writeFileSync(join(f.dir, ARTICLE_FILES.review), toJson({ packageFingerprint: 'x', approved: {}, findings: [] }));
    writeFileSync(
      join(f.dir, ARTICLE_FILES.validation),
      toJson({ status: 'blocked', sentences: [], issues: [], counts: {} }),
    );
    const blocked = article(['request-correction', '--by', 'automated: maintenance t1']);
    expect(blocked.status).toBe(2);
    expect(blocked.stderr).toMatch(/does not pass/);
    writeFileSync(
      join(f.dir, ARTICLE_FILES.validation),
      toJson({ status: 'passed', sentences: [], issues: [], counts: {} }),
    );
    const noSecret = article(['request-correction', '--by', 'automated: maintenance t1'], { APPROVAL_SECRET: '' });
    expect(noSecret.status).toBe(2);
    expect(noSecret.stderr).toMatch(/APPROVAL_SECRET/);
    const r = article(['request-correction', '--by', 'automated: maintenance t1']);
    expect(r.status, r.stderr).toBe(0);
    const req = readJson<ArticleRequest>(articleRequestPath(f.topic, f.story, f.root))!;
    expect(req.request).toMatch(/^ar-/);
    expect(req.fingerprint).toBe(articleFingerprint(release.article));
    expect(req.by).toBe('automated: maintenance t1');
    const again = article(['request-correction', '--by', 'automated: maintenance t2']);
    expect(again.status).toBe(0);
    expect(again.stdout).toMatch(/already requested/);
    expect(readJson<ArticleRequest>(articleRequestPath(f.topic, f.story, f.root))!.request).toBe(req.request);
    // decide: an automated actor is refused; a wrong id is refused; changes records the notes and the via
    const auto = article([
      'decide',
      '--request',
      req.request,
      '--verdict',
      'changes',
      '--by',
      'automated: x',
      '--note',
      'n',
    ]);
    expect(auto.status).toBe(2);
    const wrong = article(['decide', '--request', 'ar-000000000000', '--verdict', 'ok', '--by', 'Jon']);
    expect(wrong.status).toBe(2);
    expect(wrong.stderr).toMatch(/the open request is/);
    const ch = article([
      'decide',
      '--request',
      req.request,
      '--verdict',
      'changes',
      '--by',
      'Jon',
      '--note',
      'say when the study was published',
      '--via',
      'email:<m9@x>',
    ]);
    expect(ch.status, ch.stderr).toBe(0);
    const decided = readJson<ArticleRequest>(articleRequestPath(f.topic, f.story, f.root))!;
    expect(decided.decided).toMatchObject({
      verdict: 'changes',
      by: 'Jon',
      via: { channel: 'email', messageId: '<m9@x>' },
    });
    expect(decided.decided?.notes).toEqual(['say when the study was published']);
    const twice = article(['decide', '--request', req.request, '--verdict', 'ok', '--by', 'Jon']);
    expect(twice.status).toBe(0);
    expect(twice.stdout).toMatch(/already decided/);
    // a new request after the writer changed the text: the old id no longer applies
    const edited: Article = {
      ...release.article,
      meta: { ...release.article.meta, headline: `${release.article.meta.headline} (revised)` },
    };
    writeFileSync(join(f.dir, ARTICLE_FILES.article), toJson(edited));
    const r2 = article(['request-correction', '--by', 'automated: maintenance t3']);
    expect(r2.status, r2.stderr).toBe(0);
    const req2 = readJson<ArticleRequest>(articleRequestPath(f.topic, f.story, f.root))!;
    expect(req2.request).not.toBe(req.request);
    expect(req2.fingerprint).toBe(articleFingerprint(edited));
    expect(existsSync(join(f.dir, ARTICLE_FILES.release))).toBe(true); // nothing released by any of this
    expect(readJson<ArticleRelease>(join(f.dir, ARTICLE_FILES.release))!.revision).toBe(1);
  }, 120_000);
});
