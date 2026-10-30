// npm run article -- <command> <topic> <story-id> [...]
//   validate <topic> <story-id>      check article.json (+ article-review.json); writes article-validation.json, article.md
//   show <topic> <story-id>          print article.md
//   lock <topic> <story-id> --approved-by "<name>"                   release the article (article-release.json)
//   correct <topic> <story-id> --approved-by "<name>" --note "<note>"  release changed text and record the correction
//                                                                      as a revision in the topic's public-record.json
//   reaffirm <topic> <story-id> --approved-by "<name>" --note "<why unchanged>"  a stale article's text stands
// lock and correct validate afresh and refuse (exit 2, nothing written) unless it passes; a real name or "automated: ...".
// Both copy each figure's data into the release.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  ARTICLE_FILES,
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
import { corpusOf } from '../../lib/corpus';
import { passageReader, readJson, toJson, writeArtifact, ROOT, FILES, scriptDir } from '../../shared/io';
import { loadPublicRecord, publicRecordPath, withArticleRevision } from '../../shared/public-record';
import { Refusal } from '../../shared/refusal';
import { loadReview } from '../stories';
import type { EvidencePackage, Script, ScriptValidation } from '../../shared/types';
import { loadTopic } from '../../lib/topics';

const [cmd, topic, storyId, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
if (!['validate', 'show', 'lock', 'correct', 'reaffirm'].includes(cmd) || !topic || !storyId) {
  console.error(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 9)
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
    case 'show': {
      if (!existsSync(p(ARTICLE_FILES.md)))
        throw new Refusal(`run npm run article -- validate ${topic} ${storyId} first`);
      console.log(readFileSync(p(ARTICLE_FILES.md), 'utf8'));
      return;
    }
    case 'lock': {
      const { a, v } = releasable();
      const prev = loadArticleRelease(topic, storyId);
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
      return;
    }
    case 'correct': {
      const { a, v } = releasable();
      const prev = loadArticleRelease(topic, storyId);
      if (!prev) throw new Refusal(`nothing released yet: npm run article -- lock ${topic} ${storyId}`);
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
      console.log(
        `released ${rel(p(ARTICLE_FILES.release))}: revision ${release.revision}, changed ${revision.sentences.join(', ')}; recorded in ${rel(publicRecordPath(topic))}`,
      );
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

try {
  run();
} catch (e) {
  if (!(e instanceof Refusal)) throw e;
  console.error(`refused: ${e.message}`);
  process.exitCode = 2;
}
