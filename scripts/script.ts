// npm run script -- <command> <topic> <story-id> [...]
//   package <topic> <story-id>              build <topic>/scripts/<slug>/evidence-package.json from the reviewed story
//   validate <topic> <story-id> [--wpm N]   check script.json (+ script-review.json); writes validation.json, script.md, review.md
//   show <topic> <story-id> [sentence-id]   the reviewer's sheet: each sentence, its assertions, fingerprints and passages
//   storyboard <topic> <story-id>           fill and check storyboard.json against the script; writes storyboard.md, review.md
//   run <topic> <story-id> [--wpm N]        every stage whose inputs exist, then the next agent step (see scripts/briefs/)
//   lock <topic> <story-id> --approved-by "<name>"   write release.json (the approved fingerprints) when validation passed and the storyboard is ok
// Stages are independent and persisted; a rejected script never touches research or story discovery.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lf, passageReader } from '../src/lib/evidence';
import { loadReview, reviewPath } from '../src/lib/review';
import {
  type EvidencePackage,
  FILES,
  type Release,
  releaseCheck,
  type Script,
  type ScriptReviewFile,
  type ScriptValidation,
  buildPackage,
  readJson,
  renderReviewMd,
  renderScriptMd,
  scriptDir,
  sentenceFingerprint,
  sentences,
  sha,
  toJson,
  transcriptReader,
  validateScript,
  writeArtifact,
} from '../src/lib/script';
import { loadStories, storiesPath } from '../src/lib/stories';
import { type Storyboard, type StoryboardPlan, buildStoryboard, renderStoryboardMd } from '../src/lib/storyboard';
import { loadTopic } from '../src/lib/topics';

const [cmd, topic, storyId, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const args = rest.filter((a, i) => !a.startsWith('--') && !['--wpm', '--approved-by'].includes(rest[i - 1]));
const usage = () => {
  console.error(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 8)
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'),
  );
  process.exit(1);
};
if (!cmd || !topic || !storyId) usage();
const dir = scriptDir(topic, storyId);
const read = passageReader();
const p = (name: string) => join(dir, name);
const fileSha = (f: string) => (existsSync(f) ? sha(lf(readFileSync(f, 'utf8'))) : 'missing'); // checkout-independent
const rel = (f: string) =>
  f
    .replace(process.cwd() + '\\', '')
    .replace(process.cwd() + '/', '')
    .replaceAll('\\', '/');

function stagePackage(): EvidencePackage {
  const file = loadStories(topic);
  if (!file) throw new Error(`no ${storiesPath(topic)}; run npm run stories -- discover ${topic}`);
  const story = file.stories.find((s) => s.id === storyId);
  if (!story) throw new Error(`no story ${storyId} in ${storiesPath(topic)} (rejected stories cannot be scripted)`);
  if (story.readiness !== 'ready') console.error(`warning: story is ${story.readiness}: ${story.readinessWhy}`);
  const t = loadTopic(topic);
  const old = readJson<EvidencePackage>(p(FILES.pkg));
  const pkg = buildPackage(
    story,
    t,
    read,
    loadReview(topic),
    {
      stories: fileSha(storiesPath(topic)),
      review: fileSha(reviewPath(topic)),
      report: fileSha(join(process.cwd(), topic, 'report.json')),
    },
    process.cwd(),
    transcriptReader(topic),
    old,
  );
  if (old?.fingerprint === pkg.fingerprint) console.log(`${rel(p(FILES.pkg))} unchanged (${pkg.fingerprint})`);
  else {
    writeArtifact(dir, FILES.pkg, toJson(pkg));
    console.log(
      `wrote ${rel(p(FILES.pkg))} (${pkg.fingerprint}): ${pkg.claims.length} claims, ${pkg.documents.length} documents, ${pkg.gaps.length} gaps`,
    );
  }
  return pkg;
}

function stageValidate(): { script: Script; v: ScriptValidation; pkg: EvidencePackage | null } {
  const script = readJson<Script>(p(FILES.script));
  if (!script) throw new Error(`no ${rel(p(FILES.script))}; give an agent scripts/briefs/script.md`);
  const wpm = Number(flag('--wpm'));
  if (wpm) script.generation = { ...script.generation, wordsPerMinute: wpm };
  const pkg = readJson<EvidencePackage>(p(FILES.pkg));
  const review = readJson<ScriptReviewFile>(p(FILES.review));
  const previous = readJson<ScriptValidation>(p(FILES.validation));
  const v = validateScript(script, loadTopic(topic), read, review, loadReview(topic).applicability, previous, pkg);
  withRelease(v, null);
  writeArtifact(dir, FILES.validation, toJson(v));
  writeArtifact(dir, FILES.scriptMd, renderScriptMd(script, v, read));
  writeArtifact(dir, FILES.reviewMd, renderReviewMd(script, v, pkg, summary()));
  console.log(
    `${v.status}: ${v.words} words (${v.spokenWords} as spoken, ~${v.minutes} min at ${v.wordsPerMinute} wpm), ${v.counts.assertions} assertions, ${v.counts.verified} verified, ${v.counts.blocking} blocking, ${v.counts.warnings} warnings, ${v.counts.dispositioned} dispositioned, ${v.counts.unreviewed} sentences unreviewed${review ? '' : ' (no script-review.json yet)'}`,
  );
  for (const i of v.issues.filter((x) => x.severity !== 'info' && !x.disposition))
    console.log(
      `  ${i.severity.toUpperCase()} ${i.sentence}${i.assertion ? ` ${i.assertion}` : ''} ${i.category} [${i.by}]: ${i.explanation.length > 240 ? i.explanation.slice(0, 240) + '…' : i.explanation}`,
    );
  if (v.revisionLimitReached)
    console.log(`  revision limit reached; outstanding blockers persist in ${rel(p(FILES.validation))}`);
  console.log(`wrote ${rel(p(FILES.validation))}, ${rel(p(FILES.scriptMd))}, ${rel(p(FILES.reviewMd))}`);
  return { script, v, pkg };
}

