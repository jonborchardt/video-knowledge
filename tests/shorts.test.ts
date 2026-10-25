// Short discovery and the Short's evidence package, on the synthetic script fixture: a three-sentence parent whose
// investigation sentence asserts a fact with figures, storyboarded into three scenes (tests/video-helpers.ts).
import { describe, expect, it } from 'vitest';
import { toJson } from '../src/lib/io';
import {
  type EvidencePackage,
  type Script,
  scriptFingerprint,
  sectionsFor,
  sentenceFingerprint,
  sentences,
} from '../src/lib/script';
import { storyboardFingerprint, validationFingerprint } from '../src/lib/release';
import { buildStoryboard } from '../src/lib/storyboard';
import {
  type ShortParent,
  type ShortsReviewFile,
  buildShortPackage,
  discoverShorts,
  staleShortReviewKeys,
} from '../src/lib/shorts';
import {
  DOC_D,
  MLM,
  RENTAL,
  approveAll,
  fact,
  good,
  partlySentence,
  pkg,
  plan,
  read,
  run,
  scene,
  sentence,
} from './script-helpers';
import { scenes } from './video-helpers';

/** The fixture script with its sentences in finding sections, and a qualification on the fact. */
function parentScript(over: { qualifications?: string[] } = {}): Script {
  const g = good();
  const s02 = sentence('s02', 'Of 601 people surveyed, 47 percent lost money.', 'factual', [
    fact('s02.a', 'Of 601 participants, 47% reported losing money.', [DOC_D], {
      qualifications: over.qualifications,
    }),
  ]);
  return {
    ...g,
    sections: [
      { name: 'hook', sentences: [sentences(g)[0]] },
      { name: 'investigation', sentences: [s02] },
      { name: 'answer', sentences: [sentences(g)[2]] },
    ],
  };
}
function parent(over: { qualifications?: string[]; release?: boolean; approve?: boolean } = {}): ShortParent {
  const script = parentScript(over);
  const review = approveAll(script);
  if (over.approve === false) delete review.approved.s02;
  const v = run(script, review);
  const sb = buildStoryboard(
    { ...plan(scenes(), script), assets: { 'phone-ui': { kind: 'animation', description: 'phone' } } },
    script,
    v,
    pkg(),
    read,
  );
  const release = over.release === false ? null : lockOf(script, v, sb);
  return { script, v, sb, pkg: pkg(), release };
}
const lockOf = (script: Script, v: ShortParent['v'], sb: ShortParent['sb']): ShortParent['release'] => ({
  topic: script.topic,
  story: script.story,
  approvedBy: 'test',
  date: 'd',
  revision: 1,
  fingerprints: {
    script: scriptFingerprint(script),
    package: pkg().fingerprint,
    validation: validationFingerprint(v),
    storyboard: storyboardFingerprint(sb),
  },
});
const kept = (over: Partial<ShortsReviewFile['candidates'][string]> = {}): ShortsReviewFile => ({
  candidates: {
    s02: {
      keep: true,
      slug: 'half-lost-money',
      format: 'ONE FIGURE FROM THE RECORD',
      hook: 'Nearly half of them lost money.',
      ...over,
    },
  },
});

