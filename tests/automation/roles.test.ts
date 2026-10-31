import { describe, expect, it } from 'vitest';
import { AGENT_ROLES } from '../../src/shared/automation';
import { CONTENT_ROLES, deniedFor, grantFor } from '../../src/orchestration/run/roles';

const subject = { topic: 'heat-pumps', storyId: 'decision:when-does-it-pay' };
const story = 'topics/heat-pumps/scripts/decision-when-does-it-pay';

describe('roles (the agent permission table, as code)', () => {
  it('a writer may edit exactly the six story files, nothing under src/, and has no shell', () => {
    const g = grantFor('writer', subject);
    expect(g.writable.sort()).toEqual(
      ['script.json', 'storyboard.json', 'article.json', 'cta.json', 'video/render.json', 'video/music.json']
        .map((f) => `${story}/${f}`)
        .sort(),
    );
    expect(g.writable.some((p) => p.startsWith('src/'))).toBe(false);
    expect(g.shell).toEqual([]);
    expect(g.web).toBe(true);
  });
  it('a reviewer writes only the review files of its subject', () => {
    const g = grantFor('reviewer', subject);
    expect(g.writable).toContain(`${story}/script-review.json`);
    expect(g.writable).toContain(`${story}/video/draft-review.json`);
    expect(g.writable).not.toContain(`${story}/script.json`);
    expect(g.shell).toEqual([]);
  });
  it('graphics may add components and registrations and run two fixed video verbs', () => {
    const g = grantFor('graphics', subject);
    expect(g.writable).toContain('src/modules/video/remotion/scenes/*.tsx');
    expect(g.writable).toContain('src/modules/video/bespoke/heat-pumps-decision-when-does-it-pay.ts');
    expect(g.newFilesOnly).toEqual(['src/modules/video/remotion/scenes/*.tsx']);
    expect(g.additiveOnly.sort()).toEqual(
      ['src/modules/video/bespoke/index.ts', 'src/modules/video/remotion/scenes/index.ts'].sort(),
    );
    expect(g.shell).toEqual(['Bash(npm run video -- frames *)', 'Bash(npm run video -- check *)']);
  });
  it('extraction and collect write only under the topic work folder and sources', () => {
    const e = grantFor('extraction', { topic: 'heat-pumps' });
    expect(e.writable).toContain('topics/heat-pumps/work/h*.json');
    expect(e.shell).toEqual([]);
    const c = grantFor('collect', { topic: 'heat-pumps' });
    expect(c.writable).toContain('topics/heat-pumps/sources/*.txt');
    expect(c.shell).toEqual(['Bash(npm run evidence -- search *)', 'Bash(npm run evidence -- fetch-doc *)']);
  });
  it('discovery, proposalReview and notes write one file or nothing', () => {
    expect(grantFor('discovery', { topic: 'x', slug: 'ev-range' }).writable).toEqual(['proposals/ev-range.json']);
    expect(grantFor('proposalReview', { topic: 'x', slug: 'ev-range' }).writable).toEqual([
      'proposals/ev-range.review.json',
    ]);
    expect(grantFor('notes', { topic: 'x' }).writable).toEqual([]);
  });
  it('content roles are every role without a shell', () => {
    expect(CONTENT_ROLES.sort()).toEqual(
      ['writer', 'reviewer', 'extraction', 'discovery', 'proposalReview', 'draftReview', 'notes'].sort(),
    );
    for (const r of AGENT_ROLES) expect(grantFor(r, subject).shell.length === 0).toBe(CONTENT_ROLES.includes(r));
  });
  it('every role is denied the secrets and the machinery; graphics keeps the shared renderer files denied', () => {
    for (const r of AGENT_ROLES) {
      const d = deniedFor(r);
      for (const must of [
        'Read(.env)',
        'Read(.env.*)',
        'Read(.secrets/**)',
        'Edit(package.json)',
        'Edit(.claude/**)',
        'Edit(automation.json)',
        'Edit(node_modules/**)',
        'Edit(.automation/**)',
      ])
        expect(d).toContain(must);
      if (r !== 'graphics') expect(d).toContain('Edit(src/**)');
    }
    const g = deniedFor('graphics');
    expect(g).toContain('Edit(src/modules/video/remotion/theme.ts)');
    expect(g).toContain('Edit(src/modules/video/remotion/Video.tsx)');
    expect(g).toContain('Edit(src/modules/video/kinds.ts)');
    expect(g).toContain('Edit(src/shared/**)');
    expect(g).not.toContain('Edit(src/**)');
  });
});
