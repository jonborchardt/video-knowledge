// The structured next step (Milestone 2, spec §9 F.2): `outputState` composes an `OutputStep` (verb, actor, args,
// retryable) the runner dispatches on, and `next`, the person's line, is rendered from it by `renderStep`. The
// inline snapshots below were taken before the refactor: the strings a person reads are byte-identical.
import { describe, expect, it } from 'vitest';
import {
  type Output,
  type OutputState,
  type PublishEvent,
  addOutput,
  appendEvent,
  emptyLedger,
  outputState,
  outputStates,
  renderStep,
} from '../publish';

const ev = (type: PublishEvent['type'], extra: Partial<PublishEvent> = {}, at = '2026-10-24T09:00:00Z'): PublishEvent =>
  ({ at, type, by: 'Jon', ...extra }) as PublishEvent;
const up = (build: string, id: string, status: 'draft' | 'release' = 'release') =>
  ev('uploaded', { build, buildStatus: status, metadata: 'm1', id, visibility: 'private' });
const out = (...events: PublishEvent[]): Output => ({ kind: 'youtube-video', metadata: {}, events });
const release = { sha: 'r1', status: 'release' } as const;
const draft = { sha: 'd1', status: 'draft' } as const;
const ctx = {
  topic: 'ai-coding',
  story: 'decision:how-much-faster',
  output: 'youtube',
  now: new Date('2026-10-26T00:00:00Z'),
};
const verified = (result: 'passed' | 'pending' | 'failed') =>
  ev('verified', { id: 'id1', build: 'r1', metadata: 'm1', result, checks: [{ name: 'title', result: 'pass' }] });

const states = {
  'not uploaded, no package': () => outputState(out(), null, null, ctx),
  'not uploaded': () => outputState(out(), release, 'm1', ctx),
  'approved on disk, not uploaded': () => outputState(out(ev('approved', { build: 'r1' })), release, 'm1', ctx),
  'draft uploaded': () => outputState(out(up('d1', 'id1', 'draft')), draft, 'm1', ctx),
  'release uploaded, not verified': () => outputState(out(up('r1', 'id1')), release, 'm1', ctx),
  'release uploaded, verification pending': () =>
    outputState(out(up('r1', 'id1'), verified('pending')), release, 'm1', ctx),
  'release uploaded, verified': () => outputState(out(up('r1', 'id1'), verified('passed')), release, 'm1', ctx),
  'release uploaded, metadata behind': () => outputState(out(up('r1', 'id1')), release, 'm2', ctx),
  approved: () =>
    outputState(
      out(up('r1', 'id1'), verified('passed'), ev('approved', { build: 'r1', id: 'id1' })),
      release,
      'm1',
      ctx,
    ),
  'approved, not verified': () =>
    outputState(out(up('r1', 'id1'), ev('approved', { build: 'r1', id: 'id1' })), release, 'm1', ctx),
  'approved, metadata behind': () =>
    outputState(out(up('r1', 'id1'), ev('approved', { build: 'r1', id: 'id1' })), release, 'm2', ctx),
  'scheduled, not due': () =>
    outputState(
      out(
        up('r1', 'id1'),
        ev('approved', { build: 'r1', id: 'id1' }),
        ev('scheduled', { id: 'id1', publishAt: '2026-10-28T15:00:00Z' }),
      ),
      release,
      'm1',
      ctx,
    ),
  'scheduled, due': () =>
    outputState(
      out(
        up('r1', 'id1'),
        ev('approved', { build: 'r1', id: 'id1' }),
        ev('scheduled', { id: 'id1', publishAt: '2026-10-20T15:00:00Z' }),
      ),
      release,
      'm1',
      ctx,
    ),
  published: () =>
    outputState(
      out(
        up('r1', 'id1'),
        ev('approved', { build: 'r1' }),
        ev('published', { id: 'id1', url: 'https://youtu.be/id1' }),
      ),
      release,
      'm1',
      ctx,
    ),
  'published, build moved on': () =>
    outputState(
      out(up('r1', 'id1'), ev('approved', { build: 'r1' }), ev('published', { id: 'id1' })),
      { sha: 'r2', status: 'release' },
      'm1',
      ctx,
    ),
  'published, metadata behind': () =>
    outputState(
      out(up('r1', 'id1'), ev('approved', { build: 'r1' }), ev('published', { id: 'id1' })),
      release,
      'm2',
      ctx,
    ),
  'build behind': () => outputState(out(up('d1', 'id1', 'draft')), release, 'm1', ctx),
  'changes requested, uploaded': () =>
    outputState(
      out(up('r1', 'id1'), ev('changes-requested', { build: 'r1', notes: [{ text: 'slower' }] })),
      release,
      'm1',
      ctx,
    ),
  'changes requested, not uploaded': () =>
    outputState(out(ev('changes-requested', { build: 'r1', notes: [{ text: 'slower' }] })), release, 'm1', ctx),
  'failed retryable': () =>
    outputState(
      out(up('r1', 'id1'), ev('failed', { step: 'verify', error: 'quota', retryable: true })),
      release,
      'm1',
      ctx,
    ),
  'failed, a person decides': () =>
    outputState(
      out(
        up('r1', 'id1'),
        ev('approved', { build: 'r1' }),
        ev('failed', { step: 'go-live', error: 'kept private', retryable: false }),
      ),
      release,
      'm1',
      ctx,
    ),
  'uploaded, package missing': () => outputState(out(up('r1', 'id1')), null, null, ctx),
  retracted: () => outputState(out(ev('retracted', { note: 'no' })), release, 'm1', ctx),
  'generic not made': () =>
    outputState({ kind: 'blog-post', metadata: {}, source: 'blog/post.md', events: [] }, null, null, {
      ...ctx,
      output: 'blog',
    }),
  'generic approved': () =>
    outputState({ kind: 'blog-post', metadata: {}, events: [ev('approved', { build: 'none' })] }, null, null, {
      ...ctx,
      output: 'blog',
    }),
  'generic published': () =>
    outputState(
      {
        kind: 'blog-post',
        metadata: {},
        events: [ev('approved', { build: 'none' }), ev('published', { id: 'p1', url: 'https://x/p' })],
      },
      null,
      null,
      { ...ctx, output: 'blog' },
    ),
  'a short whose parent is not live': () => {
    const l = addOutput(emptyLedger('t/s'), 'short:one', 'youtube-short', { derivedFrom: 'youtube' });
    const s = outputStates(appendEvent(l, 'short:one', up('r1', 'id9')).ledger, release, () => 'm1', {
      topic: 'ai-coding',
      story: 'decision:how-much-faster',
      now: ctx.now,
    });
    return s['short:one'];
  },
};