/** After a lock, any drift from the approved fingerprints is a warning on the validation. */
function withRelease(v: ScriptValidation, sb: Storyboard | null) {
  const extra = releaseCheck(readJson<Release>(p(FILES.release)), v, sb);
  v.issues.unshift(...extra);
  v.counts.warnings += extra.length;
}

function stageLock() {
  const approvedBy = flag('--approved-by');
  const v = readJson<ScriptValidation>(p(FILES.validation));
  const sb = readJson<Storyboard>(p(FILES.storyboard));
  const refuse = (why: string) => {
    console.error(`not locked: ${why}`);
    process.exitCode = 2;
  };
  if (!approvedBy) return refuse('--approved-by "<name>" is required (a person, or "automated: ..." )');
  if (!v || !sb) return refuse('run validate and storyboard first');
  if (v.status !== 'passed') return refuse(`validation is ${v.status}, not passed`);
  if (sb.status !== 'ok') return refuse(`storyboard is ${sb.status}, not ok`);
  if (sb.scriptFingerprint !== v.scriptFingerprint)
    return refuse(
      `the storyboard was built against script ${sb.scriptFingerprint}; validation is ${v.scriptFingerprint}: re-run storyboard`,
    );
  const release: Release = {
    topic,
    story: storyId,
    approvedBy,
    date: new Date().toISOString(),
    revision: v.revision,
    fingerprints: {
      script: v.scriptFingerprint,
      package: v.packageFingerprint ?? '',
      validation: fileSha(p(FILES.validation)),
      storyboard: fileSha(p(FILES.storyboard)),
    },
  };
  writeArtifact(dir, FILES.release, toJson(release));
  console.log(
    `locked ${rel(p(FILES.release))}: revision ${release.revision}, script ${release.fingerprints.script}, package ${release.fingerprints.package}, approved by ${approvedBy}`,
  );
}

function summary() {
  const sb = readJson<ReturnType<typeof buildStoryboard>>(p(FILES.storyboard));
  return sb && 'scenes' in sb && Array.isArray(sb.scenes) && sb.scenes.length && 'runtime' in sb
    ? { scenes: sb.scenes.length, runtime: sb.runtime, status: sb.status, issues: sb.issues ?? [] }
    : null;
}

function stageStoryboard() {
  const script = readJson<Script>(p(FILES.script));
  const v = readJson<ScriptValidation>(p(FILES.validation));
  const pkg = readJson<EvidencePackage>(p(FILES.pkg));
  const plan = readJson<StoryboardPlan>(p(FILES.storyboard));
  if (!script || !v || !pkg) throw new Error('run package and validate first');
  if (!plan) throw new Error(`no ${rel(p(FILES.storyboard))}; give an agent scripts/briefs/storyboard.md`);
  const sb = buildStoryboard(plan, script, v, pkg, read);
  sb.issues.unshift(...releaseCheck(readJson<Release>(p(FILES.release)), v, sb));
  writeArtifact(dir, FILES.storyboard, toJson(sb)); // the plan, filled in: narration, timing, status (idempotent)
  writeArtifact(dir, FILES.storyboardMd, renderStoryboardMd(sb, pkg, read));
  writeArtifact(
    dir,
    FILES.reviewMd,
    renderReviewMd(script, v, pkg, {
      scenes: sb.scenes.length,
      runtime: sb.runtime,
      status: sb.status,
      issues: sb.issues,
    }),
  );
  console.log(`${sb.status}: ${sb.scenes.length} scenes, ${Math.round(sb.runtime)}s`);
  for (const i of sb.issues) console.log(`  ${i.severity.toUpperCase()} ${i.sentence} ${i.category}: ${i.explanation}`);
  console.log(`wrote ${rel(p(FILES.storyboard))}, ${rel(p(FILES.storyboardMd))}, ${rel(p(FILES.reviewMd))}`);
  return sb;
}

