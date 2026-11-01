// topicNext (spec §5.2; phase 5 Task 3): the research stage of a topic and its next step, derived from the files
// alone (the proposal, the lists, the store, the work folder, the sources, the report, the stories and their review),
// with `park` where the topic cannot proceed and `done` only with a ready story or a parked proposal.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../src/shared/automation';
import { toJson } from '../src/shared/io';
import type { Proposal } from '../src/shared/types';
import { RESEARCH_STAGES, stepsOf, topicNext } from '../src/orchestration';
import { FETCHED_FILE, listsFingerprint } from '../src/orchestration/research';
import { TOPIC_RUN_DIR } from '../src/orchestration/run/journal';

const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
const T = 'ev-running-costs';
const a = { ...DEFAULTS, topics: { ...DEFAULTS.topics, minSources: 3, minStudies: 2, minDecided: 0.5 } };
const owner = (claimed: boolean) => () => (claimed ? ({ name: 'Spending' } as never) : null);

interface Shape {
  proposal?: Partial<Proposal> | null;
  videos?: string[];
  blogs?: string[];
  records?: {
    id: string;
    captions?: boolean;
    assertions?: { claim: string; sourceVerdict?: boolean }[];
    chars?: number;
  }[];
  claims?: string[];
  batches?: { file: string; recorded?: boolean }[];
  merges?: boolean;
  documents?: { file: string; judged?: boolean }[];
  studiesRounds?: number;
  report?: 'none' | 'current' | 'stale';
  openRevisions?: number;
  stories?: { id: string; readiness: string; reviewed: boolean; blocking?: string[] }[] | 'none';
  rejected?: { id: string; reason: string }[];
  review?: boolean;
  reviewRounds?: number;
  fetched?: boolean;
}

/** A topic folder in the state the shape describes. */
function topic(s: Shape) {
  const root = mkdtempSync(join(tmpdir(), 'vk-research-next-'));
  roots.push(root);
  writeFileSync(join(root, 'package.json'), '{"name":"video-knowledge"}');
  mkdirSync(join(root, 'proposals'), { recursive: true });
  if (s.proposal !== null)
    writeFileSync(
      join(root, 'proposals', `${T}.json`),
      toJson({ slug: T, institution: 'spending', question: 'Q?', status: 'approved', ...s.proposal }),
    );
  const dir = join(root, 'topics', T);
  if (s.videos || s.records || s.claims || s.report) mkdirSync(dir, { recursive: true });
  if (s.videos) writeFileSync(join(dir, 'videos.txt'), ['# --- Batch 1', ...s.videos].join('\n') + '\n');
  if (s.blogs) writeFileSync(join(dir, 'blogs.txt'), s.blogs.join('\n') + '\n');
  if (s.records || s.claims) {
    // the runner's fetch marker: the lists as they are (the fetch case leaves it out)
    if (s.fetched !== false) {
      mkdirSync(join(dir, 'work', TOPIC_RUN_DIR), { recursive: true });
      writeFileSync(join(dir, 'work', TOPIC_RUN_DIR, FETCHED_FILE), toJson({ lists: listsFingerprint(T, root) }));
    }
    mkdirSync(join(dir, 'store', 'videos'), { recursive: true });
    mkdirSync(join(dir, 'store', 'transcripts'), { recursive: true });
    for (const r of s.records ?? []) {
      writeFileSync(
        join(dir, 'store', 'videos', `${r.id}.json`),
        toJson({
          id: r.id,
          transcript: r.captions === false ? 'none' : 'youtube',
          ...(r.assertions && {
            assertions: r.assertions.map((x) => ({
              claim: `${T}/${x.claim}`,
              stance: 'asserts',
              quote: 'q',
              verdicts: x.sourceVerdict
                ? [{ method: 'source', verdict: 'right', confidence: 0.8, source: `${T}/sources/doc1.txt#L1-L2` }]
                : [{ method: 'prior', verdict: 'right', confidence: 0.5 }],
            })),
          }),
        }),
      );
      if (r.captions !== false)
        writeFileSync(join(dir, 'store', 'transcripts', `${r.id}.txt`), 'x'.repeat(r.chars ?? 1000));
    }
    writeFileSync(
      join(dir, 'store', 'topics.json'),
      toJson({ topics: [{ id: T, label: 'EV', claims: (s.claims ?? []).map((c) => ({ id: `${T}/${c}`, text: c })) }] }),
    );
  }
  if (s.batches || s.merges || s.studiesRounds !== undefined || s.reviewRounds !== undefined || s.documents) {
    mkdirSync(join(dir, 'work', TOPIC_RUN_DIR), { recursive: true });
    for (const b of s.batches ?? []) writeFileSync(join(dir, 'work', b.file), '[]');
    const recorded = (s.batches ?? []).filter((b) => b.recorded).map((b) => `work/${b.file}`);
    const judged = (s.documents ?? []).filter((d) => d.judged).map((d) => d.file);
    writeFileSync(join(dir, 'work', TOPIC_RUN_DIR, 'recorded.json'), toJson({ files: recorded, documents: judged }));
    if (s.merges) writeFileSync(join(dir, 'work', 'merges.json'), '{}');
    if (s.studiesRounds !== undefined)
      writeFileSync(
        join(dir, 'work', TOPIC_RUN_DIR, 'studies-rounds.json'),
        toJson({ rounds: Array.from({ length: s.studiesRounds }, () => ({ at: 'x', added: 0 })) }),
      );
    if (s.reviewRounds !== undefined)
      writeFileSync(join(dir, 'work', TOPIC_RUN_DIR, 'review-rounds.json'), toJson({ rounds: s.reviewRounds }));
  }
  if (s.documents) {
    mkdirSync(join(dir, 'sources'), { recursive: true });
    for (const d of s.documents) writeFileSync(join(dir, 'sources', d.file), 'Source: https://x.test/a\n\nbody\n');
  }
  if (s.report && s.report !== 'none') {
    const n = s.report === 'current' ? (s.claims ?? []).length : (s.claims ?? []).length + 1;
    writeFileSync(
      join(dir, 'report.json'),
      toJson({ topics: [{ id: T, claims: Array.from({ length: n }, (_, i) => ({ id: `c${i}` })) }] }),
    );
    writeFileSync(
      join(dir, 'public-record.json'),
      toJson({
        exhibits: {},
        revisions: Array.from({ length: s.openRevisions ?? 0 }, (_, i) => ({
          kind: 'claim',
          id: `${T}/c${i}`,
          date: '2026-11-01',
          note: '',
        })),
      }),
    );
  }
  if (s.stories && s.stories !== 'none')
    writeFileSync(
      join(dir, 'stories.json'),
      toJson({
        stories: s.stories.map((x) => ({ ...x, blocking: x.blocking ?? [], readinessWhy: '' })),
        rejected: s.rejected ?? [],
        basis: {
          candidates: s.stories.length + (s.rejected ?? []).length,
          claims: (s.claims ?? []).length,
          studies: 0,
        },
      }),
    );
  else if (s.stories === 'none')
    writeFileSync(
      join(dir, 'stories.json'),
      toJson({
        stories: [],
        rejected: s.rejected ?? [],
        basis: { candidates: 0, claims: (s.claims ?? []).length, studies: 0 },
      }),
    );
  if (s.review) writeFileSync(join(dir, 'story-review.json'), '{}');
  return root;
}
const next = (root: string, claimed = true) => topicNext(T, root, { owner: owner(claimed), a });

