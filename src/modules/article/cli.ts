// npm run article -- <command> <topic> <story-id> [...]
//   validate <topic> <story-id>      check article.json (+ article-review.json); writes article-validation.json, article.md
//   show <topic> <story-id>          print article.md
//   frames <topic> <story-id> [--port <n>]  validate afresh, start the dev server as a child and photograph the matter page
//                                    as it renders the validated draft (375 and 1280 wide, light and dark, tiles under
//                                    page/, index.json naming the article fingerprint the page carried) for the page review
//   lock <topic> <story-id> --approved-by "<name>"                   release the article (article-release.json)
//   correct <topic> <story-id> --approved-by "<name>" --note "<note>"  release changed text and record the correction
//                                                                      as a revision in the topic's public-record.json
//   reaffirm <topic> <story-id> --approved-by "<name>" --note "<why unchanged>"  a stale article's text stands
//   request-correction <topic> <story-id> --by "<name>"                  a correction request (article-request.json) bound to
//                                                                      article.json's fingerprint now (APPROVAL_SECRET; refused
//                                                                      unless a review exists and validation passes); idempotent
//   decide <topic> <story-id> --request <ar-id> --verdict ok|changes --by "<name>" [--note ...]* [--via <channel:id>]
//                                                                      a person's decision on the open request: ok runs correct for
//                                                                      the exact fingerprint; changes records the notes for the writer
//   sent <topic> <story-id> --request <ar-id> --message-id <id>       the request mail went out with that Message-ID (idempotent;
//                                                                      a different id for a sent request is refused)
// lock and correct validate afresh and refuse (exit 2, nothing written) unless it passes; a real name or "automated: ...".
// Both copy each figure's data into the release.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  ARTICLE_FILES,
  approvedPageReview,
  articleFingerprint,
  type Article,
  correctArticle,
  loadArticleRelease,
  lockArticle,
  reaffirmArticle,
  releaseFigures,
  renderArticleMd,
} from './article';
import { articleStale } from './view';
import { figureData, validateArticleIn } from './validation';
import { corpusOf, loadTopic } from '../evidence';
import {
  MANIFEST_FILE,
  REVIEW_DIR,
  passageReader,
  readJson,
  toJson,
  writeArtifact,
  ROOT,
  FILES,
  scriptDir,
} from '../../shared/io';
import { runCli } from '../../shared/cli';
import { loadPublicRecord, publicRecordPath, withArticleRevision } from '../../shared/public-record';
import { Refusal } from '../../shared/refusal';
import { loadReview, loadStories, storyUrlSlug } from '../stories';
import { captureFrames } from './frames';
import type { EvidencePackage, Script, ScriptValidation } from '../../shared/types';
import { secretFromEnv } from '../../shared/request';
import { approverProblem } from '../../shared/approver';
import { type ArticleRequest, correctionProblem, loadArticleRequest, markSent, requestCorrection } from './request';

const [cmd, topic, storyId, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const flags = (name: string) => rest.flatMap((x, i) => (x === name && rest[i + 1] !== undefined ? [rest[i + 1]] : []));
if (
  !['validate', 'show', 'frames', 'lock', 'correct', 'reaffirm', 'request-correction', 'decide', 'sent'].includes(
    cmd,
  ) ||
  !topic ||
  !storyId
) {
  console.error(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 18)
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'),
  );
  process.exit(1);
}
const dir = scriptDir(topic, storyId);
const p = (name: string) => join(dir, name);
const rel = (f: string) => relative(ROOT, f).replaceAll('\\', '/');
const today = new Date().toISOString().slice(0, 10);

/** The article judged against the current package, review, script, storyboard and sources. */
function validate(): { a: Article; v: ScriptValidation } {
  const a = readJson<Article>(p(ARTICLE_FILES.article));
  if (!a) throw new Refusal(`no ${rel(p(ARTICLE_FILES.article))}; give an agent src/modules/article/briefs/article.md`);
  const pkg = readJson<EvidencePackage>(p(FILES.pkg));
  if (!pkg) throw new Refusal(`no ${rel(p(FILES.pkg))}; run npm run script -- package ${topic} ${storyId}`);
  const v = validateArticleIn(topic, storyId, a, corpusOf(loadTopic(topic)), passageReader(), {
    judgments: loadReview(topic).applicability,
    pkg,
    script: readJson<Script>(p(FILES.script)),
  });
  return { a, v };
}

