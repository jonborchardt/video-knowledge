// The research stage of a topic and its next step (spec §5.2; phase 5 Task 3): `topicNext` is `boardNext`'s sibling
// for the research pipeline, derived from the files alone (the approved proposal, the lists, the store, the work
// folder's batches and the runner's markers, the documents, the report, the stories and their review). Stage order
// is fixed; a later stage never runs while an earlier one is pending. `park` is set where the topic cannot proceed
// (thin after two empty study rounds, no story candidate, a review that keeps none, a research gap the rounds
// cannot close): the topic runner acts on it with `topics -- park`; nothing here parks or halts anything itself.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { type Commission, commissionOf } from '../config/site';
import { type Automation, loadAutomation } from '../shared/automation';
import { ROOT, readJson, sha, topicDir } from '../shared/io';
import type { Proposal, PublicRecord } from '../shared/types';
import { splitGroups, thinness } from '../modules/evidence';
import { loadStories } from '../modules/stories';
import { proposalPath } from '../modules/topic-discovery';
import { type Step, stepsOf } from './production';
import { TOPIC_RUN_DIR } from './run/journal';

export const RESEARCH_STAGES = [
  'proposal',
  'lists',
  'fetch',
  'extract',
  'merge',
  'studies',
  'report',
  'claim',
  'stories',
  'review',
  'ready',
  'parked',
] as const;
export type ResearchStage = (typeof RESEARCH_STAGES)[number];

export interface TopicNext {
  topic: string;
  stage: ResearchStage;
  next: string;
  steps: Step[];
  halt: { kind: 'missing' | 'pending' | 'needs-person' | 'no-institution'; why: string } | null;
  done: boolean;
  /** The stage's own check says the topic cannot proceed: the runner parks it with this reason. */
  park?: { why: string };
}

/** The runner's markers under topics/<topic>/work/run/: the batch and verdict files `record` and `record-sources`
 *  consumed, the documents handed to a sources agent and recorded. */
export interface RecordedMarker {
  files: string[]; // work/h1.json, work/sv_1.json
  documents: string[]; // sources/<file>.txt handed to a sources agent and recorded (verdict or none)
}
export interface StudiesRounds {
  rounds: { at: string; added: number }[]; // one per studies agent run: the documents it added
}
export interface ReviewRounds {
  rounds: number; // stories.md agent runs
}
/** The runner's marker after a fetch: the lists it fetched (their fingerprint). The store's count cannot say whether
 *  a fetch ran: the watcher makes no record for an unavailable video. */
export interface FetchedMarker {
  lists: string;
}
export const FETCHED_FILE = 'fetched.json';
/** The lists as they are now: the fingerprint of videos.txt and blogs.txt (blank and comment lines aside). */
export const listsFingerprint = (topic: string, root = ROOT): string =>
  sha(
    [
      ...nonBlank(join(topicDir(topic, root), 'videos.txt')),
      '|',
      ...nonBlank(join(topicDir(topic, root), 'blogs.txt')),
    ].join('\n'),
  );

const BRIEFS = 'src/modules/evidence/briefs';
const STORIES_BRIEF = 'src/modules/stories/briefs/stories.md';
export const DOCS_PER_SOURCES_AGENT = 6;
export const STUDIES_ROUNDS = 2;

const nonBlank = (p: string): string[] =>
  existsSync(p)
    ? readFileSync(p, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
    : [];
const files = (dir: string, re: RegExp): string[] =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => re.test(f))
        .sort()
    : [];
const labelOf = (slug: string) =>
  slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

interface StoreRecord {
  id: string;
  transcript?: string;
  assertions?: { claim: string; verdicts?: { method: string; verdict: string; source?: string }[] }[];
}

