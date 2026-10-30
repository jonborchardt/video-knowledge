// Turn a topic folder (report.json from the watcher library, plus store/, site.json, lean.json) into page data.
// The report already decides each claim's verdict; nothing here re-judges.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, topicDir, topicsDir } from '../../shared/io';
import { commissionOf } from '../../config/site';
import { isClaimRevision, loadPublicRecord } from '../../shared/public-record';
import type {
  ClaimSourceView,
  ClaimVerdictView,
  ClaimView,
  RecordedApplicability,
  SourceClaimView,
  SourceView,
  SurpriseView,
  Topic,
  Verdict,
} from '../../shared/types';
import { applicabilityKey, checkApplicabilityFile } from './batches';

/** Each study verdict's recorded applicability, beside the store; written only by src/modules/evidence/record-sources.mjs. */
export const APPLICABILITY_FILE = 'applicability.json';

export type { Verdict };
export type {
  ClaimView,
  ClaimSourceView,
  ClaimVerdictView,
  SourceClaimView,
  SourceView,
  SurpriseView,
  Topic,
} from '../../shared/types';
const JUDGED: Verdict[] = ['right', 'wrong', 'partly'];

// The slice of `watcher report --json` this site reads.
interface VerdictRecord {
  method?: string;
  date?: string;
  verdict: Verdict;
  confidence?: number;
  note?: string;
  source?: string;
}
interface ReportClaim {
  id: string;
  text: string;
  asserted: number;
  denied: number;
  effective: Verdict | null;
  confidence: number | null;
  note: string | null;
  source: string | null;
  documents: string[];
}
interface ReportSurprise {
  claim: ReportClaim;
  prior: Verdict;
  evidence: Verdict;
  overrides: boolean;
  priorRecord: VerdictRecord;
  evidenceRecord: VerdictRecord;
}
interface ReportVideo {
  id: string;
  title: string;
  channel: string;
  scaled: -1 | 0 | 1 | 2 | null;
  novelty: number;
  worthWatching: string;
  assertions: number;
}
interface Report {
  topics: {
    id: string;
    label: string;
    claims: ReportClaim[];
    commonlyWrong: ReportClaim[];
    contested: ReportClaim[];
    surprises: ReportSurprise[];
  }[];
  videos: ReportVideo[];
}
interface StoreVideo {
  id: string;
  title: string;
  channel?: string;
  durationSec?: number;
  transcript: string;
  url?: string;
  summary?: string;
  supersededBy?: string;
  assertions?: { claim: string; stance: 'asserts' | 'denies'; quote: string; verdicts?: VerdictRecord[] }[];
}
interface SiteConfig {
  hero?: { title?: string; lede?: string }; // hand-written hook at the top of the topic page
  recap?: { bottomLine?: string; groups?: { title: string; claims: string[] }[] };
  docs?: Record<string, string>;
  sameStudy?: Record<string, string>; // '<summary file>.txt' -> '<primary file>.txt' when two documents report one study
}

export const VAL: Record<string, number> = { right: 1, partly: 0.5, wrong: -1 };

/** Topic folders that have a report with claims. */
export function topicNames(): string[] {
  return readdirSync(topicsDir(), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && existsSync(join(topicDir(d.name), 'report.json')))
    .map((d) => d.name)
    .filter((n) => (readJson<Report>(join(topicDir(n), 'report.json'))?.topics[0]?.claims.length ?? 0) > 0);
}

/** The topics the public site shows: those an institution has claimed (`commissions` in the site config). The rest
 *  stay in the repo and on the dev server's working pages only. */
export const publicTopicNames = (): string[] => topicNames().filter((n) => commissionOf(n));

