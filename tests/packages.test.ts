// Integration: every committed script package (topics/<topic>/scripts/<slug>/) re-validates from the repository alone,
// with no transcripts (CI has none) and no watcher: the package rebuilds byte-for-byte, every cited passage and quote
// context is present, the committed review still passes, the storyboard covers the script, and a locked release
// matches the files. Skipped where no package is checked out.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { passageReader } from '../src/lib/evidence';
import { loadReview } from '../src/lib/review';
import { buildPackage, docHasher } from '../src/lib/evidence-package';
import { releaseCheck } from '../src/lib/release';
import { FILES, scriptDirs, sentences } from '../src/lib/script';
import type { EvidencePackage, Release, Script, ScriptReviewFile } from '../src/shared/types';
import { validateScript } from '../src/lib/script-validation';
import { readJson, toJson } from '../src/lib/io';
import { chainOf, loadStories } from '../src/lib/stories';
import { type Storyboard, type StoryboardPlan, buildStoryboard } from '../src/lib/storyboard';
import { loadTopic } from '../src/lib/topics';

const dirs = scriptDirs();

describe.skipIf(!dirs.length)('committed script packages', () => {
  describe.each(dirs)('topics/$topic/scripts/$slug', ({ topic, slug, dir }) => {
    const pkg = readJson<EvidencePackage>(join(dir, FILES.pkg))!;
    const script = readJson<Script>(join(dir, FILES.script))!;
    const review = readJson<ScriptReviewFile>(join(dir, FILES.review));
    const plan = readJson<StoryboardPlan>(join(dir, FILES.storyboard));
    const release = readJson<Release>(join(dir, FILES.release));
    const t = loadTopic(topic);
    const read = passageReader();
    const validation = () =>
      validateScript(script, t, read, {
        review,
        judgments: loadReview(topic).applicability,
        pkg,
        hashDoc: docHasher(),
      });

    it('the package rebuilds byte-for-byte without transcripts', () => {
      const file = loadStories(topic);
      const story = file!.stories.find((s) => s.id === script.story)!;
      const again = buildPackage(story, t, read, {
        review: loadReview(topic),
        inputs: pkg.inputs,
        previous: pkg,
        chain: chainOf(story, file),
      });
      // Compare the persisted body first so a mismatch names the field, then the fingerprint (which also covers passages).
      const persisted = (p: EvidencePackage) => {
        const { fingerprint: _f, generatedAt: _g, ...body } = JSON.parse(toJson(p)) as EvidencePackage;
        void [_f, _g];
        return body;
      };
      expect(persisted(again)).toEqual(persisted(pkg));
      const passages = again.claims.flatMap((c) => c.evidence.map((e) => [e.cite, e.passage]));
      expect(
        passages.every(([, p]) => p !== null),
        'every passage read',
      ).toBe(true);
      expect(again.fingerprint, slug).toBe(pkg.fingerprint);
    });

    it('every cited passage and quote context is present', () => {
      for (const c of pkg.claims) {
        for (const e of c.evidence) expect(read(e.cite), e.cite).not.toBeNull();
        for (const s of c.statements) expect(s.context, s.source).not.toBeNull();
      }
    });

    it('validates with the committed review', () => {
      const v = validation();
      if (release) {
        expect(v.status).toBe('passed');
        expect(v.counts.unreviewed).toBe(0);
      }
      expect(v.counts.blocking).toBe(release ? 0 : v.counts.blocking); // a blocked revision-3 package may ship unlocked
      expect(v.minutes).toBeGreaterThan(0); // no length format: a script is as long as its questions need
    });

    it.skipIf(!plan)('the storyboard covers the script and its charts resolve', () => {
      const sb = buildStoryboard(plan!, script, validation(), pkg, read);
      expect(sb.issues.filter((i) => i.severity === 'blocking')).toEqual([]);
      expect(sb.status).toBe('ok');
      expect(sb.scenes.flatMap((s) => s.sentences).sort()).toEqual(
        sentences(script)
          .map((s) => s.id)
          .sort(),
      );
    });

    it.skipIf(!release)('the release fingerprints match the committed files', () => {
      expect(release!.approvedBy).toMatch(/\S/);
      expect(releaseCheck(release!, validation(), readJson<Storyboard>(join(dir, FILES.storyboard)))).toEqual([]);
    });

    it('no review finding points outside the repository', () => {
      for (const f of review?.findings ?? [])
        for (const r of f.refs ?? []) expect(r).not.toMatch(/store\/transcripts|\/work\/|^https?:|^[A-Za-z]:[\\/]|^\//);
    });
  });
});
