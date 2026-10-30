// Markdown views of a validated script: script.md for a reader, review.md for the person deciding.
import {
  type PassageReader,
  type EvidencePackage,
  type Issue,
  MAX_REVISIONS,
  type Script,
  type ScriptValidation,
} from '../shared/types';
import { revisionsInPass, sectionTitle } from '../shared/sentences';

const MARK: Record<string, string> = { verified: 'ok', 'needs-review': 'review', blocked: 'BLOCKED' };
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const excerpt = (p: string | null, n = 320) => {
  if (!p) return '(passage not found)';
  const one = p.replace(/\s+/g, ' ').trim();
  return one.length > n ? one.slice(0, n) + '…' : one;
};

/** The narration as a reader sees it: sections, sentences with status markers, then the evidence behind each sentence. */
export function renderScriptMd(script: Script, v: ScriptValidation, read: PassageReader): string {
  const by = new Map(v.sentences.map((s) => [s.id, s]));
  const out: string[] = [
    `# ${script.title}`,
    '',
    `Story \`${script.story}\` (${script.topic}), revision ${script.revision}. About ${v.minutes} minutes (${v.words} words at ${v.wordsPerMinute} wpm). Validation: **${v.status}**, ${v.counts.blocking} blocking, ${v.counts.warnings} warnings, ${v.counts.verified}/${v.counts.assertions} assertions verified.`,
    '',
    'Markers: `[s12 ok]` every assertion verified by the deterministic checks and the reviewer; `[s12 review]` awaiting review or carrying a warning; `[s12 BLOCKED]` an open blocking issue. Sentences without a marker make no factual claim.',
    '',
  ];
  for (const sec of script.sections) {
    out.push(`## ${sectionTitle(sec)}`, '');
    out.push(
      sec.sentences
        .map((s) => {
          const r = by.get(s.id)!;
          // A reviewed non-factual sentence carries no marker; everything else shows its state.
          const m = r.assertions.length || r.issues.length || r.status !== 'verified' ? MARK[r.status] : '';
          return `${s.text}${m ? ` [${s.id} ${m}]` : ''}`;
        })
        .join(' '),
      '',
    );
  }
  const openIssues = v.issues.filter((i) => !i.disposition);
  if (openIssues.length) {
    out.push('## Open issues', '');
    for (const i of openIssues)
      out.push(
        `- **${i.severity}** ${i.sentence}${i.assertion ? ` (${i.assertion})` : ''} ${i.category} (${i.by}): ${i.explanation}${i.suggestion ? ` Suggestion: ${i.suggestion}` : ''}`,
      );
    out.push('');
  }
  out.push('## Evidence by sentence', '');
  for (const s of v.sentences) {
    if (!s.assertions.length && !s.issues.length) continue;
    out.push(`### ${s.id} (${s.type}, ${s.status})`, '', `> ${s.text}`, '');
    for (const i of s.issues) out.push(`- ${i.severity} ${i.category} (${i.by}): ${i.explanation}`);
    for (const a of s.assertions) {
      out.push(`- **${a.id}** [${a.status}] ${a.text}`);
      out.push(
        `  - ${a.validation.explanation}${a.validation.modality !== 'plain' ? ` modality: ${a.validation.modality}.` : ''}`,
      );
      for (const i of a.issues) out.push(`  - ${i.severity} ${i.category}: ${i.explanation}`);
      for (const x of [
        ...a.validation.supporting,
        ...a.validation.qualifying,
        ...a.validation.contradicting,
        ...a.validation.context,
      ]) {
        const cite = 'cite' in x.ref ? x.ref.cite : 'source' in x.ref ? x.ref.source : 'AI guess';
        out.push(
          `  - ${x.role}${x.cited ? '' : ' (uncited)'}: ${x.by ?? ''} ${x.verdict ?? ''}${x.confidence != null ? ` ${x.confidence}` : ''}${x.applicability ? `, ${x.applicability}` : ''} \`${cite}\``,
        );
        if (x.ref.kind === 'study' && x.cited) out.push(`    > ${excerpt(x.passage ?? read(x.ref.cite))}`);
        else if (x.note) out.push(`    > ${excerpt(x.note)}`);
      }
      if (a.calc)
        out.push(`  - calculation: ${a.calc.expression} = ${a.calc.result}${a.calc.note ? ` (${a.calc.note})` : ''}`);
      if (a.quote) out.push(`  - quotation: "${a.quote.text}" from \`${a.quote.cite ?? a.quote.source}\``);
    }
    out.push('');
  }
  return out.join('\n');
}

