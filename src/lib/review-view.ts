// The review page's model (src/admin/review.astro): one output's packaged build (the video, or one of its Shorts), the
// findings placed at the moment they occur, the ledger's decisions per build, and what a person can do next (or why not).
// Read-only: the decisions are written by the publish verbs. Library layer: the timeline is read through a local shape,
// never src/video/.
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { BuildSummary } from './build-report';
import { ROOT, readJson } from './io';
import {
  type OutputState,
  type OutputStatus,
  type PublishEvent,
  type ReviewNote,
  Refusal,
  openOutput,
} from './publish';
import { FILES, type ScriptValidation, scriptDir, shortId, shortOf, storySlug } from './script';
import { loadShorts } from './shorts';
import { loadStories } from './stories';

export interface Moment {
  label: string;
  seconds: number;
  scene: string;
  sentence?: string;
}
export interface Finding {
  source: 'qa' | 'validation' | 'review' | 'pacing';
  severity: 'blocking' | 'warning' | 'info';
  text: string;
  at: Moment | null;
}
type Can = string | true; // true, or why not
export interface ReviewView {
  topic: string;
  storyId: string; // a Short's id is <story-id>/shorts/<slug>
  path: string; // its folder under topics/<topic>/scripts/
  kind: 'youtube-video' | 'youtube-short';
  title: string; // the composed upload title: what an approval binds and what goes live
  parent: { storyId: string; path: string; title: string; status: OutputStatus | 'not-packaged' } | null; // a Short's
  shorts: { storyId: string; path: string; title: string; status: OutputStatus | 'not-packaged' }[]; // a video's
  pkg: {
    title: string;
    status: 'draft' | 'release';
    mp4: string;
    mp4Sha: string;
    seconds: number;
    portrait: boolean;
    checklist: string[];
    chapters: Moment[];
    qaOk: boolean;
  } | null;
  scenes: Moment[];
  sentences: { id: string; text: string; at: Moment }[];
  findings: Finding[]; // failed QA first, then blocking, warnings, info
  state: OutputState | null;
  output: string | null;
  history: { build: string; current: boolean; events: PublishEvent[] }[]; // newest first
  can: { approve: Can; requestChanges: Can; acceptDraft: Can; upload: Can; goLive: Can };
}

interface TimelineLite {
  fps: number;
  width?: number;
  height?: number;
  scenes: { id: string; start: number; sentences: { id: string; start: number; text: string }[] }[];
}
interface ReviewJsonLite {
  title: string;
  status: string;
  mp4: string;
  mp4Sha: string;
  seconds: number;
  checklist?: string[];
  chapters?: { scene: string; seconds: number; title: string }[];
}
const PACING = new Set(['slow-start', 'number-dense', 'repetition']);
const RANK = { blocking: 0, warning: 1, info: 2 } as const;

const packageOf = (dir: string) => readJson<ReviewJsonLite>(join(dir, 'video', 'review', 'review.json'));
const pathOf = (topic: string, storyId: string, root: string) =>
  relative(join(root, 'topics', topic, 'scripts'), scriptDir(topic, storyId, root))
    .split(/[\\/]/)
    .join('/');
/** The output's ledger view, or null when it has none yet (a Short before its package records it). */
function ledgerOf(topic: string, storyId: string, root: string) {
  try {
    return openOutput(topic, storyId, { root });
  } catch (e) {
    if (e instanceof Refusal) return null;
    throw e;
  }
}
const statusOf = (topic: string, storyId: string, root: string): OutputStatus | 'not-packaged' =>
  packageOf(scriptDir(topic, storyId, root))
    ? (ledgerOf(topic, storyId, root)?.state.status ?? 'not-uploaded')
    : 'not-packaged';

/** Groups the output's events by the build they are about: an event without a build belongs to the upload it names. */
function historyOf(events: PublishEvent[], current: string | null): ReviewView['history'] {
  const byId = new Map<string, string>();
  const groups = new Map<string, PublishEvent[]>();
  let last = current ?? '';
  for (const e of events) {
    if (e.type === 'uploaded' && e.id && e.build) byId.set(e.id, e.build);
    const build = e.build ?? (e.id ? byId.get(e.id) : undefined) ?? last;
    last = build;
    groups.set(build, [...(groups.get(build) ?? []), e]);
  }
  return [...groups.entries()].reverse().map(([build, evs]) => ({ build, current: build === current, events: evs }));
}

