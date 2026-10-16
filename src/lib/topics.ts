// Turn a topic folder (report.json from the watcher library, plus store/, site.json, lean.json) into page data.
// The report already decides each claim's verdict; nothing here re-judges.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type Verdict = 'right' | 'wrong' | 'partly' | 'untestable' | 'unknown';
const JUDGED: Verdict[] = ['right', 'wrong', 'partly'];

// The slice of `watcher report --json` this site reads.
interface VerdictRecord {
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
  assertions?: { claim: string; stance: 'asserts' | 'denies'; quote: string }[];
}
interface SiteConfig {
  hero?: { title?: string; lede?: string }; // hand-written hook at the top of the topic page
  recap?: { bottomLine?: string; groups?: { title: string; claims: string[] }[] };
  docs?: Record<string, string>;
}

export interface ClaimView {
  id: string;
  text: string;
  asserted: number;
  denied: number;
  verdict: Verdict | null;
  confidence: number | null;
  note: string;
  decidedBy: string | null; // a study's display name, or null when the AI guess decides
  studies: number; // documents with a verdict on this claim
}
export interface SourceClaimView {
  id: string;
  text: string;
  quote: string;
  stance: 'asserts' | 'denies';
  verdict: Verdict; // for this source: denying a wrong claim is right
  share: number; // sources taking the same stance, this one included
  novel: boolean; // right and few others say it
}
export interface SourceView {
  id: string;
  title: string;
  channel: string;
  kind: 'video' | 'post';
  href: string;
  summary: string;
  score: number | null;
  novelty: number;
  worthWatching: string;
  superseded: boolean;
  claims: SourceClaimView[]; // novel first, rarest first
}
export interface SurpriseView {
  text: string;
  saidBy: number;
  prior: Verdict;
  evidence: Verdict;
  priorConfidence: number | null;
  evidenceConfidence: number | null;
  note: string;
  study: string;
}
export interface Topic {
  name: string;
  label: string;
  claims: ClaimView[];
  sources: SourceView[];
  counted: number;
  videos: number;
  posts: number;
  channels: number; // distinct channels and authors among counted sources
  hours: number; // total runtime of counted videos
  medianMinutes: number;
  noCaptions: number;
  studies: number;
  decided: number;
  hero: { title: string | null; lede: string | null };
  glyph: string | null; // <topic>/glyph.svg, inlined on the home card
  bottomLine: string | null;
  recap: { title: string; claims: ClaimView[] }[];
  top: SourceView[];
  next: SourceView[];
  changed: SurpriseView[];
  held: SurpriseView[];
  superseded: { title: string; by: string }[];
  wrong: ClaimView[];
  contested: ClaimView[];
}

const ROOT = process.cwd();
const readJson = <T>(p: string): T | null => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : null);
const VAL: Record<string, number> = { right: 1, partly: 0.5, wrong: -1 };

/** Topic folders that have a report with claims. */
export function topicNames(): string[] {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && existsSync(join(ROOT, d.name, 'report.json')))
    .map((d) => d.name)
    .filter((n) => (readJson<Report>(join(ROOT, n, 'report.json'))?.topics[0]?.claims.length ?? 0) > 0);
}

export function loadTopic(name: string): Topic {
  const dir = join(ROOT, name);
  const r = readJson<Report>(join(dir, 'report.json'))!;
  const t = r.topics[0];
  const cfg = readJson<SiteConfig>(join(dir, 'site.json')) ?? {};
  const lean = readJson<Record<string, string>>(join(dir, 'lean.json')) ?? {};
  const recs = readdirSync(join(dir, 'store', 'videos')).map(
    (f) => JSON.parse(readFileSync(join(dir, 'store', 'videos', f), 'utf8')) as StoreVideo,
  );
  const recOf = new Map(recs.map((v) => [v.id, v]));
  const docName = (src?: string | null) => {
    const f = (src ?? '').split('#')[0].split('/').pop() ?? '';
    return cfg.docs?.[f] ?? f;
  };

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
      const post = x.transcript === 'article' || (!!x.url && !/^[\w-]{11}$/.test(v.id));
      return {
        id: v.id,
        title: v.title,
        channel: v.channel,
        kind: post ? 'post' : 'video',
        href: post ? x.url! : `https://www.youtube.com/watch?v=${v.id}`,
        summary: x.summary ?? '',
        score: v.scaled,
        novelty: v.novelty,
        worthWatching: v.worthWatching,
        superseded: !!x.supersededBy,
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
    hero: { title: cfg.hero?.title ?? null, lede: cfg.hero?.lede ?? null },
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
  };
}