describe('short discovery', () => {
  it('drafts one candidate per finding scene, none ready without a review, and reruns byte-identical', () => {
    const p = parent();
    const file = discoverShorts(p, null);
    expect(file.candidates.map((c) => c.key)).toEqual(['s02']);
    const c = file.candidates[0];
    expect(c).toMatchObject({ scene: 'sc02', section: 'investigation', claims: [MLM], cites: [DOC_D] });
    expect(c.figures).toEqual(['601', '47']);
    expect(c.chart?.type).toBe('stacked-bar');
    expect(c.readiness).toBe('needs-review');
    expect(c.blocking[0]).toMatch(/shorts-review\.json/);
    expect(toJson(discoverShorts(p, null))).toBe(toJson(file));
    expect(file.parentFingerprints.script).toBe(p.v.scriptFingerprint);
    expect(file.parentFingerprints.release).not.toBeNull();
  });
  it('is ready with a kept review that names a slug, a format and a hook', () => {
    const c = discoverShorts(parent(), kept()).candidates[0];
    expect(c.readiness).toBe('ready');
    expect(c).toMatchObject({ slug: 'half-lost-money', format: 'ONE FIGURE FROM THE RECORD', reviewed: true });
    for (const bad of [{ keep: false }, { slug: 'Bad Slug' }, { format: 'FINDING' as never }, { hook: ' ' }]) {
      const x = discoverShorts(parent(), kept(bad)).candidates[0];
      expect(x.readiness, JSON.stringify(bad)).toBe('needs-review');
    }
  });
  it('lists the parent sentences that carry a qualification and needs each carried inside the Short', () => {
    const p = parent({ qualifications: ['s03 says the figures are self-reported.'] });
    const c = discoverShorts(p, kept()).candidates[0];
    expect(c.qualifications).toEqual([
      { assertion: 's02.a', text: 's03 says the figures are self-reported.', carriedBy: ['s03'] },
    ]);
    expect(c.readiness).toBe('needs-review');
    expect(c.blocking.join()).toMatch(/1 qualification, 0 carried/);
    expect(discoverShorts(p, kept({ carries: ['the figures are self-reported'] })).candidates[0].readiness).toBe(
      'ready',
    );
  });
  it('rejects on the review, on an unapproved parent sentence, and holds an unlocked parent', () => {
    const r = discoverShorts(parent(), kept({ reject: 'a list, not a finding' }));
    expect(r.candidates).toEqual([]);
    expect(r.rejected).toEqual([{ key: 's02', reason: 'a list, not a finding' }]);
    const u = discoverShorts(parent({ approve: false }), kept());
    expect(u.candidates).toEqual([]);
    expect(u.rejected[0].reason).toMatch(/s02 not verified/);
    const l = discoverShorts(parent({ release: false }), kept()).candidates[0];
    expect(l.readiness).toBe('needs-review');
    expect(l.blocking.join()).toMatch(/not locked/);
    // a lock of another revision of the parent is no lock
    const p = parent();
    const old = { ...p, release: { ...p.release!, fingerprints: { ...p.release!.fingerprints, script: 'older' } } };
    const s = discoverShorts(old, kept()).candidates[0];
    expect(s.readiness).toBe('needs-review');
    expect(s.blocking.join()).toMatch(/lock is stale/);
  });
  it('refuses a review claim outside the parent package and flags stale review keys', () => {
    const c = discoverShorts(parent(), kept({ claims: ['t/other'] })).candidates[0];
    expect(c.blocking.join()).toMatch(/t\/other is not in the parent/);
    const file = discoverShorts(parent(), null);
    expect(staleShortReviewKeys(file, { candidates: { s99: {} } })).toEqual(['s99']);
    expect(staleShortReviewKeys(file, kept())).toEqual([]);
  });
});

describe('short package', () => {
  const made = () => {
    const file = discoverShorts(parent(), kept());
    return { file, pkg: buildShortPackage(pkg(), file.candidates[0], file) };
  };
  it('filters the parent package to the candidate and binds the short block to the parent', () => {
    const { file, pkg: sp } = made();
    expect(sp.short).toMatchObject({ parent: file.story, key: 's02', slug: 'half-lost-money', sentences: ['s02'] });
    expect(sp.short!.parentFingerprints).toEqual({
      package: pkg().fingerprint,
      script: file.parentFingerprints.script,
      release: file.parentFingerprints.release,
    });
    expect(sp.claims.map((c) => c.id)).toEqual([MLM]);
    expect(sp.documents).toEqual(pkg().documents);
    expect(sp.story).toBe(`${file.story}/shorts/half-lost-money`);
    expect(sp.title).toBe('Nearly half of them lost money.');
    expect(sp.questions).toBeUndefined();
    expect(sectionsFor(sp)).toEqual(['hook', 'finding', 'close']);
  });
  it('changes its fingerprint with the hook, the parent script and the carries, not with time', () => {
    const { file, pkg: a } = made();
    const b = buildShortPackage(pkg(), file.candidates[0], file);
    expect(b.fingerprint).toBe(a.fingerprint);
    const hooked = discoverShorts(parent(), kept({ hook: 'Another opening.' }));
    expect(buildShortPackage(pkg(), hooked.candidates[0], hooked).fingerprint).not.toBe(a.fingerprint);
    const moved = { ...file, parentFingerprints: { ...file.parentFingerprints, script: 'other' } };
    expect(buildShortPackage(pkg(), file.candidates[0], moved).fingerprint).not.toBe(a.fingerprint);
  });
  it('refuses a candidate that is not ready', () => {
    const file = discoverShorts(parent(), null);
    expect(() => buildShortPackage(pkg(), file.candidates[0], file)).toThrow(/needs-review/);
  });
  it('refuses a parent package other than the one discovery read', () => {
    const { file } = made();
    expect(() => buildShortPackage({ ...pkg(), fingerprint: 'newer' }, file.candidates[0], file)).toThrow(
      /run discover again/,
    );
  });
  it('is a package the validator reads as a short', () => {
    const { pkg: sp } = made();
    const p: EvidencePackage = sp;
    expect(p.short?.format).toBe('ONE FIGURE FROM THE RECORD');
    expect(sentenceFingerprint(sentences(parentScript())[1])).toBeTruthy();
  });
});

