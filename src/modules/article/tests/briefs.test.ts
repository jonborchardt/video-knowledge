// The article briefs carry the modes the maintenance pass sends (review finding 2): a reviewer in reaffirm mode
// writes `reaffirm: { ok, why }` beside its approvals; a writer in correction mode changes only what the revised
// finding touches. The runner reads these fields, so the briefs must ask for them.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../../../shared/io';
import type { ScriptReviewFile } from '../../../shared/types';

const brief = (f: string) => readFileSync(join(ROOT, 'src', 'modules', 'article', 'briefs', f), 'utf8');

describe('the article briefs and the maintenance modes', () => {
  it('the review brief defines Mode: reaffirm with the reaffirm field, and Mode: correction', () => {
    const r = brief('article-review.md');
    expect(r).toMatch(/Mode: reaffirm/);
    expect(r).toMatch(/"reaffirm": \{ "ok": (true \| false|<true or false>)/);
    expect(r).toMatch(/Mode: correction/);
  });
  it('the writer brief defines Mode: correction over the Revised: line', () => {
    const w = brief('article.md');
    expect(w).toMatch(/Mode: correction/);
    expect(w).toMatch(/Revised:/);
  });
  it('the review file type carries the reaffirmation', () => {
    const r: ScriptReviewFile = {
      reviewer: 'x',
      date: 'd',
      revision: 1,
      approved: {},
      findings: [],
      reaffirm: { ok: true, why: 'the text reports the survey as a survey' },
    };
    expect(r.reaffirm?.ok).toBe(true);
  });
});
