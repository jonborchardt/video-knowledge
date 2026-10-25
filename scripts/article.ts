// npm run article -- <command> <topic> <story-id> [...]
//   validate <topic> <story-id>      check article.json (+ article-review.json); writes article-validation.json, article.md
//   show <topic> <story-id>          print article.md
//   lock <topic> <story-id> --approved-by "<name>"                   release the article (article-release.json)
//   correct <topic> <story-id> --approved-by "<name>" --note "<note>"  release changed text and record the correction
//                                                                      as a revision in the topic's public-record.json
// lock and correct validate afresh and refuse (exit 2, nothing written) unless it passes; a real name or "automated: ...".
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ARTICLE_FILES,
  type Article,
  correctArticle,
  loadArticleRelease,
  lockArticle,
  renderArticleMd,
} from '../src/lib/article';
import { figuresOf, validateArticle } from '../src/lib/article-validation';
import { corpusOf } from '../src/lib/corpus';
import { passageReader } from '../src/lib/evidence';
import { readJson, toJson, writeArtifact, ROOT } from '../src/lib/io';
import { loadPublicRecord, publicRecordPath, publicRecordProblems } from '../src/lib/public-record';
import { Refusal } from '../src/lib/publish';
import { loadReview } from '../src/lib/review';
import {
  type EvidencePackage,
  FILES,
  type Script,
  type ScriptReviewFile,
  type ScriptValidation,
  scriptDir,
} from '../src/lib/script';
import { loadTopic } from '../src/lib/topics';

const [cmd, topic, storyId, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
if (!['validate', 'show', 'lock', 'correct'].includes(cmd) || !topic || !storyId) {
  console.error(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 7)
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'),
  );
  process.exit(1);
}
const dir = scriptDir(topic, storyId);
const p = (name: string) => join(dir, name);
const rel = (f: string) =>
  f
    .replace(ROOT, '')
    .replace(/^[\\/]/, '')
    .replaceAll('\\', '/');
const today = new Date().toISOString().slice(0, 10);

/** The article judged against the current package, review, script, storyboard and sources. */
function validate(): { a: Article; v: ScriptValidation } {
  const a = readJson<Article>(p(ARTICLE_FILES.article));
  if (!a) throw new Refusal(`no ${rel(p(ARTICLE_FILES.article))}; give an agent scripts/briefs/article.md`);
  const pkg = readJson<EvidencePackage>(p(FILES.pkg));
  if (!pkg) throw new Refusal(`no ${rel(p(FILES.pkg))}; run npm run script -- package ${topic} ${storyId}`);
  const v = validateArticle(a, corpusOf(loadTopic(topic)), passageReader(), {
    review: readJson<ScriptReviewFile>(p(ARTICLE_FILES.review)),
    judgments: loadReview(topic).applicability,
    previous: readJson<ScriptValidation>(p(ARTICLE_FILES.validation)),
    pkg,
    script: readJson<Script>(p(FILES.script)),
    figures: figuresOf(topic, storyId),
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
        throw new Error(`run npm run article -- validate ${topic} ${storyId} first`);
      console.log(readFileSync(p(ARTICLE_FILES.md), 'utf8'));
      return;
    }
    case 'lock': {
      const { a, v } = releasable();
      const prev = loadArticleRelease(topic, storyId);
      const r = lockArticle(prev, a, v, flag('--approved-by') ?? '', today);
      if (r === prev) return console.log(`${rel(p(ARTICLE_FILES.release))} unchanged: revision ${r.revision}`);
      writeArtifact(dir, ARTICLE_FILES.release, toJson(r));
      console.log(`released ${rel(p(ARTICLE_FILES.release))}: revision 1, approved by ${r.approvedBy}`);
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
      );
      const problems = publicRecordProblems({ exhibits: {}, revisions: [revision] });
      if (problems.length) throw new Refusal(problems.join('; '));
      const record = loadPublicRecord(topic);
      const next = { ...record, revisions: [...record.revisions, revision] };
      writeArtifact(dir, ARTICLE_FILES.release, toJson(release));
      writeFileSync(publicRecordPath(topic), toJson(next));
      console.log(
        `released ${rel(p(ARTICLE_FILES.release))}: revision ${release.revision}, sentences ${revision.sentences.join(', ')}; recorded in ${rel(publicRecordPath(topic))}`,
      );
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
