// `topics -- claim` (spec §15 item 1, register D8): the one array literal in src/config/site.ts gains the topic for
// the commission the approved proposal names; pure over the file text, idempotent, refused for another commission's
// topic or a proposal that is not approved.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runCli } from '../../../shared/cli';
import { ROOT, readJson, toJson } from '../../../shared/io';
import type { Proposal, ProposalReview } from '../../../shared/types';
import { claimEdit, claimedBy } from '../claim';
import { PROPOSALS_DIR, proposalPath, reviewPath } from '../proposals';
import { cliRoot } from '../../../../tests/production-helpers';

const FIX = join(ROOT, 'tests', 'fixtures', 'proposals');
const SITE = readFileSync(join(ROOT, 'src', 'config', 'site.ts'), 'utf8');
const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })), 60_000);

describe('claimEdit', () => {
  it("adds the topic once to the commission's topics literal in the real site.ts text, keeping the quote style", () => {
    const r = claimEdit(SITE, 'spending', 'ev-running-costs');
    expect('changed' in r && r.changed).toBe(true);
    const text = (r as { source: string }).source;
    expect(text).toMatch(/topics: \['heat-pumps', 'inflation-2026', 'ev-running-costs'\]/);
    expect(claimedBy(text, 'ev-running-costs')).toBe('spending');
    const again = claimEdit(text, 'spending', 'ev-running-costs');
    expect(again).toEqual({ source: text, changed: false });
    expect(claimEdit(text, 'dubious-returns', 'ev-running-costs')).toMatchObject({
      problem: expect.stringMatching(/claimed by spending/),
    });
    expect(claimEdit(SITE, 'nobody', 'xyz-topic')).toMatchObject({
      problem: expect.stringMatching(/no commission nobody/),
    });
    expect(claimEdit('export const commissions = {};', 'spending', 'xyz-topic')).toMatchObject({
      problem: expect.stringMatching(/no commission spending/),
    });
    expect(claimEdit(SITE, 'spending', 'Bad Slug')).toMatchObject({ problem: expect.stringMatching(/slug/) });
  });
});

describe('npm run topics -- claim', () => {
  const fresh = (status: Proposal['status']) => {
    const root = mkdtempSync(join(tmpdir(), 'vk-claim-'));
    roots.push(root);
    cliRoot(root);
    mkdirSync(join(root, 'src', 'config'), { recursive: true });
    writeFileSync(join(root, 'src', 'config', 'site.ts'), SITE);
    mkdirSync(join(root, PROPOSALS_DIR), { recursive: true });
    writeFileSync(
      proposalPath('ev-running-costs', root),
      toJson({
        ...readJson<Proposal>(join(FIX, 'good.json'))!,
        status,
        ...(status !== 'proposed' && { decidedBy: 'Jon' }),
      }),
    );
    writeFileSync(
      reviewPath('ev-running-costs', root),
      toJson(readJson<ProposalReview>(join(FIX, 'good.review.json'))!),
    );
    const topics = (args: string[]) =>
      runCli('topics', args, { cwd: root, env: { ...process.env, VK_NO_DOTENV: '1' } });
    return { root, topics, site: () => readFileSync(join(root, 'src', 'config', 'site.ts'), 'utf8') };
  };
  it('refuses an unapproved proposal and another commission; claims once for the approved one, idempotently; --force with --by claims for another', () => {
    const c = fresh('proposed');
    const r = c.topics(['claim', 'ev-running-costs', 'spending']);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/not approved/);
    expect(c.site()).toBe(SITE);
    const d = fresh('approved');
    const other = d.topics(['claim', 'ev-running-costs', 'dubious-returns']);
    expect(other.status).toBe(2);
    expect(other.stderr).toMatch(/names spending/);
    const ok = d.topics(['claim', 'ev-running-costs', 'spending']);
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toMatch(/claimed ev-running-costs for spending/);
    expect(ok.stdout).toMatch(/npm run brand/);
    expect(d.site()).toMatch(/'inflation-2026', 'ev-running-costs'\]/);
    const again = d.topics(['claim', 'ev-running-costs', 'spending']);
    expect(again.status).toBe(0);
    expect(again.stdout).toMatch(/already claimed/);
    const dry = fresh('approved');
    expect(dry.topics(['claim', 'ev-running-costs', 'spending', '--dry-run']).status).toBe(0);
    expect(dry.site()).toBe(SITE);
    const forced = fresh('approved');
    expect(forced.topics(['claim', 'ev-running-costs', 'dubious-returns', '--force']).status).toBe(2); // --force needs --by
    const f2 = forced.topics(['claim', 'ev-running-costs', 'dubious-returns', '--force', '--by', 'Jon']);
    expect(f2.status, f2.stderr).toBe(0);
    expect(forced.site()).toMatch(/topics: \['get-rich-quick', 'ev-running-costs'\]/);
  }, 120_000);
});