describe('the next line a person reads is unchanged by the structured step', () => {
  it('not uploaded, no package', () => {
    expect(states['not uploaded, no package']().next).toMatchInlineSnapshot(
      `"npm run video -- package ai-coding decision:how-much-faster, then npm run publish -- upload ai-coding decision:how-much-faster"`,
    );
  });
  it('not uploaded', () => {
    expect(states['not uploaded']().next).toMatchInlineSnapshot(
      `"npm run publish -- upload ai-coding decision:how-much-faster"`,
    );
  });
  it('approved on disk, not uploaded', () => {
    expect(states['approved on disk, not uploaded']().next).toMatchInlineSnapshot(
      `"npm run publish -- upload ai-coding decision:how-much-faster, then npm run publish -- go-live ai-coding decision:how-much-faster"`,
    );
  });
  it('draft uploaded', () => {
    expect(states['draft uploaded']().next).toMatchInlineSnapshot(
      `"watch https://youtu.be/id1 with video/review/checklist.md, then npm run video -- final ai-coding decision:how-much-faster --approved-by "<name>""`,
    );
  });
  it('release uploaded, not verified', () => {
    expect(states['release uploaded, not verified']().next).toMatchInlineSnapshot(
      `"watch https://youtu.be/id1 with video/review/checklist.md, then npm run publish -- approve ai-coding decision:how-much-faster --by "<name>" --checked <n>"`,
    );
  });
  it('release uploaded, verification pending', () => {
    expect(states['release uploaded, verification pending']().next).toMatchInlineSnapshot(
      `"watch https://youtu.be/id1 with video/review/checklist.md, then npm run publish -- approve ai-coding decision:how-much-faster --by "<name>" --checked <n>"`,
    );
  });
  it('release uploaded, verified', () => {
    expect(states['release uploaded, verified']().next).toMatchInlineSnapshot(
      `"watch https://youtu.be/id1 with video/review/checklist.md, then npm run publish -- approve ai-coding decision:how-much-faster --by "<name>" --checked <n>"`,
    );
  });
  it('release uploaded, metadata behind', () => {
    expect(states['release uploaded, metadata behind']().next).toMatchInlineSnapshot(
      `"watch https://youtu.be/id1 with video/review/checklist.md, then npm run publish -- approve ai-coding decision:how-much-faster --by "<name>" --checked <n>"`,
    );
  });
  it('approved', () => {
    expect(states.approved().next).toMatchInlineSnapshot(
      `"npm run publish -- go-live ai-coding decision:how-much-faster [--at <ISO>]"`,
    );
  });
  it('approved, not verified', () => {
    expect(states['approved, not verified']().next).toMatchInlineSnapshot(
      `"npm run publish -- go-live ai-coding decision:how-much-faster [--at <ISO>]"`,
    );
  });
  it('approved, metadata behind', () => {
    expect(states['approved, metadata behind']().next).toMatchInlineSnapshot(
      `"the title, description, tags, thumbnail or captions changed since they were sent (npm run publish -- push ai-coding decision:how-much-faster)"`,
    );
  });
  it('scheduled, not due', () => {
    expect(states['scheduled, not due']().next).toMatchInlineSnapshot(
      `"scheduled for 2026-10-28T15:00:00Z; nothing until then"`,
    );
  });
  it('scheduled, due', () => {
    expect(states['scheduled, due']().next).toMatchInlineSnapshot(
      `"was due 2026-10-20T15:00:00Z (npm run publish -- sync ai-coding decision:how-much-faster)"`,
    );
  });
  it('published', () => {
    expect(states.published().next).toMatchInlineSnapshot(`"live at https://youtu.be/id1"`);
  });
  it('published, build moved on', () => {
    expect(states['published, build moved on']().next).toMatchInlineSnapshot(
      `"live at https://youtu.be/id1; the build on disk is r2, a re-release is npm run publish -- add ai-coding decision:how-much-faster youtube-2 --kind youtube-video"`,
    );
  });
  it('published, metadata behind', () => {
    expect(states['published, metadata behind']().next).toMatchInlineSnapshot(
      `"the title, description, tags, thumbnail or captions changed since they were sent (npm run publish -- push ai-coding decision:how-much-faster)"`,
    );
  });
  it('build behind', () => {
    expect(states['build behind']().next).toMatchInlineSnapshot(
      `"a new release build r1 is packaged (uploaded: d1), then npm run publish -- upload ai-coding decision:how-much-faster"`,
    );
  });
  it('changes requested, uploaded', () => {
    expect(states['changes requested, uploaded']().next).toMatchInlineSnapshot(
      `"send it back with the reviewer's notes: /produce ai-coding decision:how-much-faster"`,
    );
  });
  it('changes requested, not uploaded', () => {
    expect(states['changes requested, not uploaded']().next).toMatchInlineSnapshot(
      `"send it back with the reviewer's notes: /produce ai-coding decision:how-much-faster"`,
    );
  });
  it('failed retryable', () => {
    expect(states['failed retryable']().next).toMatchInlineSnapshot(
      `"verify failed: quota; retry it, then watch https://youtu.be/id1 with video/review/checklist.md, then npm run publish -- approve ai-coding decision:how-much-faster --by "<name>" --checked <n>"`,
    );
  });
  it('failed, a person decides', () => {
    expect(states['failed, a person decides']().next).toMatchInlineSnapshot(
      `"go-live failed: kept private; a person decides"`,
    );
  });
  it('uploaded, package missing', () => {
    expect(states['uploaded, package missing']().next).toMatchInlineSnapshot(
      `"the review package is missing: npm run video -- package, then watch https://youtu.be/id1 and record what follows"`,
    );
  });
  it('retracted', () => {
    expect(states.retracted().next).toMatchInlineSnapshot(`"retracted; nothing to do"`);
  });
  it('generic not made', () => {
    expect(states['generic not made']().next).toMatchInlineSnapshot(
      `"make blog/post.md, then npm run publish -- approve ai-coding decision:how-much-faster --output blog --by "<name>" and npm run publish -- published ai-coding decision:how-much-faster --output blog --url <url>"`,
    );
  });
  it('generic approved', () => {
    expect(states['generic approved']().next).toMatchInlineSnapshot(
      `"publish it, then npm run publish -- published ai-coding decision:how-much-faster --output blog --url <url>"`,
    );
  });
  it('generic published', () => {
    expect(states['generic published']().next).toMatchInlineSnapshot(`"live at https://x/p"`);
  });
  it('a short whose parent is not live', () => {
    expect(states['a short whose parent is not live']().next).toMatchInlineSnapshot(
      `"watch https://youtu.be/id9 with video/review/checklist.md, then npm run publish -- approve ai-coding decision:how-much-faster --output short:one --by "<name>" --checked <n>"`,
    );
  });
});