export function topicNext(
  topic: string,
  root = ROOT,
  opts: { owner?: (topic: string) => Commission | null; a?: Automation } = {},
): TopicNext {
  const owner = opts.owner ?? commissionOf;
  const a = opts.a ?? loadAutomation(root);
  const dir = topicDir(topic, root);
  const rel = `topics/${topic}`;
  const answer = (stage: ResearchStage, next: string, extra: Partial<TopicNext> = {}): TopicNext => ({
    topic,
    stage,
    next,
    steps: next ? stepsOf(next, topic) : [],
    halt: null,
    done: false,
    ...extra,
  });
  const proposal = readJson<Proposal>(proposalPath(topic, root));
  if (proposal?.status === 'parked')
    return answer('parked', `parked: ${proposal.parkedWhy ?? ''}`.trim(), { steps: [], done: true });
  const folder = existsSync(dir);
  if (!folder && proposal?.status !== 'approved')
    return answer(
      'proposal',
      proposal ? `the proposal is ${proposal.status}, not approved` : `no approved proposal for ${topic}`,
      {
        steps: [],
        halt: {
          kind: 'needs-person',
          why: proposal
            ? `proposals/${topic}.json is ${proposal.status}; only an approved proposal is researched`
            : `no proposals/${topic}.json`,
        },
      },
    );

  // lists
  const videos = nonBlank(join(dir, 'videos.txt'));
  const blogs = nonBlank(join(dir, 'blogs.txt'));
  if (!videos.length) return answer('lists', `agent: ${BRIEFS}/collect.md -> ${rel}/videos.txt`);

  // fetch: pending until the runner fetched these lists (a listed video without captions or no longer available has
  // no record, so the counts cannot decide it)
  const store = join(dir, 'store');
  const records: StoreRecord[] = files(join(store, 'videos'), /\.json$/).map((f) =>
    readJson<StoreRecord>(join(store, 'videos', f))!,
  );
  const work = join(dir, 'work');
  const fetched = readJson<FetchedMarker>(join(work, TOPIC_RUN_DIR, FETCHED_FILE));
  if (fetched?.lists !== listsFingerprint(topic, root))
    return answer(
      'fetch',
      [
        `npm run watcher -- fetch ${rel}/videos.txt --store ${rel}/store`,
        ...(blogs.length ? [`npm run watcher -- fetch ${rel}/blogs.txt --store ${rel}/store`] : []),
      ].join(', then '),
    );

  // extract: fetched records without assertions (and with a transcript), grouped by the cached transcript's size
  const marker = readJson<RecordedMarker>(join(work, TOPIC_RUN_DIR, 'recorded.json')) ?? { files: [], documents: [] };
  const batchFiles = files(work, /^h\d+\.json$/).sort((x, y) => Number(x.slice(1, -5)) - Number(y.slice(1, -5)));
  const unrecorded = batchFiles.filter((f) => !marker.files.includes(`work/${f}`));
  const raw = records.filter((r) => !r.assertions && r.transcript !== 'none');
  if (raw.length && !unrecorded.length) {
    const entries = raw.map((r) => {
      const t = join(store, 'transcripts', `${r.id}.txt`);
      return { id: r.id, chars: existsSync(t) ? statSync(t).size : 50_000 };
    });
    const groups = splitGroups(entries);
    const first = batchFiles.length ? Math.max(...batchFiles.map((f) => Number(f.slice(1, -5)))) + 1 : 1;
    return answer(
      'extract',
      [
        `npm run evidence -- groups ${topic}`,
        ...groups.map((_, i) => `agent: ${BRIEFS}/extract.md (grp${i + 1}) -> ${rel}/work/h${first + i}.json`),
      ].join(', then '),
    );
  }

  // merge and record
  const claims =
    readJson<{ topics: { id: string; claims: { id: string; text: string }[] }[] }>(
      join(store, 'topics.json'),
    )?.topics.find((t) => t.id === topic)?.claims ?? [];
  if (unrecorded.length) {
    const label = claims.length ? '' : ` --label "${labelOf(topic)}"`;
    return answer(
      'merge',
      [
        `npm run evidence -- dedupe ${topic}`,
        `agent: ${BRIEFS}/merge.md -> ${rel}/work/merges.json`,
        `npm run evidence -- collide ${topic}`,
        `npm run merge-claims -- ${rel}/work/merges.json ${unrecorded.map((f) => `${rel}/work/${f}`).join(' ')}`,
        ...unrecorded.map((f, i) => `npm run record -- ${topic} ${rel}/work/${f}${i === 0 ? label : ''}`),
      ].join(', then '),
    );
  }

  // studies: documents judged, the thinness, the rounds
  const documents = files(join(dir, 'sources'), /\.txt$/);
  const cited = new Set<string>();
  const decided = new Set<string>();
  for (const r of records)
    for (const as of r.assertions ?? [])
      for (const v of as.verdicts ?? []) {
        if (v.method !== 'source') continue;
        if (v.source) cited.add(v.source.split('#')[0].split('/').pop()!);
        if (['right', 'wrong', 'partly'].includes(v.verdict)) decided.add(as.claim);
      }
  const unjudged = documents.filter((d) => !cited.has(d) && !marker.documents.includes(d));
  if (unjudged.length) {
    const svFiles = files(work, /^sv_\d+\.json$/);
    const first = svFiles.length ? Math.max(...svFiles.map((f) => Number(f.slice(3, -5)))) + 1 : 1;
    const batches: string[][] = [];
    for (let i = 0; i < unjudged.length; i += DOCS_PER_SOURCES_AGENT)
      batches.push(unjudged.slice(i, i + DOCS_PER_SOURCES_AGENT));
    const svs = batches.map((_, i) => `${rel}/work/sv_${first + i}.json`);
    return answer(
      'studies',
      [
        ...batches.map((b, i) => `agent: ${BRIEFS}/sources.md (docs:${b.join(',')}) -> ${svs[i]}`),
        `npm run record-sources -- ${topic} ${svs.join(' ')}`,
      ].join(', then '),
    );
  }
  const counts = {
    sources: records.length,
    withCaptions: records.filter((r) => r.transcript && r.transcript !== 'none').length,
    documents: documents.length,
    claims: claims.length,
    decided: decided.size,
  };
  const thin = thinness(counts, a.topics);
  const rounds = readJson<StudiesRounds>(join(work, TOPIC_RUN_DIR, 'studies-rounds.json'))?.rounds ?? [];
  const emptyRounds = rounds.filter((r) => r.added === 0).length;
  const studiesStep = `agent: ${BRIEFS}/studies.md -> ${rel}/sources/`;
  if (
    thin.thin &&
    (counts.documents < a.topics.minStudies ||
      counts.claims === 0 ||
      counts.decided / Math.max(1, counts.claims) < a.topics.minDecided)
  ) {
    if (emptyRounds >= STUDIES_ROUNDS)
      return answer('studies', studiesStep, {
        steps: [],
        park: { why: `${thin.why} after ${emptyRounds} study rounds that added nothing` },
      });
    return answer('studies', studiesStep);
  }

  // report
  const report = readJson<{ topics: { claims: unknown[] }[] }>(join(dir, 'report.json'));
  if (!report || (report.topics[0]?.claims.length ?? -1) !== claims.length) {
    const open = (readJson<PublicRecord>(join(dir, 'public-record.json'))?.revisions ?? []).filter(
      (r) => !r.note.trim(),
    ).length;
    return answer(
      'report',
      ['npm run report', ...(open ? [`agent: ${BRIEFS}/revision-note.md -> ${rel}/public-record.json`] : [])].join(
        ', then ',
      ),
    );
  }
  const openNotes = (readJson<PublicRecord>(join(dir, 'public-record.json'))?.revisions ?? []).filter(
    (r) => !r.note.trim(),
  ).length;
  if (openNotes) return answer('report', `agent: ${BRIEFS}/revision-note.md -> ${rel}/public-record.json`);

  // claim
  if (!owner(topic)) {
    if (!proposal?.institution)
      return answer('claim', `stop: no institution claims ${topic} and no proposal names one`, {
        steps: [],
        halt: { kind: 'no-institution', why: `no proposals/${topic}.json names an institution` },
      });
    return answer('claim', `npm run topics -- claim ${topic} ${proposal.institution}, then npm run brand`);
  }

  // stories and their review
  const stories = loadStories(topic, root);
  const reportAt = statSync(join(dir, 'report.json')).mtimeMs;
  const storiesStale =
    stories && (statSync(join(dir, 'stories.json')).mtimeMs < reportAt || stories.basis.claims !== claims.length);
  if (!stories || storiesStale) return answer('stories', `npm run stories -- discover ${topic}`);
  if (!stories.stories.length && !stories.rejected.length)
    return answer('stories', `npm run stories -- discover ${topic}`, {
      steps: [],
      park: { why: 'no story candidate: the claims and verdicts make no story worth a video' },
    });
  const reviewed = stories.stories.every((s) => s.reviewed);
  const reviewRounds = readJson<ReviewRounds>(join(work, TOPIC_RUN_DIR, 'review-rounds.json'))?.rounds ?? 0;
  if (stories.stories.some((s) => s.readiness === 'ready'))
    return answer(
      'ready',
      `ready: ${stories.stories.filter((s) => s.readiness === 'ready').length} ready stor${stories.stories.filter((s) => s.readiness === 'ready').length === 1 ? 'y' : 'ies'}`,
      { steps: [], done: true },
    );
  const reviewStep = `agent: ${STORIES_BRIEF} -> ${rel}/story-review.json, then npm run stories -- discover ${topic}`;
  if (!stories.stories.length) {
    // every candidate rejected: the review kept none (or the code did, before any review ran)
    if (reviewRounds >= 1 || existsSync(join(dir, 'story-review.json')))
      return answer('review', reviewStep, {
        steps: [],
        park: {
          why: `the story review kept no story: ${stories.rejected
            .map((r) => r.reason)
            .slice(0, 3)
            .join('; ')}`,
        },
      });
    return answer('review', reviewStep);
  }
  if (!reviewed || (reviewRounds < 1 && stories.stories.some((s) => s.readiness === 'needs-review')))
    return answer('review', reviewStep);
  const gaps = stories.stories.filter((s) => s.readiness === 'needs-research');
  if (gaps.length) {
    const why =
      gaps
        .flatMap((s) => s.blocking)
        .slice(0, 3)
        .join('; ') || 'the stories need evidence the research did not find';
    if (emptyRounds >= STUDIES_ROUNDS || rounds.length >= STUDIES_ROUNDS + 1)
      return answer('studies', studiesStep, {
        steps: [],
        park: { why: `the research gap stays after ${rounds.length} study rounds: ${why}` },
      });
    return answer('studies', studiesStep);
  }
  return answer('review', reviewStep, {
    steps: [],
    park: {
      why: `the review settled nothing: ${stories.stories
        .map((s) => s.blocking[0] ?? s.readinessWhy)
        .slice(0, 3)
        .join('; ')}`,
    },
  });
}