export function loadTopic(name: string): Topic {
  const dir = topicDir(name);
  const r = readJson<Report>(join(dir, 'report.json'))!;
  const t = r.topics[0];
  const cfg = readJson<SiteConfig>(join(dir, 'site.json')) ?? {};
  const lean = readJson<Record<string, string>>(join(dir, 'lean.json')) ?? {};
  const applicability = readJson<Record<string, RecordedApplicability>>(join(dir, APPLICABILITY_FILE)) ?? {};
  const malformed = checkApplicabilityFile(applicability);
  if (malformed.length) throw new Error(`${name}/applicability.json: ${malformed.join('; ')}`);
  const record = loadPublicRecord(name);
  const revisions = record.revisions.filter(isClaimRevision); // an article's corrections are shown on its story
  // Sorted: readdirSync order differs by file system, and the order reaches every claim's sources and the packages.
  const recs = readdirSync(join(dir, 'store', 'videos'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, 'store', 'videos', f), 'utf8')) as StoreVideo);
  const recOf = new Map(recs.map((v) => [v.id, v]));
  const docName = (src?: string | null) => {
    const f = (src ?? '').split('#')[0].split('/').pop() ?? '';
    return cfg.docs?.[f] ?? f;
  };

  const metaOf = (x: StoreVideo) => {
    const post = x.transcript === 'article' || (!!x.url && !/^[\w-]{11}$/.test(x.id));
    return {
      kind: post ? ('post' as const) : ('video' as const),
      href: post ? x.url! : `https://www.youtube.com/watch?v=${x.id}`,
    };
  };
  // Per claim: who asserts or denies it, and every verdict recorded on it (verdicts sit on the first source's assertion).
  const claimSources = new Map<string, ClaimSourceView[]>();
  const claimVerdicts = new Map<string, ClaimVerdictView[]>();
  for (const x of recs)
    for (const a of x.assertions ?? []) {
      const list = claimSources.get(a.claim) ?? [];
      list.push({ id: x.id, title: x.title, channel: x.channel ?? '', ...metaOf(x), stance: a.stance, quote: a.quote });
      claimSources.set(a.claim, list);
      for (const v of a.verdicts ?? []) {
        const vs = claimVerdicts.get(a.claim) ?? [];
        const by = v.method === 'prior' || !v.source ? 'AI guess' : docName(v.source);
        const recorded = v.source ? applicability[applicabilityKey(a.claim, v.source)] : undefined;
        const view: ClaimVerdictView = {
          by,
          verdict: v.verdict,
          confidence: v.confidence ?? null,
          note: v.note ?? '',
          cite: v.source ?? null,
          date: v.date ?? null,
          ...(recorded ? { applicability: recorded } : {}),
        };
        // The same verdict re-recorded (say, on a wider range) replaces the older copy instead of being dropped.
        const i = vs.findIndex((o) => o.by === by && o.note === view.note);
        if (i < 0) vs.push(view);
        else if ((view.date ?? '') >= (vs[i].date ?? '')) vs[i] = view;
        claimVerdicts.set(a.claim, vs);
      }
    }

  const claimOf = (c: ReportClaim): ClaimView => ({
    id: c.id,
    text: c.text,
    asserted: c.asserted,
    denied: c.denied,
    verdict: c.effective,
    confidence: c.effective && JUDGED.includes(c.effective) ? c.confidence : null,
    note: c.note ?? '',
    decidedBy: c.source ? docName(c.source) : null,
    studies: c.documents.length,
    lean: lean[c.id] ?? null,
    sources: claimSources.get(c.id) ?? [],
    verdicts: (claimVerdicts.get(c.id) ?? []).sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)),
    revisions: revisions.filter((r) => r.id === c.id),
  });
  const claims = t.claims.map(claimOf).sort((a, b) => b.asserted + b.denied - (a.asserted + a.denied));
  const byId = new Map(claims.map((c) => [c.id, c]));
  const NOVEL_SHARE = 3;
  const sourceClaims = (x: StoreVideo): SourceClaimView[] =>
    (x.assertions ?? [])
      .flatMap((a) => {
        const c = byId.get(a.claim);
        if (!c) return [];
        const e = c.verdict ?? 'unknown';
        const denies = a.stance === 'denies';
        const verdict: Verdict = e === 'right' || e === 'wrong' ? (denies === (e === 'wrong') ? 'right' : 'wrong') : e;
        const share = (denies ? c.denied : c.asserted) + (x.supersededBy ? 1 : 0); // the report's counts skip superseded sources
        return [
          {
            id: c.id,
            text: c.text,
            quote: a.quote,
            stance: a.stance,
            verdict,
            confidence: c.confidence,
            share,
            novel: verdict === 'right' && share <= NOVEL_SHARE,
          },
        ];
      })
      .sort((a, b) => Number(b.novel) - Number(a.novel) || a.share - b.share);

  const sources: SourceView[] = r.videos
    .filter((v) => v.assertions > 0)
    .map((v) => {
      const x = recOf.get(v.id)!;
      return {
        id: v.id,
        title: v.title,
        channel: v.channel,
        ...metaOf(x),
        summary: x.summary ?? '',
        score: v.scaled,
        novelty: v.novelty,
        worthWatching: v.worthWatching,
        superseded: !!x.supersededBy,
        exhibit: record.exhibits[v.id] ?? null,
        claims: sourceClaims(x),
      } satisfies SourceView;
    })
    .sort((a, b) => (b.score ?? -2) - (a.score ?? -2) || b.novelty - a.novelty);
  const counted = sources.filter((s) => !s.superseded);
  const ranked = counted.filter((s) => s.score !== null);
  const durations = counted
    .filter((s) => s.kind === 'video')
    .map((s) => recOf.get(s.id)?.durationSec ?? 0)
    .filter(Boolean)
    .sort((a, b) => a - b);
  const glyphPath = join(dir, 'glyph.svg');

  const surprises = t.surprises
    .map((s) => ({
      s,
      move: Math.abs(VAL[s.evidence] - VAL[s.prior]),
      view: {
        text: s.claim.text,
        saidBy: s.claim.asserted + s.claim.denied,
        prior: s.prior,
        evidence: s.evidence,
        priorConfidence: s.priorRecord.confidence ?? null,
        evidenceConfidence: s.evidenceRecord.confidence ?? null,
        note: s.evidenceRecord.note ?? '',
        study: docName(s.evidenceRecord.source),
      } satisfies SurpriseView,
    }))
    .sort((a, b) => b.move - a.move || b.view.saidBy - a.view.saidBy);

  const hype = claims.filter((c) => lean[c.id] === 'pro-hype');
  const bottomLine =
    cfg.recap?.bottomLine
      ?.replaceAll('{hypeWrong}', String(hype.filter((c) => c.verdict === 'wrong').length))
      .replaceAll('{hypeTotal}', String(hype.length)) ?? null;
  const recap = (
    cfg.recap?.groups ?? [
      { title: 'Most-discussed claims', claims: claims.slice(0, 8).map((c) => c.id.split('/').pop()!) },
    ]
  ).map((g) => ({
    title: g.title,
    claims: g.claims.map((slug) => byId.get(`${t.id}/${slug}`)).filter((c): c is ClaimView => !!c),
  }));

  return {
    name,
    label: t.label ?? name,
    claims,
    sources,
    counted: counted.length,
    posts: counted.filter((s) => s.kind === 'post').length,
    videos: counted.filter((s) => s.kind === 'video').length,
    channels: new Set(counted.map((s) => s.channel)).size,
    hours: durations.reduce((a, b) => a + b, 0) / 3600,
    medianMinutes: durations.length ? durations[Math.floor(durations.length / 2)] / 60 : 0,
    noCaptions: recs.filter((v) => v.transcript === 'none' && !v.assertions).length,
    studies: new Set(t.claims.flatMap((c) => c.documents)).size,
    decided: claims.filter((c) => c.decidedBy).length,
    hero: cfg.hero ?? {},
    glyph: existsSync(glyphPath) ? readFileSync(glyphPath, 'utf8').trim() : null,
    bottomLine,
    recap,
    top: ranked.slice(0, 5),
    next: ranked.slice(5, 10),
    changed: surprises.filter((x) => x.s.overrides).map((x) => x.view),
    held: surprises.filter((x) => !x.s.overrides).map((x) => x.view),
    superseded: recs
      .filter((v) => v.supersededBy)
      .map((v) => ({ title: v.title, by: recOf.get(v.supersededBy!)?.title ?? v.supersededBy! })),
    wrong: t.commonlyWrong.map((c) => byId.get(c.id)!),
    contested: t.contested.map((c) => byId.get(c.id)!),
    docNames: cfg.docs ?? {},
    sameStudy: cfg.sameStudy ?? {},
    revisions,
    revised:
      revisions
        .map((r) => r.at)
        .sort()
        .at(-1) ?? null,
  };
}