const EXPECTED: Record<keyof typeof states, [string, string, boolean]> = {
  'not uploaded, no package': ['package', 'automation', false],
  'not uploaded': ['upload', 'automation', false],
  'approved on disk, not uploaded': ['upload', 'automation', false],
  'draft uploaded': ['final', 'person', false],
  'release uploaded, not verified': ['verify', 'automation', false],
  'release uploaded, verification pending': ['verify', 'youtube', true],
  'release uploaded, verified': ['approve', 'person', false],
  'release uploaded, metadata behind': ['push', 'automation', false],
  approved: ['go-live', 'person', false],
  'approved, not verified': ['verify', 'automation', false],
  'approved, metadata behind': ['push', 'automation', false],
  'scheduled, not due': ['sync', 'youtube', false],
  'scheduled, due': ['sync', 'automation', false],
  published: ['none', 'none', false],
  'published, build moved on': ['none', 'none', false],
  'published, metadata behind': ['push', 'automation', false],
  'build behind': ['upload', 'automation', false],
  'changes requested, uploaded': ['send-back', 'person', false],
  'changes requested, not uploaded': ['send-back', 'person', false],
  'failed retryable': ['verify', 'automation', true],
  'failed, a person decides': ['verify', 'automation', false],
  'uploaded, package missing': ['package', 'automation', false],
  retracted: ['none', 'none', false],
  'generic not made': ['approve', 'person', false],
  'generic approved': ['studio', 'person', false],
  'generic published': ['none', 'none', false],
  'a short whose parent is not live': ['verify', 'automation', false],
};