export function reviewView(topic: string, storyId: string, root = ROOT): ReviewView {
  const dir = scriptDir(topic, storyId, root);
  const short = shortOf(storyId);
  const rp = packageOf(dir);
  const tl = readJson<TimelineLite>(join(dir, 'video', 'timeline.json'));
  const vr = readJson<BuildSummary>(join(dir, 'video', 'build-report.json'));
  const v = readJson<ScriptValidation>(join(dir, FILES.validation));
  const o = ledgerOf(topic, storyId, root);

  const fps = tl?.fps ?? 30;
  const scenes: Moment[] = (tl?.scenes ?? []).map((s) => ({ label: s.id, seconds: s.start / fps, scene: s.id }));
  const sentences = (tl?.scenes ?? []).flatMap((s) =>
    s.sentences.map((x) => ({
      id: x.id,
      text: x.text,
      at: { label: x.id, seconds: x.start / fps, scene: s.id, sentence: x.id },
    })),
  );
  const momentOf = (at: { scene?: string; sentence?: string }): Moment | null =>
    (at.sentence && sentences.find((s) => s.id === at.sentence)?.at) ||
    (at.scene && scenes.find((s) => s.scene === at.scene)) ||
    null;

  const findings: Finding[] = [
    ...(vr?.qa.checks ?? [])
      .filter((c) => !c.ok)
      .map((c): Finding => ({
        source: 'qa',
        severity: 'blocking',
        text: `${c.name}${c.detail ? `: ${c.detail}` : ''}`,
        at: momentOf(c),
      })),
    ...(v?.issues ?? [])
      .map((i): Finding => ({
        source: i.by === 'review' ? 'review' : PACING.has(i.category) ? 'pacing' : 'validation',
        severity: i.disposition ? 'info' : i.severity,
        text: `${i.category}: ${i.explanation}${i.disposition ? ` (retired: ${i.disposition})` : ''}`,
        at: momentOf({ sentence: i.sentence }),
      }))
      .sort((a, b) => RANK[a.severity] - RANK[b.severity]),
  ];

  const pkg: ReviewView['pkg'] = rp
    ? {
        title: rp.title,
        status: rp.status === 'release build' ? 'release' : 'draft',
        mp4: rp.mp4,
        mp4Sha: rp.mp4Sha,
        seconds: rp.seconds,
        portrait: !!short || (!!tl?.height && !!tl.width && tl.height > tl.width),
        checklist: rp.checklist ?? [],
        chapters: (rp.chapters ?? []).map((c) => ({ label: c.title, seconds: c.seconds, scene: c.scene })),
        qaOk: vr?.qa.ok ?? false,
      }
    : null;

  const state = o?.state ?? null;
  const no = (why: string): Can => why;
  const live = state?.live ? no(`live at ${state.url}; a re-release is a new output`) : null;
  const can: ReviewView['can'] = {
    approve: !pkg
      ? no('no review package yet')
      : (live ??
        (pkg.status === 'draft'
          ? no('a draft (edge voice) is never approved: Accept draft makes the release build')
          : !pkg.qaOk
            ? no('QA failed on this build')
            : !o
              ? no('no ledger entry yet: npm run video -- package records it')
              : state!.status === 'approved' || state!.status === 'scheduled'
                ? no(`already ${state!.status}`)
                : true)),
    requestChanges: !pkg
      ? no('no review package yet')
      : !o
        ? no('no ledger entry yet')
        : (live ?? (state!.status === 'scheduled' ? no('scheduled on YouTube: unschedule it there first') : true)),
    acceptDraft: !pkg ? no('no review package yet') : pkg.status === 'release' ? no('this is the release build') : true,
    upload: !pkg
      ? no('no review package yet')
      : !o
        ? no('no ledger entry yet')
        : !state!.id || state!.status === 'build-behind'
          ? true
          : no(`uploaded (${state!.status})`),
    goLive: !o
      ? no('no ledger entry yet')
      : state!.status === 'metadata-behind' && !state!.live
        ? no('the title, description or thumbnail changed since the upload: Push metadata first')
        : state!.status !== 'approved'
          ? no(`not approved (${state!.status})`)
          : !state!.id
            ? no('approved: upload it privately first')
            : !o.parentLive
              ? no(`publish ${o.out.derivedFrom} first`)
              : true,
  };

  const parent = short
    ? {
        storyId: short.parent,
        path: pathOf(topic, short.parent, root),
        title: packageOf(scriptDir(topic, short.parent, root))?.title ?? short.parent,
        status: statusOf(topic, short.parent, root),
      }
    : null;
  const shorts = short
    ? []
    : (loadShorts(topic, storyId, root)?.candidates ?? [])
        .filter((c) => c.slug && existsSync(scriptDir(topic, shortId(storyId, c.slug), root)))
        .map((c) => {
          const id = shortId(storyId, c.slug!);
          return {
            storyId: id,
            path: pathOf(topic, id, root),
            title: packageOf(scriptDir(topic, id, root))?.title ?? c.hook ?? c.slug!,
            status: statusOf(topic, id, root),
          };
        });

  return {
    topic,
    storyId,
    path: pathOf(topic, storyId, root),
    kind: short ? 'youtube-short' : 'youtube-video',
    title: o?.metadata?.title ?? rp?.title ?? storyId,
    parent,
    shorts,
    pkg,
    scenes,
    sentences,
    findings,
    state,
    output: o?.id ?? null,
    history: o ? historyOf(o.out.events, pkg?.mp4Sha ?? null) : [],
    can,
  };
}

