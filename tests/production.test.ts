// The production board derives every stage from the persisted artifacts. Every topic must derive without throwing; the
// stage tests run on a synthetic production (production-helpers.ts) built by the library code, not a committed video.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ROOT,
  readJson,
  toJson,
  passageReader,
  docHasher,
  docReader,
  scriptDir,
  shortId,
  storySlug,
} from '../src/shared/io';
import type { RenderCheckSummary } from '../src/lib/render-check';
import { writeRenderCheck } from '../src/video/check';
import {
  type StoryRow,
  board,
  checkDecisions,
  columnOf,
  shortColumnOf,
  type ShortRow,
  boardNext,
  mainState,
  topicBoard,
  productionOf,
  runPromptOf,
  sendBackPromptOf,
  stepsOf,
  validationHaltKind,
} from '../src/lib/production';
import {
  type Article,
  type ArticleRelease,
  articleFingerprint,
  articleReviewUnits,
  articleSentences,
} from '../src/modules/article/article';
import { inspectArticle } from '../src/modules/article';
import { corpusOf } from '../src/modules/evidence';
import { loadReview, loadStories } from '../src/modules/stories';
import type { Storyboard } from '../src/shared/types';
import { validateScript } from '../src/shared/sentence-validation';
import { loadTopic } from '../src/modules/evidence';
import { sentenceFingerprint } from '../src/shared/sentences';
import type { EvidencePackage, Script, ScriptReviewFile, ScriptValidation } from '../src/shared/types';
import {
  addOutputTo,
  recordApproved,
  recordPublished,
  recordUploaded,
  setThumbnail,
} from '../src/modules/publishing/publish';
import { type Fixture, copyTopic, setLook, syntheticProduction, syntheticShort } from './production-helpers';
import { blockedScript, run } from './script-helpers';