function show() {
  const script = readJson<Script>(p(FILES.script));
  const v = readJson<ScriptValidation>(p(FILES.validation));
  if (!script || !v) throw new Error('run validate first');
  const pkg = readJson<EvidencePackage>(p(FILES.pkg));
  const statements = new Map(
    (pkg?.claims ?? []).flatMap((c) => c.statements.map((s) => [`${c.id}|${s.source}`, s] as const)),
  );
  const by = new Map(v.sentences.map((s) => [s.id, s]));
  const only = args[0];
  for (const s of sentences(script)) {
    if (only && s.id !== only) continue;
    const r = by.get(s.id)!;
    console.log(
      `\n[${s.id}] ${s.section} ${s.type} ${r.status}${r.approved ? ' approved' : ''} fp=${sentenceFingerprint(s)}`,
    );
    console.log(`  ${s.text}`);
    if (s.note) console.log(`  note: ${s.note}`);
    for (const i of r.issues) console.log(`  ${i.severity.toUpperCase()} ${i.category} [${i.by}]: ${i.explanation}`);
    for (const a of r.assertions) {
      console.log(`  ${a.id} (${a.kind}, ${a.status}): ${a.text}`);
      console.log(`    ${a.validation.explanation} modality=${a.validation.modality}`);
      for (const i of a.issues) console.log(`    ${i.severity.toUpperCase()} ${i.category}: ${i.explanation}`);
      for (const l of a.validation.limitations) console.log(`    limit: ${l}`);
      const src = script.sections
        .flatMap((x) => x.sentences)
        .find((x) => x.id === s.id)
        ?.assertions?.find((x) => x.id === a.id);
      if (src?.calc)
        console.log(
          `    calc: ${src.calc.expression} = ${src.calc.result}${src.calc.note ? ` (${src.calc.note})` : ''}`,
        );
      if (src?.quote)
        console.log(
          `    quote: "${src.quote.text}" <- ${src.quote.cite ?? src.quote.source}${src.quote.speaker ? ` (speaker: ${src.quote.speaker})` : ''}`,
        );
      if (src?.qualifications?.length) console.log(`    qualifications: ${src.qualifications.join(' | ')}`);
      for (const x of [
        ...a.validation.supporting,
        ...a.validation.qualifying,
        ...a.validation.contradicting,
        ...a.validation.context,
      ]) {
        const cite = 'cite' in x.ref ? x.ref.cite : 'source' in x.ref ? x.ref.source : 'AI guess';
        console.log(
          `    ${x.role}${x.cited ? '' : ' (uncited)'}: ${x.by ?? ''} ${x.verdict ?? ''} ${x.confidence ?? ''} ${x.applicability ?? ''} ${cite}`,
        );
        if (x.why && x.applicability !== 'direct') console.log(`      applicability: ${x.why}`);
        const passage = x.ref.kind === 'study' ? read(x.ref.cite) : x.note;
        if (passage) console.log(`      | ${passage.trim().split('\n').join('\n      | ')}`);
        // The package's transcript window around a source quote: the only place a speaker can be confirmed from.
        if (x.ref.kind === 'statement') {
          const context = statements.get(`${x.ref.claim}|${x.ref.source}`)?.context;
          console.log(`      context: ${context ?? '(none in the evidence package)'}`);
        }
      }
    }
  }
}

switch (cmd) {
  case 'package':
    stagePackage();
    break;
  case 'validate': {
    const { v } = stageValidate();
    process.exitCode = v.status === 'blocked' ? 2 : 0;
    break;
  }
  case 'show':
    show();
    break;
  case 'lock':
    stageLock();
    break;
  case 'storyboard': {
    const sb = stageStoryboard();
    process.exitCode = sb.status === 'blocked' ? 2 : 0;
    break;
  }
  case 'run': {
    stagePackage();
    if (!existsSync(p(FILES.script))) {
      console.log(`next: an agent writes ${rel(p(FILES.script))} following scripts/briefs/script.md, then rerun`);
      break;
    }
    const { v } = stageValidate();
    if (v.status === 'blocked') {
      console.log(
        `next: the writer revises ${rel(p(FILES.script))} (revision ${v.revision + 1}) against the blocking issues above, then rerun`,
      );
      process.exitCode = 2;
      break;
    }
    if (!existsSync(p(FILES.review)) || v.counts.unreviewed)
      console.log(
        `next: an independent agent writes ${rel(p(FILES.review))} following scripts/briefs/script-review.md (npm run script -- show ${topic} ${storyId} prints the sheet), then rerun`,
      );
    if (!existsSync(p(FILES.storyboard))) {
      console.log(
        `next: an agent writes ${rel(p(FILES.storyboard))} following scripts/briefs/storyboard.md, then rerun`,
      );
      break;
    }
    const sb = stageStoryboard();
    process.exitCode = sb.status === 'blocked' ? 2 : 0;
    break;
  }
  default:
    usage();
}