describe('the structured step', () => {
  for (const [name, make] of Object.entries(states) as [keyof typeof states, () => OutputState][])
    it(`${name}: verb, actor, retryable; the line is rendered from it`, () => {
      const s = make();
      expect([s.step.verb, s.step.actor, s.step.retryable ?? false]).toEqual(EXPECTED[name]);
      expect(renderStep(s.step)).toBe(s.next);
    });
  it('a failure overlays the step only while the build and metadata it failed on stand', () => {
    const failed = ev('failed', {
      step: 'upload',
      error: 'invalid description',
      retryable: false,
      metadata: 'm1',
      build: 'r1',
    });
    expect(outputState(out(failed), release, 'm1', ctx).step.failed?.error).toBe('invalid description');
    expect(outputState(out(failed), release, 'm2', ctx).step.failed).toBeUndefined(); // re-packaged: a new attempt
    expect(outputState(out(failed), { sha: 'r2', status: 'release' }, 'm1', ctx).step.failed).toBeUndefined();
    const old = ev('failed', { step: 'upload', error: 'boom', retryable: true }); // an older ledger: no shas recorded
    expect(outputState(out(old), release, 'm2', ctx).step.failed?.error).toBe('boom');
  });
  it('a failure rides on the step with its retryability', () => {
    const s = states['failed retryable']();
    expect(s.step.failed).toEqual({ step: 'verify', error: 'quota', retryable: true });
    const p = states['failed, a person decides']();
    expect(p.step.failed).toEqual({ step: 'go-live', error: 'kept private', retryable: false });
    expect(p.step.retryable).toBe(false);
  });
  it('a derivative whose parent is not live says which output must go first', () => {
    expect(states['a short whose parent is not live']().step.blocked).toBe('youtube');
    expect(states['release uploaded, verified']().step.blocked).toBeUndefined();
  });
  it("the person's verbs name their flags", () => {
    expect(states['release uploaded, verified']().step.args).toEqual(['--by', '"<name>"', '--checked', '<n>']);
    expect(states['draft uploaded']().step.args).toEqual(['--approved-by', '"<name>"']);
    expect(states['generic approved']().step.args).toEqual(['--url', '<url>']);
  });
  it("a failed verification a push can fix asks for the push; one it cannot is a person's", () => {
    const fixable = outputState(
      out(
        up('r1', 'id1'),
        ev('verified', {
          id: 'id1',
          build: 'r1',
          metadata: 'm1',
          result: 'failed',
          checks: [{ name: 'title', result: 'fail' }],
        }),
      ),
      release,
      'm1',
      ctx,
    );
    expect([fixable.step.verb, fixable.step.actor]).toEqual(['push', 'automation']);
    const stuck = outputState(
      out(
        up('r1', 'id1'),
        ev('verified', {
          id: 'id1',
          build: 'r1',
          metadata: 'm1',
          result: 'failed',
          checks: [{ name: 'file', result: 'fail' }],
        }),
      ),
      release,
      'm1',
      ctx,
    );
    expect([stuck.step.verb, stuck.step.actor]).toEqual(['verify', 'person']);
  });
});