describe('production board', () => {
  const topics = board();

  it('derives every topic', () => {
    expect(topics.length).toBeGreaterThan(0);
    for (const t of topics) {
      expect(t.checks.map((c) => c.name)).toContain('report');
      expect(t.next).not.toBe('');
      for (const s of t.stories) expect(s.next).not.toBe('');
    }
  });

  it('a locked production reads as its lock says', { timeout: 30_000 }, () => {
    const f = syntheticProduction('locked');
    try {
      const prod = productionOf(f.topic, f.story, f.root)!;
      expect(prod.checks.map((c) => c.name)).toEqual([
        'evidence package',
        'script',
        'validation',
        'review',
        'storyboard',
        'graphics',
        'release',
        'article', // owed from the lock, a halt only once the video is scored
      ]);
      expect(prod.checks.slice(0, -1).every((c) => c.health === 'current' || c.health === 'done')).toBe(true);
      expect(prod.stage).toBe('locked');
      expect(prod.next).toBe(`npm run video -- spike ${f.topic} ${f.story}`);
      expect(prod.blockers).toEqual([]);
      expect(prod.halt).toBeNull();
      expect(prod.versions.some((v) => v.locked)).toBe(true);
    } finally {
      f.cleanup();
    }
  });

  it('a story without a scripts directory has no production', () => {
    expect(productionOf('get-rich-quick', 'decision:no-such-story')).toBeNull();
  });

  it('a halt at the first stage says why and what to run', () => {
    const root = mkdtempSync(join(tmpdir(), 'vk-board-'));
    try {
      mkdirSync(scriptDir('get-rich-quick', 'decision:empty', root), { recursive: true });
      const prod = productionOf('get-rich-quick', 'decision:empty', root)!;
      expect(prod.stage).toBe('package');
      expect(prod.blockers).toEqual(['no evidence package']);
      expect(prod.next).toBe('npm run script -- package get-rich-quick decision:empty');
      expect(prod.halt).toEqual({ kind: 'missing', stage: 'package', why: 'no evidence package' });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('halt kinds', () => {
  it('a blocked validation maps to revision-limit or blocking-findings', () => {
    expect(validationHaltKind(run(blockedScript(3)))).toBe('revision-limit');
    expect(validationHaltKind(run(blockedScript(1)))).toBe('blocking-findings');
  });

  it('a script asking for evidence halts with needs-evidence', { timeout: 30_000 }, () => {
    const fx = syntheticProduction('graphics');
    try {
      const f = join(fx.dir, 'script.json');
      const s = readJson<Script>(f)!;
      s.generation.needsEvidence = [{ claim: 'heat-pumps/some-claim', why: 'baseline' }];
      writeFileSync(f, toJson(s));
      const prod = productionOf(fx.topic, fx.story, fx.root)!;
      expect(prod.halt).toMatchObject({ kind: 'needs-evidence', stage: 'script' });
      expect(prod.next.startsWith('agent: src/modules/evidence/briefs/evidence.md')).toBe(true);
    } finally {
      fx.cleanup();
    }
  });
});

describe('review findings', () => {
  it(
    'a sentence the reviewer holds on a warning goes back to the writer, not to another review',
    { timeout: 30_000 },
    () => {
      const fx = syntheticProduction('graphics');
      try {
        const { dir, topic, story, root } = fx;
        const f = join(dir, 'script-review.json');
        const r = readJson<ScriptReviewFile>(f)!;
        const [id, fingerprint] = Object.entries(r.approved)[0];
        delete r.approved[id];
        r.findings.push({ sentence: id, fingerprint, category: 'x', severity: 'warning', explanation: 'imprecise' });
        writeFileSync(f, toJson(r));
        const v = validateScript(
          readJson<Script>(join(dir, 'script.json'))!,
          corpusOf(loadTopic(topic)),
          passageReader(root),
          {
            review: r,
            judgments: loadReview(topic, root).applicability,
            previous: readJson<ScriptValidation>(join(dir, 'validation.json')),
            pkg: readJson<EvidencePackage>(join(dir, 'evidence-package.json'))!,
            hashDoc: docHasher(docReader(root)),
          },
        );
        expect(v.status).toBe('needs-review');
        writeFileSync(join(dir, 'validation.json'), toJson(v));
        const prod = productionOf(topic, story, root)!;
        expect(prod.halt).toMatchObject({ kind: 'review-findings', stage: 'script' });
        expect(prod.next).toContain('agent: src/modules/script/briefs/script.md (revise)');
      } finally {
        fx.cleanup();
      }
    },
  );
});

describe('graphics stage', () => {
  // The real check (npm run video -- check) with the verdicts a test needs laid over it.
  const writeCheck = (fx: Fixture, over: Partial<RenderCheckSummary>) => {
    const rc = writeRenderCheck(fx.topic, fx.story, fx.root);
    writeFileSync(join(fx.dir, 'video', 'render-check.json'), toJson({ ...rc, ...over }));
  };

  it('without a release the graphics stage gates the lock', () => {
    const fx = syntheticProduction('graphics');
    try {
      const { topic, story, root } = fx;
      const p0 = productionOf(topic, story, root)!;
      expect(p0.halt).toMatchObject({ kind: 'render-check', stage: 'graphics' });
      expect(p0.next).toBe(`npm run video -- check ${topic} ${story}`);
      writeCheck(fx, { ok: false, needsGraphics: ['sc3'] });
      const p1 = productionOf(topic, story, root)!;
      expect(p1.halt?.kind).toBe('needs-graphics');
      expect(p1.next).toContain('agent: scripts/briefs/graphics.md (sc3)');
      writeCheck(fx, { graphics: [{ scene: 'sc3', kind: 'hp-labels', key: 'k', approved: false }] });
      const p2 = productionOf(topic, story, root)!;
      expect(p2.halt?.kind).toBe('graphics-review');
      expect(p2.next).toContain('agent: scripts/briefs/visual-review.md (sc3)');
      writeCheck(fx, { graphics: [{ scene: 'sc3', kind: 'hp-labels', key: 'k', approved: true }] });
      const p3 = productionOf(topic, story, root)!;
      expect(p3.stage).toBe('lock');
      expect(p3.halt?.kind).toBe('lock');
      expect(p3.next).toContain('--approved-by "<approver>"');
    } finally {
      fx.cleanup();
    }
  });

  it('a render.json changed since the build asks for a new render', () => {
    const fx = syntheticProduction('packaged');
    try {
      const { topic, story, root } = fx;
      const f = join(fx.dir, 'video', 'render.json');
      writeFileSync(f, toJson({ ...readJson<object>(f)!, gapSeconds: 0.5 }));
      // the change asks for a new render check first; once it passes, the build is what is stale
      expect(productionOf(topic, story, root)!.halt).toMatchObject({ kind: 'render-check', stage: 'graphics' });
      writeRenderCheck(topic, story, root);
      const p = productionOf(topic, story, root)!;
      expect(p.halt).toMatchObject({ kind: 'stale', stage: 'video' });
      expect(p.next).toBe(`npm run video -- spike ${topic} ${story}`);
    } finally {
      fx.cleanup();
    }
  });

  it('stepsOf passes a scene list to the graphics brief', () => {
    expect(stepsOf('agent: scripts/briefs/graphics.md (sc18,sc20)', 't', 's')[0].text).toContain('Scenes: sc18,sc20');
  });
});

describe('board next', () => {
  it('boardNext for a story without a script dir', () => {
    // A ready story with its script dir removed, in a copy of the topic (production keeps taking the real ones).
    const c = copyTopic('heat-pumps');
    try {
      const id = loadStories('heat-pumps', c.root)!.stories.find((s) => s.readiness === 'ready' && !s.partOf)!.id;
      rmSync(c.dir(id), { recursive: true, force: true });
      const n = boardNext('heat-pumps', id, c.root);
      expect(n.stage).toBe('package');
      expect(n.steps).toEqual([{ kind: 'run', text: `npm run script -- package heat-pumps ${id}` }]);
      expect(n.done).toBe(false);
    } finally {
      c.cleanup();
    }
  });

  it('boardNext of an unknown story stops', () => {
    expect(boardNext('heat-pumps', 'decision:no-such-story').halt?.kind).toBe('story-left');
  });

  it('boardNext of a packaged story is done', () => {
    const fx = syntheticProduction('packaged');
    try {
      const n = boardNext(fx.topic, fx.story, fx.root);
      expect(n.stage).toBe('packaged');
      expect(n.halt).toBeNull();
      expect(n.done).toBe(true);
    } finally {
      fx.cleanup();
    }
  });
});

describe('next steps', () => {
  it('splits a next line into commands, agent prompts and manual steps', () => {
    const steps = stepsOf(
      'agent: src/modules/script/briefs/script-review.md (re-review), then npm run script -- validate t s; public release is blocked: draft voice',
      't',
      's',
    );
    expect(steps.map((x) => x.kind)).toEqual(['prompt', 'run', 'do']);
    expect(steps[0].text).toContain('Read src/modules/script/briefs/script-review.md');
    expect(steps[0].text).toContain('Story: s');
    expect(steps[0].text).toContain('re-review');
    expect(steps[1].text).toBe('npm run script -- validate t s');
    expect(stepsOf('1 listed; 1 not fetched (npm run report)', 't')).toEqual([
      { kind: 'do', text: '1 listed; 1 not fetched' },
      { kind: 'run', text: 'npm run report' },
    ]);
  });

  it('run and send-back prompts', () => {
    expect(runPromptOf('t', 's')).toBe('/produce t s\nApprover: <your name>');
    expect(sendBackPromptOf('t', 's')).toBe('/produce t s\nApprover: <your name>\nNotes:\n- ');
    expect(
      sendBackPromptOf('t', 's/shorts/x', [
        { text: 'too fast', seconds: 239, scene: 'sc20', sentence: 's31' },
        { text: 'plain' },
      ]),
    ).toBe('/produce t s/shorts/x\nApprover: <your name>\nNotes:\n- [3:59 sc20 s31] too fast\n- plain');
  });

  it('promptOf carries the notes and corrective modes', () => {
    expect(stepsOf('agent: src/modules/article/briefs/article.md -> a.json', 't', 's')[0]).toMatchObject({
      kind: 'prompt',
      text: expect.stringContaining('Read src/modules/article/briefs/article.md and follow it.'),
    });
    expect(stepsOf('agent: src/modules/script/briefs/script.md (notes)', 't', 's')[0].text).toContain('send-back pass');
    expect(stepsOf('agent: src/modules/script/briefs/script.md (corrective)', 't', 's')[0].text).toContain(
      'corrective pass',
    );
  });

  it('gives every board item at least one step', () => {
    for (const t of board()) {
      expect(stepsOf(t.next, t.topic.name).length).toBeGreaterThan(0);
      for (const r of t.stories) expect(stepsOf(r.next, t.topic.name, r.story.id).length).toBeGreaterThan(0);
    }
    // walks every real production in the repo, which grows with each video
  }, 60_000);
});

describe('upload values', () => {
  it('gives a packaged video the YouTube form values from its review package', () => {
    const fx = syntheticProduction('packaged');
    try {
      const p = productionOf(fx.topic, fx.story, fx.root)!;
      expect(p.stage).toBe('packaged');
      expect(p.next).toContain('public release is blocked: draft voice');
      const title = readJson<Script>(join(fx.dir, 'script.json'))!.title;
      expect(p.upload).toMatchObject({
        file: `${p.dir}/video/review/fixture.mp4`,
        title,
        description: `${title}\n\nChapters\n0:00 Hook`,
        tags: [],
        thumbnail: { file: `${p.dir}/video/review/thumbnail.png`, sha: 'thumbsha' },
      });
    } finally {
      fx.cleanup();
    }
  });
});

describe('board columns', () => {
  const row = (story: object, production: object | null = null, decision: object | null = null, shorts: object = {}) =>
    ({
      story: { readiness: 'ready', ...story },
      production,
      decision,
      next: '',
      shorts: [],
      shortsNext: null,
      ...shorts,
    }) as unknown as StoryRow;
  it('one card per video, in the column of whoever acts next', () => {
    expect(columnOf(row({}))).toBe('ready');
    expect(columnOf(row({ readiness: 'needs-research' }))).toBe('needs-research');
    expect(columnOf(row({ partOf: 'decision:first' }))).toBeNull(); // answered on its first question's card
    expect(columnOf(row({}, { stage: 'storyboard' }))).toBe('producing');
    expect(columnOf(row({}, { stage: 'article' }))).toBe('article');
    expect(columnOf(row({}, { stage: 'packaged' }))).toBe('your-review');
    expect(columnOf(row({}, { stage: 'packaged' }, { decision: 'parked' }))).toBe('parked');
    const at = (status: string, stage = 'packaged', live = status === 'published') =>
      row({}, { stage, publish: { main: 'youtube', outputs: [{ id: 'youtube', state: { status, live } }] } });
    expect(columnOf(at('not-uploaded'))).toBe('your-review');
    expect(columnOf(at('build-behind'))).toBe('your-review');
    expect(columnOf(at('uploaded'))).toBe('uploaded');
    expect(columnOf(at('metadata-behind'))).toBe('uploaded');
    expect(columnOf(at('approved'))).toBe('approved');
    expect(columnOf(at('scheduled'))).toBe('scheduled');
    expect(columnOf(at('published'))).toBe('published');
    expect(columnOf(at('changes-requested'))).toBe('changes-requested');
    expect(columnOf(at('published', 'validate'))).toBe('published'); // live stays live when the script is edited
    expect(columnOf(at('metadata-behind', 'validate', true))).toBe('published'); // and when its thumbnail changes
  });
  it('a draft build is at draft review until final replaces it, uploaded or not', () => {
    const draft = { stage: 'packaged', build: { sha: 'd', status: 'draft' } };
    expect(columnOf(row({}, draft))).toBe('draft-review');
    const uploaded = (status: string) => ({
      ...draft,
      publish: { main: 'youtube', outputs: [{ id: 'youtube', state: { status } }] },
    });
    expect(columnOf(row({}, uploaded('not-uploaded')))).toBe('draft-review');
    expect(columnOf(row({}, uploaded('uploaded')))).toBe('draft-review');
    expect(columnOf(row({}, uploaded('changes-requested')))).toBe('changes-requested'); // sent back: paste the prompt
    expect(columnOf(row({}, { ...draft, build: { sha: 'r', status: 'release' } }))).toBe('your-review');
  });
  it('an approved video waits in shorts while any Short is owed', () => {
    const approved = {
      stage: 'packaged',
      publish: { main: 'youtube', outputs: [{ id: 'youtube', state: { status: 'approved' } }] },
    };
    expect(columnOf(row({}, approved))).toBe('approved');
    expect(columnOf(row({}, approved, null, { shortsNext: 'npm run shorts -- discover t s' }))).toBe('shorts');
    const short = (readiness: string, production: object | null = null) => ({ readiness, production, next: '' });
    expect(columnOf(row({}, approved, null, { shorts: [short('needs-review')] }))).toBe('shorts');
    expect(columnOf(row({}, approved, null, { shorts: [short('ready', { stage: 'packaged' })] }))).toBe('shorts');
    expect(columnOf(row({}, approved, null, { shorts: [short('rejected')] }))).toBe('approved');
    const done = {
      stage: 'packaged',
      publish: { main: 'youtube', outputs: [{ id: 'youtube', state: { status: 'approved' } }] },
    };
    expect(columnOf(row({}, approved, null, { shorts: [short('ready', done)] }))).toBe('approved');
  });
  it('a Short sits in the same columns under its parent; a rejected candidate in none', () => {
    const short = (readiness: string, production: object | null = null) =>
      ({ readiness, production, next: '' }) as unknown as ShortRow;
    expect(shortColumnOf(short('rejected'))).toBeNull();
    expect(shortColumnOf(short('needs-review'))).toBe('needs-review');
    expect(shortColumnOf(short('ready'))).toBe('ready');
    expect(shortColumnOf(short('ready', { stage: 'render' }))).toBe('producing');
    expect(shortColumnOf(short('ready', { stage: 'packaged' }))).toBe('your-review');
    const uploaded = {
      stage: 'packaged',
      publish: { main: 'youtube', outputs: [{ id: 'youtube', state: { status: 'uploaded' } }] },
    };
    expect(shortColumnOf(short('ready', uploaded))).toBe('uploaded');
  });

  it('production.json holds queued and parked only', () => {
    expect(() => checkDecisions({ 'a/b': { decision: 'reviewing', note: '', date: '2026-01-01' } })).toThrow(
      /queued\|parked/,
    );
    expect(() => checkDecisions({ 'a/b': { decision: 'parked', note: 'why', date: '2026-01-01' } })).not.toThrow();
  });
});

describe('publishing on the board', () => {
  const by = 'Jon';
  it('reads the ledger, stops on a live video and lifts the stop for a new output', () => {
    const fx = syntheticProduction('packaged', { release: true });
    try {
      const { topic, story, root } = fx;
      const p0 = productionOf(topic, story, root)!;
      expect(p0.publish!.outputs[0].state.status).toBe('not-uploaded');
      expect(p0.upload!.title).toBe(readJson<Script>(join(fx.dir, 'script.json'))!.title);
      expect(p0.next).toContain(`npm run publish -- upload ${topic} ${story}`);
      expect(stepsOf(p0.next, topic, story).map((s) => s.kind)).toEqual(['run']);
      recordUploaded(topic, story, { root, by, id: 'aaaaaaaaaaa' });
      expect(productionOf(topic, story, root)!.next).toContain('npm run publish -- approve');
      recordApproved(topic, story, { root, by });
      recordPublished(topic, story, { root, by, url: 'https://youtu.be/aaaaaaaaaaa' });
      const tb = topicBoard(topic, root, {});
      const r = tb.stories.find((s) => s.story.id === story)!;
      expect(columnOf(r)).toBe('published');
      expect(r.next).toBe('live: https://youtu.be/aaaaaaaaaaa');
      const n = boardNext(topic, story, root);
      expect(n.next).toMatch(/^stop: live at https:\/\/youtu\.be\/aaaaaaaaaaa/);
      expect(n.halt?.kind).toBe('published');
      // a new thumbnail on a live video is a metadata update, never a reason to leave the live column
      mkdirSync(join(fx.dir, 'video', 'publish'), { recursive: true });
      writeFileSync(join(fx.dir, 'video', 'publish', 'thumbnail.png'), 'png');
      setThumbnail(topic, story, { root, file: join(fx.dir, 'video', 'publish', 'thumbnail.png') });
      const behind = productionOf(topic, story, root)!;
      expect(mainState(behind)!.status).toBe('metadata-behind');
      expect(columnOf({ ...r, production: behind })).toBe('published');
      expect(boardNext(topic, story, root).halt?.kind).toBe('published');
      // the script is edited: the stage drops, the video stays live and is not the topic's next step
      const f = join(fx.dir, 'script.json');
      const script = readJson<Script>(f)!;
      writeFileSync(f, toJson({ ...script, revision: script.revision + 1 }));
      const tb2 = topicBoard(topic, root, {});
      const r2 = tb2.stories.find((s) => s.story.id === story)!;
      expect(r2.production!.stage).not.toBe('packaged');
      expect(columnOf(r2)).toBe('published');
      expect(tb2.next).not.toMatch(/^live:/);
      expect(boardNext(topic, story, root).halt?.kind).toBe('published');
      // a re-release is a new output
      addOutputTo(topic, story, 'youtube-2', 'youtube-video', { root });
      const n2 = boardNext(topic, story, root);
      expect(n2.halt?.kind).not.toBe('published');
      expect(productionOf(topic, story, root)!.publish!.main).toBe('youtube-2');
    } finally {
      fx.cleanup();
    }
  }, 60_000); // two whole topic boards
});

describe('the look on the board', { timeout: 60_000 }, () => {
  const final = (f: Fixture) => `npm run video -- final ${f.topic} ${f.story} --approved-by "<approver>"`;
  it('a packaged build drawn before the look was recorded halts look-stale and names video final', () => {
    const f = syntheticProduction('packaged', { release: true });
    try {
      setLook(f.dir, undefined);
      const n = boardNext(f.topic, f.story, f.root);
      expect(n.stage).toBe('packaged');
      expect(n.done).toBe(true); // /produce never re-renders it
      expect(n.halt).toMatchObject({ kind: 'look-stale', stage: 'packaged' });
      expect(n.next).toBe(final(f));
      const prod = productionOf(f.topic, f.story, f.root)!;
      expect(prod.checks.find((c) => c.name === 'look')?.health).toBe('stale');
      const r = topicBoard(f.topic, f.root, {}).stories.find((s) => s.story.id === f.story)!;
      expect(columnOf(r)).toBe('your-review'); // the column is unchanged
    } finally {
      f.cleanup();
    }
  });
  it('redrawing a kit card after the build makes it look-stale; the current kit does not', () => {
    const f = syntheticProduction('packaged', { release: true });
    try {
      expect(boardNext(f.topic, f.story, f.root).halt).toBeNull();
      expect(productionOf(f.topic, f.story, f.root)!.checks.find((c) => c.name === 'look')?.health).toBe('current');
      mkdirSync(join(f.root, 'brand', 'spending'), { recursive: true });
      writeFileSync(join(f.root, 'brand', 'spending', 'close-card.svg'), '<svg/>');
      expect(boardNext(f.topic, f.story, f.root).halt?.kind).toBe('look-stale');
    } finally {
      f.cleanup();
    }
  });
  it('a Short with a legacy build halts look-stale the same way', () => {
    const f = syntheticShort('packaged', { release: true });
    try {
      expect(boardNext(f.topic, f.story, f.root).halt?.kind).not.toBe('look-stale');
      setLook(f.dir, undefined);
      const n = boardNext(f.topic, f.story, f.root);
      expect(n).toMatchObject({ stage: 'packaged', done: true, halt: { kind: 'look-stale', stage: 'packaged' } });
      expect(n.next).toBe(final(f));
    } finally {
      f.cleanup();
    }
  });
});

describe('shorts on the board', () => {
  it(
    'drives a packaged short through the same stages and stales its package when the parent is revised',
    { timeout: 60_000 },
    () => {
      const f = syntheticShort('packaged');
      try {
        const prod = productionOf(f.topic, f.story, f.root)!;
        expect(prod.stage).toBe('packaged');
        expect(prod.checks[0]).toMatchObject({ name: 'evidence package', health: 'current' });
        expect(prod.checks.map((c) => c.name)).toContain('release');
        // the parent is revised: a sentence changes, its validation is re-run and written; the short's package is stale
        const pdir = scriptDir(f.topic, f.parent, f.root);
        const ps = readJson<Script>(join(pdir, 'script.json'))!;
        const first = ps.sections[0].sentences[0];
        first.text = `${first.text} Revised.`;
        ps.revision += 1;
        writeFileSync(join(pdir, 'script.json'), toJson(ps));
        const pv = validateScript(ps, corpusOf(loadTopic(f.topic)), passageReader(f.root), {
          review: readJson<ScriptReviewFile>(join(pdir, 'script-review.json')),
          judgments: loadReview(f.topic, f.root).applicability,
          previous: readJson<ScriptValidation>(join(pdir, 'validation.json')),
          pkg: readJson<EvidencePackage>(join(pdir, 'evidence-package.json')),
          hashDoc: docHasher(docReader(f.root)),
        });
        writeFileSync(join(pdir, 'validation.json'), toJson(pv));
        const again = productionOf(f.topic, f.story, f.root)!;
        expect(again.stage).toBe('package');
        expect(again.halt?.kind).toBe('stale');
        expect(again.next).toBe(`npm run shorts -- discover ${f.topic} ${f.parent}`);
      } finally {
        f.cleanup();
      }
    },
  );
  // topicBoard derives every video of the topic and every Short under them: well over the default 5 s budget
  it('answers boardNext for a short from its candidate and lists it under the parent', { timeout: 60_000 }, () => {
    const f = syntheticShort('reviewed');
    try {
      const n = boardNext(f.topic, f.story, f.root);
      expect(n.next).toBe(`npm run script -- package ${f.topic} ${f.story}`);
      expect(n.halt?.kind).toBe('missing');
      const bad = boardNext(f.topic, shortId(f.parent, 'nope'), f.root);
      expect(bad.next).toMatch(/^stop: no candidate with slug nope/);
      expect(bad.halt?.kind).toBe('story-left');
      const board = topicBoard(f.topic, f.root);
      const row = board.stories.find((s) => s.story.id === f.parent)!;
      expect(row.shorts[0]).toMatchObject({ id: f.story, slug: 'fixture-short', readiness: 'ready', production: null });
      expect(row.shorts[0].next).toBe(n.next);
      expect(row.shortsNext).toBeNull();
      expect(board.next).not.toContain('/shorts/');
      expect(stepsOf(row.shorts[0].next, f.topic, f.story)[0]).toMatchObject({ kind: 'run' });
    } finally {
      f.cleanup();
    }
  });
  it(
    'shows a packaged short under its parent with its own stage and no ledger view until it is added',
    { timeout: 60_000 },
    () => {
      const f = syntheticShort('packaged');
      try {
        const row = topicBoard(f.topic, f.root).stories.find((s) => s.story.id === f.parent)!;
        const sr = row.shorts[0];
        expect(sr.production?.stage).toBe('packaged');
        expect(sr.production?.publish).toBeNull();
        expect(sr.next).toBe(sr.production!.next);
      } finally {
        f.cleanup();
      }
    },
  );
  it("judges a Short's output against its own build, not the parent's", { timeout: 60_000 }, () => {
    const f = syntheticShort('packaged', { release: true });
    try {
      const source = relative(f.root, f.dir).split(sep).join('/');
      addOutputTo(f.topic, f.parent, 'short:fixture-short', 'youtube-short', {
        derivedFrom: 'youtube',
        source,
        root: f.root,
      });
      const now = new Date('2026-10-26T00:00:00Z');
      recordUploaded(f.topic, f.story, { root: f.root, by: 'Jon', now, id: 'bbbbbbbbbbb' });
      const prod = productionOf(f.topic, f.story, f.root)!;
      expect(prod.publish?.outputs.map((o) => o.id)).toEqual(['short:fixture-short']);
      expect(mainState(prod)?.status).toBe('uploaded'); // build-behind if judged against the parent's package
      expect(prod.upload?.file).toBe(
        `${source}/video/review/${readJson<{ mp4: string }>(join(f.dir, 'video', 'review', 'review.json'))!.mp4}`,
      );
    } finally {
      f.cleanup();
    }
  });
});

describe('the article on the board', () => {
  // An article over the fixture's script: its sentences as prose, a callout for every claim so coverage holds.
  const articleOf = (fx: Fixture): Article => {
    const s = readJson<Script>(join(fx.dir, 'script.json'))!;
    const pkg = readJson<EvidencePackage>(join(fx.dir, 'evidence-package.json'))!;
    const say = (id: string, text: string) => ({ id, text, type: 'rhetorical' as const });
    return {
      topic: fx.topic,
      story: fx.story,
      revision: 1,
      generation: { ...s.generation, brief: 'src/modules/article/briefs/article.md' },
      meta: {
        headline: 'Is a heat pump cheaper to run?',
        seoTitle: 'Heat pump running costs',
        dek: say('meta.dek', 'What do the sources say?'),
        description: say('meta.description', 'A look at the running costs.'),
      },
      sections: s.sections.map((x, i) => ({
        name: x.name,
        heading: x.name,
        blocks: [
          { kind: 'prose' as const, sentences: x.sentences },
          ...(i === 0
            ? pkg.claims.map((c, j) => ({
                kind: 'prose' as const,
                callout: 'qualification' as const,
                claim: c.id,
                sentences: [say(`q${j}`, 'The sources disagree here.')],
              }))
            : []),
        ],
      })),
    };
  };
  const write = (fx: Fixture, f: string, x: unknown) => writeFileSync(join(fx.dir, f), toJson(x));
  const articleState = (fx: Fixture) => productionOf(fx.topic, fx.story, fx.root)!.article;
  const released = (a: Article): ArticleRelease => ({
    topic: a.topic,
    story: a.story,
    approvedBy: 'fixture approver',
    date: '2026-01-02',
    revision: 1,
    fingerprints: { article: articleFingerprint(a), package: a.generation.evidencePackage ?? '', validation: '' },
    article: a,
    history: [],
  });

  it('no article state before the script lock', { timeout: 30_000 }, () => {
    const fx = syntheticProduction('graphics');
    try {
      expect(articleState(fx)).toBeNull();
    } finally {
      fx.cleanup();
    }
  });

  it('none, review, released, changed, stale', { timeout: 30_000 }, () => {
    const fx = syntheticProduction('locked');
    try {
      expect(articleState(fx)).toEqual({
        state: 'none',
        next: `agent: src/modules/article/briefs/article.md -> ${relative(fx.root, join(fx.dir, 'article.json')).replaceAll(sep, '/')}`,
        kind: 'missing',
      });
      const a = articleOf(fx);
      write(fx, 'article.json', a);
      expect(articleState(fx)).toMatchObject({ state: 'review', next: expect.stringContaining('article-review.md') });
      write(fx, 'article-review.json', {
        reviewer: 'fixture reviewer',
        date: '2026-01-02',
        revision: 1,
        packageFingerprint: a.generation.evidencePackage,
        approved: Object.fromEntries([
          ...articleSentences(a).map((x) => [x.id, sentenceFingerprint(x)]),
          ...articleReviewUnits(a),
        ]),
        findings: [],
      });
      expect(articleState(fx)).toEqual({
        state: 'review',
        next: `npm run article -- lock ${fx.topic} ${fx.story} --approved-by "<approver>"`,
        kind: 'lock',
      });
      const r = released(a);
      write(fx, 'article-release.json', r);
      expect(articleState(fx)).toEqual({ state: 'released', next: 'none' });
      const headlined = { ...a, meta: { ...a.meta, headline: 'Is a heat pump cheaper to run than gas?' } };
      write(fx, 'article.json', headlined);
      // the new headline is unapproved and no finding holds it: the reviewer's
      expect(articleState(fx)?.state).toBe('review');
      expect(articleState(fx)?.next).toContain('article-review.md');
      const reviewed = readJson<{ approved: Record<string, string> }>(join(fx.dir, 'article-review.json'))!;
      write(fx, 'article-review.json', {
        ...reviewed,
        approved: { ...reviewed.approved, ...Object.fromEntries(articleReviewUnits(headlined)) },
      });
      expect(articleState(fx)).toEqual({
        state: 'changed',
        next: `npm run article -- correct ${fx.topic} ${fx.story} --approved-by "<your name>" --note "<what changed>"`,
      });
      // the release snapshot stands without article.json
      rmSync(join(fx.dir, 'article.json'));
      expect(articleState(fx)).toEqual({ state: 'released', next: 'none' });
      write(fx, 'article.json', a);
      // a claim the release asserts is revised after it: stale while the released text is unchanged
      const claim = readJson<EvidencePackage>(join(fx.dir, 'evidence-package.json'))!.claims[0].id;
      r.article = structuredClone(a);
      r.article.meta.dek.assertions = [
        { id: 'meta.dek.a', text: 'x', claims: [{ id: claim, role: 'supports' }] } as never,
      ];
      write(fx, 'article-release.json', r);
      write(fx, 'article.json', r.article); // the released text, unchanged
      write(fx, '../../public-record.json', {
        exhibits: {},
        revisions: [{ at: '2026-02-01', kind: 'claim', id: claim, from: null, to: null, note: 'a new study' }],
      });
      const stale = articleState(fx)!;
      expect(stale.state).toBe('stale');
      expect(stale.next).toContain('2026-02-01');
      expect(stale.next).toContain('a new study');
      expect(stale.next).toContain('src/modules/article/briefs/article.md (revise)');
      expect(stale.next).toContain(`npm run article -- reaffirm ${fx.topic} ${fx.story}`);
      // the writer revises: a new revision goes to the reviewer, never to lock
      const revised = structuredClone(a);
      revised.revision = 2;
      revised.meta.dek = { ...revised.meta.dek, text: 'What do the newest sources say?' };
      write(fx, 'article.json', revised);
      expect(articleState(fx)).toEqual({
        state: 'review',
        next: `agent: src/modules/article/briefs/article-review.md -> ${relative(fx.root, join(fx.dir, 'article-review.json')).replaceAll(sep, '/')}`,
      });
      // reviewed and passing: a correction
      write(fx, 'article-review.json', {
        ...readJson<object>(join(fx.dir, 'article-review.json')),
        revision: 2,
        approved: Object.fromEntries([
          ...articleSentences(revised).map((x) => [x.id, sentenceFingerprint(x)]),
          ...articleReviewUnits(revised),
        ]),
      });
      expect(articleState(fx)?.state).toBe('changed');
    } finally {
      fx.cleanup();
    }
  });

  it('maps the article inspection to a halt without the module naming one', { timeout: 30_000 }, () => {
    const fx = syntheticProduction('locked');
    try {
      write(fx, 'article.json', articleOf(fx));
      const inspection = inspectArticle(fx.topic, fx.story, fx.root);
      expect(inspection).toMatchObject({ status: 'invalid' });
      expect(Object.keys(inspection)).not.toContain('kind');
      expect(articleState(fx)).toMatchObject({ state: 'review', kind: 'review-pending' });
    } finally {
      fx.cleanup();
    }
  });

  it('a released article whose package moved a cite shows blocked', { timeout: 30_000 }, () => {
    const fx = syntheticProduction('locked');
    try {
      const pkg = readJson<EvidencePackage>(join(fx.dir, 'evidence-package.json'))!;
      // a table cell stating a figure of a cited passage in the package
      const cite = pkg.documents[0].cites[0];
      const n = Number(passageReader(fx.root)(cite)!.match(/\d+/)![0]);
      const a = articleOf(fx);
      const cell = { label: 'Figure', value: n, unit: 'count' as const, display: String(n), cite };
      a.sections[0].blocks.push({
        kind: 'table',
        id: 't1',
        caption: 'c',
        columns: ['n'],
        rows: [{ label: 'r', cells: [cell] }],
      });
      write(fx, 'article.json', a);
      write(fx, 'article-release.json', {
        ...released(a),
        fingerprints: { ...released(a).fingerprints, package: pkg.fingerprint },
      });
      expect(articleState(fx)).toEqual({ state: 'released', next: 'none' });
      // the rebuilt package cites that passage at other lines
      const documents = pkg.documents.map((d, i) =>
        i ? d : { ...d, cites: d.cites.map((c) => (c === cite ? `${c.split('#')[0]}#L999999` : c)) },
      );
      write(fx, 'evidence-package.json', { ...pkg, fingerprint: 'moved', documents });
      expect(articleState(fx)).toEqual({
        state: 'blocked',
        next: `agent: src/modules/article/briefs/article.md (revise) -> ${relative(fx.root, join(fx.dir, 'article.json')).replaceAll(sep, '/')}`,
      });
    } finally {
      fx.cleanup();
    }
  });

  // A released article with one figure over a chart on the first storyboard scene, reviewed at the current package.
  const point = { label: 'Homes', value: 40, unit: 'percent', display: '40%', cite: 'x#L1' };
  const chart = { type: 'stat-tiles', points: [point] };
  const figured = (fx: Fixture) => {
    const sb = readJson<Storyboard>(join(fx.dir, 'storyboard.json'))!;
    (sb.scenes[0].visual as { chart?: unknown }).chart = chart;
    write(fx, 'storyboard.json', sb);
    const ref = `${storySlug(fx.story)}/${sb.scenes[0].id}`;
    const a = articleOf(fx);
    a.sections[0].blocks.push({ kind: 'figure', ref, caption: 'Homes' });
    write(fx, 'article.json', a);
    const pkg = readJson<EvidencePackage>(join(fx.dir, 'evidence-package.json'))!;
    write(fx, 'article-review.json', {
      reviewer: 'fixture reviewer',
      date: '2026-01-02',
      revision: 1,
      packageFingerprint: pkg.fingerprint,
      approved: Object.fromEntries([
        ...articleSentences(a).map((x) => [x.id, sentenceFingerprint(x)]),
        ...articleReviewUnits(a),
      ]),
      findings: [],
    });
    const r = { ...released(a), fingerprints: { ...released(a).fingerprints, package: pkg.fingerprint } };
    write(fx, 'article-release.json', { ...r, figures: { [ref]: { chart } } });
    const recut = () => {
      (sb.scenes[0].visual as { chart?: unknown }).chart = {
        ...chart,
        points: [{ ...point, value: 41, display: '41%' }],
      };
      write(fx, 'storyboard.json', sb);
    };
    return { sb, pkg, recut };
  };
  const reviewer = (fx: Fixture) =>
    `agent: src/modules/article/briefs/article-review.md -> ${relative(fx.root, join(fx.dir, 'article-review.json')).replaceAll(sep, '/')}`;
  const correctCmd = (fx: Fixture) =>
    `npm run article -- correct ${fx.topic} ${fx.story} --approved-by "<your name>" --note "<what changed>"`;

  it('a released article whose chart changed shows changed with the correct command', { timeout: 30_000 }, () => {
    const fx = syntheticProduction('locked');
    try {
      const { recut } = figured(fx);
      expect(articleState(fx)).toEqual({ state: 'released', next: 'none' });
      recut();
      expect(articleState(fx)).toEqual({ state: 'changed', next: correctCmd(fx) });
    } finally {
      fx.cleanup();
    }
  });

  it(
    'a rebuilt package the review does not cover goes to the reviewer, with or without a re-cut chart',
    { timeout: 30_000 },
    () => {
      const fx = syntheticProduction('locked');
      try {
        const { pkg, recut } = figured(fx);
        write(fx, 'evidence-package.json', { ...pkg, fingerprint: 'rebuilt' });
        expect(articleState(fx)).toEqual({ state: 'review', next: reviewer(fx) });
        recut(); // correct would refuse: the validation does not pass
        expect(articleState(fx)).toEqual({ state: 'review', next: reviewer(fx) });
      } finally {
        fx.cleanup();
      }
    },
  );

  // A review at revision 1 approving every unit but the first sentence, which carries a finding of this severity.
  const heldReview = (fx: Fixture, severity: 'warning' | 'info') => {
    const a = articleOf(fx);
    write(fx, 'article.json', a);
    const [s0] = articleSentences(a);
    write(fx, 'article-review.json', {
      reviewer: 'fixture reviewer',
      date: '2026-01-02',
      revision: 1,
      packageFingerprint: a.generation.evidencePackage,
      approved: Object.fromEntries([
        ...articleSentences(a)
          .filter((x) => x.id !== s0.id)
          .map((x) => [x.id, sentenceFingerprint(x)]),
        ...articleReviewUnits(a),
      ]),
      findings: [
        { sentence: s0.id, fingerprint: sentenceFingerprint(s0), severity, category: 'wording', explanation: 'x' },
      ],
    });
    return a;
  };

  it('A: an edit beside a held sentence goes to the reviewer, not back to the writer', { timeout: 30_000 }, () => {
    const fx = syntheticProduction('locked');
    try {
      const a = heldReview(fx, 'warning');
      const edited = structuredClone(a);
      articleSentences(edited)[1].text += ' Indeed.'; // a sentence beside the held one, at the same revision
      write(fx, 'article.json', edited);
      expect(articleState(fx)).toMatchObject({
        state: 'review',
        kind: 'review-pending',
        next: expect.stringContaining('article-review.md'),
      });
    } finally {
      fx.cleanup();
    }
  });

  it('B: only held sentences unapproved: the writer revises them', { timeout: 30_000 }, () => {
    const fx = syntheticProduction('locked');
    try {
      heldReview(fx, 'warning');
      expect(articleState(fx)).toMatchObject({
        state: 'review',
        kind: 'review-findings',
        next: expect.stringContaining('article.md (revise)'),
      });
    } finally {
      fx.cleanup();
    }
  });

  it('C: an edited headline with no finding goes to the reviewer', { timeout: 30_000 }, () => {
    const fx = syntheticProduction('locked');
    try {
      const a = heldReview(fx, 'warning');
      write(fx, 'article.json', { ...a, meta: { ...a.meta, headline: 'Is a heat pump cheaper than gas?' } });
      expect(articleState(fx)).toMatchObject({ kind: 'review-pending' });
    } finally {
      fx.cleanup();
    }
  });

  it('D: an info finding never holds a sentence', { timeout: 30_000 }, () => {
    const fx = syntheticProduction('locked');
    try {
      heldReview(fx, 'info');
      expect(articleState(fx)).toMatchObject({ kind: 'review-pending' });
    } finally {
      fx.cleanup();
    }
  });

  it('the article stage: halts a scored video until released, never earlier', { timeout: 30_000 }, () => {
    const fx = syntheticProduction('packaged');
    try {
      rmSync(join(fx.dir, 'article-release.json'));
      const p = productionOf(fx.topic, fx.story, fx.root)!;
      expect([p.stage, p.halt?.kind]).toEqual(['article', 'missing']);
      expect(p.next).toContain('src/modules/article/briefs/article.md');
    } finally {
      fx.cleanup();
    }
  });

  it('before the video is scored the article never changes the stage or halt', { timeout: 30_000 }, () => {
    const fx = syntheticProduction('locked');
    try {
      const before = productionOf(fx.topic, fx.story, fx.root)!;
      write(fx, 'article.json', { ...articleOf(fx), meta: { ...articleOf(fx).meta, headline: 'x'.repeat(200) } });
      const after = productionOf(fx.topic, fx.story, fx.root)!;
      expect(after.article?.state).toBe('blocked');
      expect([after.stage, after.halt, after.next]).toEqual([before.stage, before.halt, before.next]);
    } finally {
      fx.cleanup();
    }
  });

  it('an article asking for evidence is writing', { timeout: 30_000 }, () => {
    const fx = syntheticProduction('locked');
    try {
      const a = articleOf(fx);
      a.generation.needsEvidence = [{ claim: 'heat-pumps/some-claim', why: 'baseline' }];
      write(fx, 'article.json', a);
      expect(articleState(fx)).toEqual({
        state: 'writing',
        next: 'agent: src/modules/evidence/briefs/evidence.md',
        kind: 'needs-evidence',
      });
    } finally {
      fx.cleanup();
    }
  });

  // live data: a later claim revision may make it stale, and a correction in progress changed
  it('the first released article has a release state', { timeout: 15_000 }, () => {
    expect(['released', 'stale', 'changed']).toContain(
      productionOf('heat-pumps', 'decision:is-it-cheaper-to-run-than-gas')?.article?.state,
    );
  });
});

describe('the owner gate', () => {
  it('halts a story whose topic no institution claims', () => {
    // a story with no production, so no live video can answer before the gate
    const n = boardNext('heat-pumps', 'decision:no-such', ROOT, () => null);
    expect(n.halt?.kind).toBe('no-institution');
    expect(n.next).toBe('stop: no institution claims heat-pumps: add it to commissions in src/config/site.ts');
    expect(n.done).toBe(false);
  });
  it('the board row of an unclaimed topic says the same stop', { timeout: 60_000 }, () => {
    const fx = syntheticProduction('locked');
    try {
      const row = topicBoard(fx.topic, fx.root, {}, () => null).stories.find((s) => s.story.id === fx.story)!;
      expect(row.next).toBe(`stop: no institution claims ${fx.topic}: add it to commissions in src/config/site.ts`);
    } finally {
      fx.cleanup();
    }
  });
});