describe('topicNext', () => {
  it('names the stages in order', () => {
    expect(RESEARCH_STAGES).toEqual([
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
    ]);
  });
  it('no topic folder and no approved proposal: needs-person; a parked proposal: parked, done', () => {
    const none = next(topic({ proposal: null }));
    expect(none).toMatchObject({ stage: 'proposal', done: false });
    expect(none.halt?.kind).toBe('needs-person');
    const proposed = next(topic({ proposal: { status: 'proposed' } }));
    expect(proposed.halt?.kind).toBe('needs-person');
    const parked = next(topic({ proposal: { status: 'parked', parkedWhy: 'thin' } }));
    expect(parked).toMatchObject({ stage: 'parked', done: true });
  });
  it('lists: an approved proposal and no videos.txt asks the collect agent', () => {
    const n = next(topic({}));
    expect(n.stage).toBe('lists');
    expect(n.next).toBe(`agent: src/modules/evidence/briefs/collect.md -> topics/${T}/videos.txt`);
    expect(stepsOf(n.next, T)).toHaveLength(1);
    expect(n.done).toBe(false);
  });
  it('fetch: lists the runner has not fetched (no marker) run the watcher on both lists; a listed video without a record does not keep it pending', () => {
    const n = next(
      topic({
        videos: ['https://www.youtube.com/watch?v=aaaaaaaaaaa'],
        blogs: ['https://x.test/post'],
        records: [],
        fetched: false,
      }),
    );
    expect(n.stage).toBe('fetch');
    expect(n.next).toBe(
      `npm run watcher -- fetch topics/${T}/videos.txt --store topics/${T}/store, then npm run watcher -- fetch topics/${T}/blogs.txt --store topics/${T}/store`,
    );
    expect(stepsOf(n.next, T).every((s) => s.kind === 'run')).toBe(true);
    // fetched, with one listed video that left no record (no captions, or gone): extract, not fetch again
    const m = next(
      topic({
        videos: ['https://www.youtube.com/watch?v=aaaaaaaaaaa', 'https://www.youtube.com/watch?v=bbbbbbbbbbb'],
        records: [{ id: 'a' }],
      }),
    );
    expect(m.stage).toBe('extract');
  });
  it('extract: fetched sources without assertions make groups and one extraction agent per group (sized by the transcript cache)', () => {
    const n = next(
      topic({
        videos: [
          'https://www.youtube.com/watch?v=aaaaaaaaaaa',
          'https://www.youtube.com/watch?v=bbbbbbbbbbb',
          'https://www.youtube.com/watch?v=ccccccccccc',
        ],
        records: [
          { id: 'a', chars: 300_000 },
          { id: 'b', chars: 300_000 },
          { id: 'c', captions: false },
        ],
      }),
    );
    expect(n.stage).toBe('extract');
    expect(n.next).toBe(
      `npm run evidence -- groups ${T}, then agent: src/modules/evidence/briefs/extract.md (grp1) -> topics/${T}/work/h1.json, then agent: src/modules/evidence/briefs/extract.md (grp2) -> topics/${T}/work/h2.json`,
    );
    const steps = stepsOf(n.next, T);
    expect(steps).toHaveLength(3);
    expect(steps[1]).toMatchObject({ kind: 'prompt' });
    expect(steps[1].text).toContain('Group: 1');
    expect(steps[2].text).toContain('Group: 2');
    expect(steps[1].text).toContain(`Write: topics/${T}/work/h1.json`);
  });
  it('merge: unrecorded batches run dedupe, the merge agent, collide, merge-claims and record per batch (the label on an empty store)', () => {
    const n = next(
      topic({
        videos: ['https://www.youtube.com/watch?v=aaaaaaaaaaa'],
        records: [{ id: 'a' }],
        batches: [{ file: 'h1.json' }, { file: 'h2.json' }],
      }),
    );
    expect(n.stage).toBe('merge');
    expect(n.next).toBe(
      [
        `npm run evidence -- dedupe ${T}`,
        `agent: src/modules/evidence/briefs/merge.md -> topics/${T}/work/merges.json`,
        `npm run evidence -- collide ${T}`,
        `npm run merge-claims -- topics/${T}/work/merges.json topics/${T}/work/h1.json topics/${T}/work/h2.json`,
        `npm run record -- ${T} topics/${T}/work/h1.json --label "Ev Running Costs"`,
        `npm run record -- ${T} topics/${T}/work/h2.json`,
      ].join(', then '),
    );
    // a store with claims already: no label; a recorded batch is left alone
    const m = next(
      topic({
        videos: ['https://www.youtube.com/watch?v=aaaaaaaaaaa'],
        records: [{ id: 'a' }],
        claims: ['c1'],
        batches: [{ file: 'h1.json', recorded: true }, { file: 'h2.json' }],
      }),
    );
    expect(m.next).toContain(`npm run record -- ${T} topics/${T}/work/h2.json`);
    expect(m.next).not.toContain('--label');
    expect(m.next).not.toContain('h1.json');
  });
  it('studies: few documents asks the studies agent; unjudged documents go to sources agents in batches of six and record-sources; two empty rounds while thin park the topic', () => {
    const base = {
      videos: ['https://www.youtube.com/watch?v=aaaaaaaaaaa'],
      records: [
        { id: 'a', assertions: [{ claim: 'c1' }, { claim: 'c2' }] },
        { id: 'b', assertions: [{ claim: 'c1' }] },
        { id: 'c', assertions: [{ claim: 'c2' }] },
      ],
      claims: ['c1', 'c2'],
      batches: [{ file: 'h1.json', recorded: true }],
    };
    const n = next(topic({ ...base, documents: [] }));
    expect(n.stage).toBe('studies');
    expect(n.next).toBe(`agent: src/modules/evidence/briefs/studies.md -> topics/${T}/sources/`);
    const docs = Array.from({ length: 7 }, (_, i) => ({ file: `d${i}.txt` }));
    const j = next(topic({ ...base, documents: docs }));
    expect(j.stage).toBe('studies');
    expect(j.next).toBe(
      `agent: src/modules/evidence/briefs/sources.md (docs:d0.txt,d1.txt,d2.txt,d3.txt,d4.txt,d5.txt) -> topics/${T}/work/sv_1.json, then agent: src/modules/evidence/briefs/sources.md (docs:d6.txt) -> topics/${T}/work/sv_2.json, then npm run record-sources -- ${T} topics/${T}/work/sv_1.json topics/${T}/work/sv_2.json`,
    );
    const steps = stepsOf(j.next, T);
    expect(steps[0].text).toContain('Documents: d0.txt, d1.txt, d2.txt, d3.txt, d4.txt, d5.txt');
    // judged but still thin on decided claims after two empty rounds: parked
    const p = next(
      topic({
        ...base,
        documents: [
          { file: 'd0.txt', judged: true },
          { file: 'd1.txt', judged: true },
        ],
        studiesRounds: 2,
      }),
    );
    expect(p.stage).toBe('studies');
    expect(p.park?.why).toMatch(/thin/);
    expect(p.park?.why).toMatch(/0 of 2 claims decided/);
    expect(p.done).toBe(false);
    // one empty round: the studies agent again
    const again = next(
      topic({
        ...base,
        documents: [
          { file: 'd0.txt', judged: true },
          { file: 'd1.txt', judged: true },
        ],
        studiesRounds: 1,
      }),
    );
    expect(again.park).toBeUndefined();
    expect(again.next).toContain('studies.md');
  });
  it('report, claim, stories, review, ready', () => {
    const sufficient = {
      videos: ['https://www.youtube.com/watch?v=aaaaaaaaaaa'],
      records: [
        { id: 'a', assertions: [{ claim: 'c1', sourceVerdict: true }, { claim: 'c2' }] },
        { id: 'b', assertions: [{ claim: 'c1', sourceVerdict: true }] },
        { id: 'c', assertions: [{ claim: 'c2', sourceVerdict: true }] },
      ],
      claims: ['c1', 'c2'],
      batches: [{ file: 'h1.json', recorded: true }],
      documents: [
        { file: 'd0.txt', judged: true },
        { file: 'd1.txt', judged: true },
      ],
    };
    const r = next(topic({ ...sufficient, report: 'none' }));
    expect(r.stage).toBe('report');
    expect(r.next).toBe('npm run report');
    const stale = next(topic({ ...sufficient, report: 'stale', openRevisions: 1 }));
    expect(stale.stage).toBe('report');
    expect(stale.next).toBe(
      `npm run report, then agent: src/modules/evidence/briefs/revision-note.md -> topics/${T}/public-record.json`,
    );
    const c = next(topic({ ...sufficient, report: 'current' }), false);
    expect(c.stage).toBe('claim');
    expect(c.next).toBe(`npm run topics -- claim ${T} spending, then npm run brand`);
    const s = next(topic({ ...sufficient, report: 'current' }));
    expect(s.stage).toBe('stories');
    expect(s.next).toBe(`npm run stories -- discover ${T}`);
    const noCandidate = next(topic({ ...sufficient, report: 'current', stories: 'none' }));
    expect(noCandidate.stage).toBe('stories');
    expect(noCandidate.park?.why).toMatch(/no story candidate/);
    const review = next(
      topic({
        ...sufficient,
        report: 'current',
        stories: [{ id: 'decision:x', readiness: 'needs-review', reviewed: false }],
      }),
    );
    expect(review.stage).toBe('review');
    expect(review.next).toBe(
      `agent: src/modules/stories/briefs/stories.md -> topics/${T}/story-review.json, then npm run stories -- discover ${T}`,
    );
    const keptNone = next(
      topic({
        ...sufficient,
        report: 'current',
        stories: 'none',
        rejected: [{ id: 'decision:x', reason: 'not a story' }],
        review: true,
        reviewRounds: 1,
      }),
    );
    expect(keptNone.stage).toBe('review');
    expect(keptNone.park?.why).toMatch(/kept no story.*not a story/);
    const ready = next(
      topic({
        ...sufficient,
        report: 'current',
        stories: [{ id: 'decision:x', readiness: 'ready', reviewed: true }],
        review: true,
      }),
    );
    expect(ready).toMatchObject({ stage: 'ready', done: true });
    // needs-research after a review: the studies again while rounds remain, else parked
    const gap = next(
      topic({
        ...sufficient,
        report: 'current',
        stories: [{ id: 'decision:x', readiness: 'needs-research', reviewed: true, blocking: ['no study on c2'] }],
        review: true,
        reviewRounds: 1,
      }),
    );
    expect(gap.stage).toBe('studies');
    expect(gap.next).toContain('studies.md');
    const spent = next(
      topic({
        ...sufficient,
        report: 'current',
        stories: [{ id: 'decision:x', readiness: 'needs-research', reviewed: true, blocking: ['no study on c2'] }],
        review: true,
        reviewRounds: 1,
        studiesRounds: 2,
      }),
    );
    expect(spent.park?.why).toMatch(/no study on c2/);
  });
});