/** A release manifest beside the video (a release build packaged) binds the article's released text: packaging
 *  rewrites it after a lock or a correction, as a child (the manifest is packaging's file). */
function refreshManifest() {
  if (!existsSync(join(dir, 'video', REVIEW_DIR, MANIFEST_FILE))) return;
  const r = runCli('packaging', ['manifest', topic, storyId]);
  if (r.status !== 0) throw new Error(`the release manifest could not be rewritten: ${(r.stderr || r.stdout).trim()}`);
  console.log((r.stdout ?? '').trim());
}

/** lock and correct release only what passes now, after a review exists. */
function releasable() {
  if (!readJson(p(ARTICLE_FILES.review)))
    throw new Refusal(`no ${rel(p(ARTICLE_FILES.review))}; an independent agent reviews the article first`);
  return validate();
}

function run() {
  switch (cmd) {
    case 'validate': {
      const { a, v } = validate();
      writeArtifact(dir, ARTICLE_FILES.validation, toJson(v));
      writeArtifact(dir, ARTICLE_FILES.md, renderArticleMd(a, v));
      console.log(
        `${v.status}: ${v.counts.sentences} sentences, ${v.counts.assertions} assertions, ${v.counts.verified} verified, ${v.counts.blocking} blocking, ${v.counts.warnings} warnings, ${v.counts.unreviewed} unreviewed`,
      );
      for (const i of v.issues.filter((x) => x.severity !== 'info' && !x.disposition))
        console.log(`  ${i.severity.toUpperCase()} ${i.sentence} ${i.category} [${i.by}]: ${i.explanation}`);
      console.log(`wrote ${rel(p(ARTICLE_FILES.validation))}, ${rel(p(ARTICLE_FILES.md))}`);
      console.log(v.status === 'passed' ? 'RESULT: PASSED' : `RESULT: FAILED (${v.status})`);
      process.exitCode = v.status === 'blocked' ? 2 : 0;
      return;
    }
    case 'frames': {
      // the stored validation is what the dev page's preview release reads, so write it afresh first
      const { a, v } = validate();
      writeArtifact(dir, ARTICLE_FILES.validation, toJson(v));
      if (v.status !== 'passed') throw new Refusal(`validation is ${v.status}, not passed: nothing to photograph yet`);
      const s = loadStories(topic)?.stories.find((x) => x.id === storyId);
      if (!s) throw new Refusal(`no story ${storyId} in topics/${topic}/stories.json`);
      const port = Number(flag('--port') ?? 4322);
      return captureFrames(topic, storyId, {
        path: `/${topic}/${storyUrlSlug(s)}/`,
        key: articleFingerprint(a),
        port,
      }).then(({ dir: out, index }) =>
        console.log(
          `wrote ${out}/: ${index.tiles.length} tiles in ${index.tiles.length ? 4 : 0} views, key ${index.key}`,
        ),
      );
    }
    case 'show': {
      if (!existsSync(p(ARTICLE_FILES.md)))
        throw new Refusal(`run npm run article -- validate ${topic} ${storyId} first`);
      console.log(readFileSync(p(ARTICLE_FILES.md), 'utf8'));
      return;
    }
    case 'lock': {
      const { a, v } = releasable();
      const prev = loadArticleRelease(topic, storyId);
      if (!prev) approvedPageReview(topic, storyId); // the first release needs the rendered page reviewed at this text
      const r = lockArticle(
        prev,
        a,
        v,
        flag('--approved-by') ?? '',
        today,
        releaseFigures(a, figureData(topic, storyId)),
      );
      if (r === prev) return console.log(`${rel(p(ARTICLE_FILES.release))} unchanged: revision ${r.revision}`);
      // the revisions it has seen: any appended later makes it stale, the same day too
      writeArtifact(dir, ARTICLE_FILES.release, toJson({ ...r, recordSeen: loadPublicRecord(topic).revisions.length }));
      console.log(`released ${rel(p(ARTICLE_FILES.release))}: revision ${r.revision}, approved by ${r.approvedBy}`);
      refreshManifest();
      return;
    }
    case 'correct': {
      // register D10, checked before anything is validated: a correction is a person's act (the module refuses too)
      if (/^automated:/i.test((flag('--approved-by') ?? '').trim()))
        throw new Refusal(
          'only a person releases a correction (register D10); automation requests one and the person decides',
        );
      const { a, v } = releasable();
      const prev = loadArticleRelease(topic, storyId);
      if (!prev) throw new Refusal(`nothing released yet: npm run article -- lock ${topic} ${storyId}`);
      // a correction decided by reply names its request: it must bind the article as it is now (register D10)
      const reqId = flag('--request');
      const req = loadArticleRequest(topic, storyId);
      if (reqId) {
        const problem = correctionProblem(req, reqId, articleFingerprint(a), new Date());
        if (problem) throw new Refusal(problem);
      }
      const { release, revision } = correctArticle(
        prev,
        a,
        v,
        flag('--approved-by') ?? '',
        flag('--note') ?? '',
        today,
        releaseFigures(a, figureData(topic, storyId)),
      );
      const record = loadPublicRecord(topic);
      // the record first: if the release write then fails, correct can be re-run against the old release, and the
      // re-run finds its revision already recorded
      const next = withArticleRevision(record, revision);
      if (next !== record) writeFileSync(publicRecordPath(topic), toJson(next));
      writeArtifact(dir, ARTICLE_FILES.release, toJson({ ...release, recordSeen: next.revisions.length }));
      if (reqId && req) {
        const via = flag('--via');
        const [channel, ...detail] = (via ?? 'cli').split(':');
        writeArtifact(
          dir,
          ARTICLE_FILES.request,
          toJson({
            ...req,
            decided: {
              verdict: 'ok',
              by: flag('--approved-by') ?? '',
              at: new Date().toISOString(),
              via: { channel, ...(detail.length && { messageId: detail.join(':') }) },
            },
          } satisfies ArticleRequest),
        );
      }
      console.log(
        `released ${rel(p(ARTICLE_FILES.release))}: revision ${release.revision}, changed ${revision.sentences.join(', ')}; recorded in ${rel(publicRecordPath(topic))}`,
      );
      refreshManifest();
      return;
    }
    case 'request-correction': {
      // the maintenance pass validated and reviewed the text just before; the request binds the file as it is
      const a = readJson<Article>(p(ARTICLE_FILES.article));
      if (!a) throw new Refusal(`no ${rel(p(ARTICLE_FILES.article))}`);
      if (!readJson(p(ARTICLE_FILES.review)))
        throw new Refusal(`no ${rel(p(ARTICLE_FILES.review))}; an independent agent reviews the correction first`);
      if (!loadArticleRelease(topic, storyId))
        throw new Refusal(`nothing released yet: a correction follows a release`);
      const v = readJson<ScriptValidation>(p(ARTICLE_FILES.validation));
      if (v?.status !== 'passed')
        throw new Refusal(
          `the article does not pass validation (${v?.status ?? 'not validated'}): npm run article -- validate ${topic} ${storyId}`,
        );
      const secret = secretFromEnv();
      if (!secret) throw new Refusal('a request id needs APPROVAL_SECRET in .env');
      const by = flag('--by') ?? '';
      if (!by.trim()) throw new Refusal('request-correction needs --by <name>');
      const fp = articleFingerprint(a);
      const { request, existing } = requestCorrection(
        loadArticleRequest(topic, storyId),
        fp,
        secret,
        by,
        new Date(),
        7,
      );
      if (!existing) writeArtifact(dir, ARTICLE_FILES.request, toJson(request));
      console.log(
        `${existing ? 'already requested' : 'requested'}: ${request.request} for ${rel(p(ARTICLE_FILES.article))} (${fp}), expires ${request.expiresAt}`,
      );
      return;
    }
    case 'decide': {
      const reqId = flag('--request');
      const verdict = flag('--verdict');
      const by = flag('--by') ?? '';
      if (!reqId || !verdict || !['ok', 'changes'].includes(verdict))
        throw new Refusal('decide needs --request <ar-id> --verdict ok|changes --by <name>');
      const problem = approverProblem(by);
      if (problem) throw new Refusal(problem);
      if (/^automated:/i.test(by.trim())) throw new Refusal('only a person decides a correction (register D10)');
      const a = readJson<Article>(p(ARTICLE_FILES.article));
      if (!a) throw new Refusal(`no ${rel(p(ARTICLE_FILES.article))}`);
      const req = loadArticleRequest(topic, storyId);
      const wrong = correctionProblem(req, reqId, articleFingerprint(a), new Date());
      if (wrong) {
        if (req?.request === reqId && req.decided) {
          console.log(`already decided: ${reqId} (${req.decided.verdict}) by ${req.decided.by}`);
          return;
        }
        throw new Refusal(wrong);
      }
      const via = flag('--via');
      const [channel, ...detail] = (via ?? 'cli').split(':');
      const decided = {
        verdict: verdict as 'ok' | 'changes',
        by,
        at: new Date().toISOString(),
        via: { channel, ...(detail.length && { messageId: detail.join(':') }) },
        ...(verdict === 'changes' && { notes: flags('--note') }),
      };
      if (verdict === 'changes') {
        if (!decided.notes?.length) throw new Refusal('changes needs at least one --note');
        writeArtifact(dir, ARTICLE_FILES.request, toJson({ ...req!, decided } satisfies ArticleRequest));
        console.log(
          `${reqId}: changes recorded (${decided.notes.length} note${decided.notes.length === 1 ? '' : 's'}); the next maintenance pass revises the article`,
        );
        return;
      }
      // ok: the correction itself, by the person, for the exact fingerprint, with the reviewer's words as the note
      const prev = loadArticleRelease(topic, storyId);
      if (!prev) throw new Refusal('nothing released yet');
      if (articleFingerprint(prev.article) === articleFingerprint(a)) {
        // the correction is out already (a crash after the release and before this record): the decision is
        // recorded and nothing is released twice
        writeArtifact(dir, ARTICLE_FILES.request, toJson({ ...req!, decided } satisfies ArticleRequest));
        console.log(`${reqId}: ok by ${by}; the correction was already released as revision ${prev.revision}`);
        return;
      }
      const review = readJson<{ findings?: { text: string }[]; summary?: string }>(p(ARTICLE_FILES.review));
      const note = flag('--note') ?? review?.summary ?? 'corrected after a revised finding (approved by reply)';
      const { a: art, v } = releasable();
      const { release, revision } = correctArticle(
        prev,
        art,
        v,
        by,
        note,
        today,
        releaseFigures(art, figureData(topic, storyId)),
      );
      const record = loadPublicRecord(topic);
      const next = withArticleRevision(record, revision);
      if (next !== record) writeFileSync(publicRecordPath(topic), toJson(next));
      writeArtifact(dir, ARTICLE_FILES.release, toJson({ ...release, recordSeen: next.revisions.length }));
      writeArtifact(dir, ARTICLE_FILES.request, toJson({ ...req!, decided } satisfies ArticleRequest));
      console.log(
        `${reqId}: ok by ${by}; released ${rel(p(ARTICLE_FILES.release))}: revision ${release.revision}, changed ${revision.sentences.join(', ')}`,
      );
      refreshManifest();
      return;
    }
    case 'sent': {
      const reqId = flag('--request');
      const messageId = flag('--message-id');
      if (!reqId || !messageId) throw new Refusal('sent needs --request <ar-id> --message-id <id>');
      let marked: ReturnType<typeof markSent>;
      try {
        marked = markSent(loadArticleRequest(topic, storyId), reqId, messageId);
      } catch (e) {
        throw new Refusal((e as Error).message);
      }
      if (marked.changed) writeArtifact(dir, ARTICLE_FILES.request, toJson(marked.request));
      console.log(`${marked.changed ? 'sent' : 'already sent'}: ${reqId} as ${messageId}`);
      return;
    }
    case 'reaffirm': {
      const { a, v } = releasable();
      const prev = loadArticleRelease(topic, storyId);
      if (!prev) throw new Refusal(`nothing released yet: npm run article -- lock ${topic} ${storyId}`);
      const record = loadPublicRecord(topic);
      const stale = articleStale(prev, record);
      const r = reaffirmArticle(prev, !!stale, a, v, flag('--approved-by') ?? '', flag('--note') ?? '', today);
      writeArtifact(dir, ARTICLE_FILES.release, toJson({ ...r, recordSeen: record.revisions.length }));
      console.log(`reaffirmed ${rel(p(ARTICLE_FILES.release))}: revision ${r.revision} stands, dated ${r.date}`);
    }
  }
}

// frames is the one asynchronous verb; a refusal from either path exits 2 with nothing written
Promise.resolve()
  .then(() => run())
  .catch((e: unknown) => {
    if (!(e instanceof Refusal)) throw e;
    console.error(`refused: ${e.message}`);
    process.exitCode = 2;
  });