describe('short format gates', () => {
  const shortPkg = () => {
    const file = discoverShorts(parent(), kept());
    return buildShortPackage(pkg(), file.candidates[0], file);
  };
  const shortScript = (
    finding: ReturnType<typeof sentence>[],
    close = 'The full inquiry is linked below.',
  ): Script => ({
    ...good(),
    generation: { ...good().generation, evidencePackage: shortPkg().fingerprint },
    sections: [
      { name: 'hook', sentences: [sentence('s01', 'Nearly half of them lost money.', 'rhetorical')] },
      { name: 'finding', sentences: finding },
      { name: 'close', sentences: [sentence('s09', close, 'transitional')] },
    ],
  });
  const finding = () =>
    sentence('s02', 'Of 601 people surveyed, 47 percent lost money.', 'factual', [
      fact('s02.a', 'Of 601 participants, 47% reported losing money.'),
    ]);
  it('passes a self-contained finding with the short sections', () => {
    const s = shortScript([finding()]);
    const v = run(s, approveAll(s, shortPkg()), shortPkg());
    expect(v.status).toBe('passed');
    expect(v.issues.filter((i) => i.category === 'structure')).toEqual([]);
  });
  it('blocks an assertion on a claim outside the short package', () => {
    const s = shortScript([
      finding(),
      sentence('s03', 'Rental property lets investors borrow against appreciation.', 'factual', [
        {
          ...fact('s03.a', 'Rental property lets investors borrow against appreciation.'),
          claims: [{ id: RENTAL, stance: 'asserts' }],
        },
      ]),
    ]);
    const v = run(s, approveAll(s, shortPkg()), shortPkg());
    expect(v.status).toBe('blocked');
    expect(v.issues.some((i) => i.category === 'scope' && i.severity === 'blocking')).toBe(true);
  });
  it('blocks a figure in the close', () => {
    const s = shortScript([finding()], 'That 47 percent is the whole story.');
    const v = run(s, approveAll(s, shortPkg()), shortPkg());
    expect(v.issues.find((i) => i.category === 'figure-in-close')?.severity).toBe('blocking');
  });
  it('blocks a qualified assertion unless a sentence of the Short carries the qualification', () => {
    const widened = { ...shortPkg(), claims: [...shortPkg().claims, { id: RENTAL } as never] };
    const bare = shortScript([finding(), partlySentence()]);
    const v = run(bare, approveAll(bare, widened), widened);
    expect(v.issues.find((i) => i.category === 'needs-qualification')?.severity).toBe('blocking');
    const placed = shortScript([
      finding(),
      {
        ...partlySentence(),
        assertions: [{ ...partlySentence().assertions![0], qualifications: ['s02 says the sample is one survey.'] }],
      },
    ]);
    const w = run(placed, approveAll(placed, widened), widened);
    expect(w.issues.find((i) => i.category === 'needs-qualification')?.severity).toBe('warning');
    // a video package leaves it as a warning for the reviewer
    const video = run(bare, approveAll(bare), pkg());
    expect(video.issues.find((i) => i.category === 'needs-qualification')?.severity).toBe('warning');
  });
  it('blocks a storyboard that estimates past the cap', () => {
    const s = shortScript([finding()]);
    const sp = shortPkg();
    const v = run(s, approveAll(s, sp), sp);
    const long = buildStoryboard(
      plan([scene('sc01', ['s01']), scene('sc02', ['s02'], { pauseSeconds: 200 }), scene('sc03', ['s09'])], s),
      s,
      v,
      sp,
      read,
    );
    expect(long.status).toBe('blocked');
    expect(long.issues.find((i) => i.category === 'too-long')?.severity).toBe('blocking');
    const fine = buildStoryboard(
      plan([scene('sc01', ['s01']), scene('sc02', ['s02']), scene('sc03', ['s09'])], s),
      s,
      v,
      sp,
      read,
    );
    expect(fine.status).toBe('ok');
  });
});