/** The reviewer's textarea, one note per line: a line may start with `[m:ss sc20 s31]` or a bare `s31` / `sc20`; a
 *  sentence fills in its time and scene, a scene its time. An id the video does not have stays part of the text. */
export function parseNotes(text: string, v: Pick<ReviewView, 'sentences' | 'scenes'>): ReviewNote[] {
  const place = (tokens: string[]): Omit<ReviewNote, 'text'> | null => {
    const n: Omit<ReviewNote, 'text'> = {};
    for (const t of tokens) {
      const mmss = /^(\d+):([0-5]\d)$/.exec(t);
      const sentence = v.sentences.find((s) => s.id === t);
      const scene = v.scenes.find((s) => s.scene === t);
      if (mmss) n.seconds = Number(mmss[1]) * 60 + Number(mmss[2]);
      else if (sentence)
        Object.assign(
          n,
          { scene: sentence.at.scene, sentence: t },
          n.seconds === undefined ? { seconds: sentence.at.seconds } : {},
        );
      else if (scene) Object.assign(n, { scene: t }, n.seconds === undefined ? { seconds: scene.seconds } : {});
      else return null;
    }
    return n;
  };
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line): ReviewNote => {
      const bracket = /^\[([^\]]*)\]\s*(.*)$/.exec(line);
      const bare = /^(s\d+|sc\d+)\s+(.+)$/.exec(line);
      const m = bracket ?? bare;
      const at = m ? place(m[1].trim().split(/\s+/)) : null;
      return at && m![2] ? { text: m![2], ...at } : { text: line };
    });
}

/** The story (or Short) id a review page's folder path names, or null: only `<slug>` or `<slug>/shorts/<slug>` of a
 *  story in stories.json, so a path never reaches outside the topic's scripts. */
export function storyIdOfPath(topic: string, path: string, root = ROOT): string | null {
  const m = /^([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/shorts\/([a-z0-9]+(?:-[a-z0-9]+)*))?$/.exec(path);
  if (!m || !/^[a-z0-9-]+$/.test(topic)) return null;
  const story = loadStories(topic, root)?.stories.find((s) => storySlug(s.id) === m[1]);
  if (!story) return null;
  const id = m[2] ? shortId(story.id, m[2]) : story.id;
  return existsSync(scriptDir(topic, id, root)) ? id : null;
}