export interface StoryboardSummary {
  scenes: number;
  runtime: number; // seconds
  status: string;
  issues: Issue[];
}
export function renderReviewMd(
  script: Script,
  v: ScriptValidation,
  pkg: EvidencePackage | null,
  sb: StoryboardSummary | null,
): string {
  const open = v.issues.filter((i) => i.severity !== 'info' && !i.disposition);
  const dispositioned = v.issues.filter((i) => i.disposition);
  const decisions = [
    ...v.issues
      .filter((i) => i.severity === 'warning' && i.category !== 'runtime' && !i.disposition)
      .map((i) => `${i.sentence}${i.assertion ? ` ${i.assertion}` : ''}: ${i.explanation}`),
    ...(v.revisionLimitReached
      ? [
          `Revision limit (${MAX_REVISIONS}) reached with ${v.counts.blocking} blocking issues open: a person decides whether to cut, re-research or abandon.`,
        ]
      : []),
  ];
  return [
    `# Review: ${script.title}`,
    '',
    `| | |`,
    `|---|---|`,
    `| Story | \`${script.story}\` (${script.topic}) |`,
    `| Revision | ${script.revision} (${revisionsInPass(script)} of at most ${MAX_REVISIONS} in this pass) |`,
    `| Validation | **${v.status}** (${v.date.slice(0, 10)}) |`,
    `| Words / runtime | ${v.words} words, about ${v.minutes} min at ${v.wordsPerMinute} wpm |`,
    `| Sentences | ${v.counts.sentences} (${v.counts.factual} factual or attributed) |`,
    `| Assertions | ${v.counts.assertions}, ${v.counts.verified} verified |`,
    `| Issues | ${v.counts.blocking} blocking, ${v.counts.warnings} warnings, ${v.counts.dispositioned ?? 0} dispositioned |`,
    `| Unreviewed sentences | ${v.counts.unreviewed} |`,
    `| Scenes | ${sb ? `${sb.scenes}, ${mmss(sb.runtime)} (${sb.status})` : 'no storyboard yet'} |`,
    `| Evidence package | ${v.packageFingerprint ?? '?'}${pkg ? ` (${pkg.documents.length} documents, ${pkg.claims.length} claims)` : ''} |`,
    `| Model | ${script.generation?.model ?? '?'} |`,
    '',
    'Automated validation says whether the narration is eligible for human editorial review; it does not establish truth.',
    '',
    '## Open issues',
    '',
    ...(open.length
      ? open.map(
          (i) =>
            `- **${i.severity}** ${i.sentence}${i.assertion ? ` (${i.assertion})` : ''} ${i.category} (${i.by}): ${i.explanation}`,
        )
      : ['None.']),
    ...(sb?.issues.length
      ? [
          '',
          '### Storyboard',
          '',
          ...sb.issues.map((i) => `- **${i.severity}** ${i.sentence} ${i.category}: ${i.explanation}`),
        ]
      : []),
    '',
    '## Dispositions',
    '',
    'Deterministic warnings the reviewer judged false positives or already carried by the narration, at the current sentence fingerprint.',
    '',
    ...(dispositioned.length
      ? dispositioned.map(
          (i) =>
            `- ${i.sentence}${i.assertion ? ` (${i.assertion})` : ''} ${i.category}: ${i.disposition} (warning was: ${i.explanation})`,
        )
      : ['None.']),
    '',
    '## Resolved review findings',
    '',
    ...(v.resolved.length
      ? v.resolved.map(
          (r) =>
            `- ${r.sentence}${r.assertion ? ` (${r.assertion})` : ''} ${r.category} (raised against revision ${r.revision ?? '?'}, addressed in revision ${r.resolvedBy}): ${r.explanation}`,
        )
      : ['None.']),
    '',
    '## Research gaps',
    '',
    ...(pkg?.gaps.length ? pkg.gaps.map((g) => `- ${g}`) : ['None recorded on the story.']),
    '',
    '## Outstanding editorial decisions',
    '',
    ...(decisions.length ? decisions.map((d) => `- ${d}`) : ['None.']),
    '',
    '## History',
    '',
    ...v.history.map(
      (h) =>
        `- revision ${h.revision}, ${h.date.slice(0, 10)}: ${h.status}, ${h.blocking} blocking, ${h.warnings} warnings`,
    ),
    '',
  ].join('\n');
}
