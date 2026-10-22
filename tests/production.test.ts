// The production board derives every stage from the persisted artifacts. Every topic must derive without throwing; the
// stage tests run on a synthetic production (production-helpers.ts) built by the library code, not a committed video.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readJson, toJson } from '../src/lib/io';
import type { RenderCheckSummary } from '../src/lib/render-check';
import { writeRenderCheck } from '../src/video/check';
import {
  type StoryRow,
  board,
  columnOf,
  boardNext,
  productionOf,
  runPromptOf,
  sendBackPromptOf,
  stepsOf,
  validationHaltKind,
} from '../src/lib/production';
import { corpusOf } from '../src/lib/corpus';
import { loadStories } from '../src/lib/stories';
import { passageReader } from '../src/lib/evidence';
import { docHasher, docReader } from '../src/lib/evidence-package';
import { loadReview } from '../src/lib/review';
import { validateScript } from '../src/lib/script-validation';
import { loadTopic } from '../src/lib/topics';
import {
  type EvidencePackage,
  type Script,
  type ScriptReviewFile,
  type ScriptValidation,
  scriptDir,
} from '../src/lib/script';
import { type Fixture, copyTopic, syntheticProduction } from './production-helpers';
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

  it('a locked production reads as its lock says', () => {
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
      ]);
      expect(prod.checks.every((c) => c.health === 'current' || c.health === 'done')).toBe(true);
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

  it('a script asking for evidence halts with needs-evidence', () => {
    const fx = syntheticProduction('graphics');
    try {
      const f = join(fx.dir, 'script.json');
      const s = readJson<Script>(f)!;
      s.generation.needsEvidence = [{ claim: 'heat-pumps/some-claim', why: 'baseline' }];
      writeFileSync(f, toJson(s));
      const prod = productionOf(fx.topic, fx.story, fx.root)!;
      expect(prod.halt).toMatchObject({ kind: 'needs-evidence', stage: 'script' });
      expect(prod.next.startsWith('agent: scripts/briefs/evidence.md')).toBe(true);
    } finally {
      fx.cleanup();
    }
  });
});

describe('review findings', () => {
  it('a sentence the reviewer holds on a warning goes back to the writer, not to another review', () => {
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
      expect(prod.next).toContain('agent: scripts/briefs/script.md (revise)');
    } finally {
      fx.cleanup();
    }
  });
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
      'agent: scripts/briefs/script-review.md (re-review), then npm run script -- validate t s; public release is blocked: draft voice',
      't',
      's',
    );
    expect(steps.map((x) => x.kind)).toEqual(['prompt', 'run', 'do']);
    expect(steps[0].text).toContain('Read scripts/briefs/script-review.md');
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
  });

  it('promptOf carries the notes and corrective modes', () => {
    expect(stepsOf('agent: scripts/briefs/script.md (notes)', 't', 's')[0].text).toContain('send-back pass');
    expect(stepsOf('agent: scripts/briefs/script.md (corrective)', 't', 's')[0].text).toContain('corrective pass');
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
      expect(p.upload).toEqual({
        file: `${p.dir}/video/review/fixture.mp4`,
        title,
        description: `${title}\n\nChapters\n0:00 Hook`,
        thumbnail: null,
      });
    } finally {
      fx.cleanup();
    }
  });
});

describe('board columns', () => {
  const row = (story: object, production: object | null = null, decision: object | null = null) =>
    ({ story: { readiness: 'ready', ...story }, production, decision, next: '' }) as unknown as StoryRow;
  it('one card per video, in the column of whoever acts next', () => {
    expect(columnOf(row({}))).toBe('ready');
    expect(columnOf(row({ readiness: 'needs-research' }))).toBe('needs-research');
    expect(columnOf(row({ partOf: 'decision:first' }))).toBeNull(); // answered on its first question's card
    expect(columnOf(row({}, { stage: 'storyboard' }))).toBe('producing');
    expect(columnOf(row({}, { stage: 'packaged' }))).toBe('your-review');
    expect(columnOf(row({}, { stage: 'packaged' }, { decision: 'reviewing' }))).toBe('reviewing');
    expect(columnOf(row({ partOf: 'x' }, null, { decision: 'published' }))).toBe('published');
  });
});
