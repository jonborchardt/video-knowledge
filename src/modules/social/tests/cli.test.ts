// `npm run social -- post` as a child: off by policy, not configured, a dry run, one post, idempotent, a refusal.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runCli } from '../../../shared/cli';
import { readJson, toJson } from '../../../shared/io';
import { appendEvent, emptyLedger, loadLedger, publishPath, saveLedger } from '../../publishing/publish';
import { socialPath } from '../social';
import { type Fixture, cliRoot, syntheticProduction } from '../../../../tests/production-helpers';

const fixtures: Fixture[] = [];
afterAll(() => fixtures.forEach((f) => f.cleanup()));

function live() {
  const f = syntheticProduction('packaged', { release: true });
  fixtures.push(f);
  cliRoot(f.root);
  const l = loadLedger(f.topic, f.story, f.root) ?? emptyLedger(`${f.topic}/${f.story}`);
  saveLedger(
    publishPath(f.topic, f.story, f.root),
    appendEvent(l, 'youtube', { at: '2026-11-01T00:00:00Z', type: 'published', by: 'Jon', id: 'vid00000000' }).ledger,
  );
  const fake = join(f.root, 'x-fake.json');
  const keys = {
    X_SPENDING_API_KEY: 'k',
    X_SPENDING_API_SECRET: 's',
    X_SPENDING_ACCESS_TOKEN: 't',
    X_SPENDING_ACCESS_SECRET: 'ts',
    X_SPENDING_USER_ID: '1',
    X_SPENDING_HANDLE: '@CORSpendingTest',
  };
  const base = { ...process.env, VK_NO_DOTENV: '1', X_FAKE: fake };
  const social = (args: string[], env: NodeJS.ProcessEnv = { ...base, ...keys }) =>
    runCli('social', [args[0], f.topic, f.story, ...args.slice(1)], { cwd: f.root, env });
  const on = () => writeFileSync(join(f.root, 'automation.json'), toJson({ enabled: { social: true } }));
  return { f, fake, social, on, base, keys };
}

describe('npm run social', () => {
  it('post is refused while the policy is off, prints not configured without keys, and a dry run writes nothing', () => {
    const { f, social, on, base } = live();
    const off = social(['post']);
    expect(off.status).toBe(2);
    expect(off.stderr).toMatch(/social is off/);
    on();
    const none = social(['post'], base);
    expect(none.status).toBe(0);
    expect(none.stdout).toMatch(/not configured/);
    expect(existsSync(socialPath(f.topic, f.story, f.root))).toBe(false);
    const dry = social(['post', '--dry-run']);
    expect(dry.status).toBe(0);
    expect(dry.stdout).toMatch(/dry run: @CORSpendingTest would post:/);
    expect(dry.stdout).toContain('https://www.youtube.com/watch?v=vid00000000');
    expect(existsSync(socialPath(f.topic, f.story, f.root))).toBe(false);
    const composed = social(['compose']);
    expect(composed.status).toBe(0);
    expect(composed.stdout).toMatch(/of 280 as X counts/);
  }, 120_000);

  it('posts once, records it, and a second post finds it posted; an output that is not live is refused', () => {
    const { f, fake, social, on } = live();
    on();
    const r1 = social(['post']);
    expect(r1.status).toBe(0);
    expect(r1.stdout).toMatch(/RESULT: POSTED https:\/\/x.com\/i\/status\/fake1/);
    expect(readJson<{ posts: unknown[] }>(fake)!.posts).toHaveLength(1);
    const file = readJson<{ outputs: { youtube: { posts: { status: string; account: string }[] } } }>(
      socialPath(f.topic, f.story, f.root),
    )!;
    expect(file.outputs.youtube.posts[0]).toMatchObject({ status: 'posted', account: '@CORSpendingTest' });
    const r2 = social(['post']);
    expect(r2.status).toBe(0);
    expect(readJson<{ posts: unknown[] }>(fake)!.posts).toHaveLength(1);
    const show = social(['show']);
    expect(show.stdout).toMatch(/youtube: posted https:\/\/x.com\/i\/status\/fake1/);
    const short = social(['post', '--output', 'short:one']);
    expect(short.status).toBe(2);
    expect(short.stderr).toMatch(/short:one is not live/);
    writeFileSync(fake, JSON.stringify({ posts: [], fail: { status: 503, body: 'down' } }));
    const l = loadLedger(f.topic, f.story, f.root)!;
    l.outputs['short:one'] = { kind: 'youtube-short', derivedFrom: 'youtube', metadata: {}, events: [] };
    saveLedger(
      publishPath(f.topic, f.story, f.root),
      appendEvent(l, 'short:one', { at: '2026-11-01T00:02:00Z', type: 'published', by: 'Jon', id: 'vid00000001' })
        .ledger,
    );
    const down = social(['post', '--output', 'short:one']);
    expect(down.status).toBe(1);
    expect(down.stdout).toMatch(/RESULT: FAILED \(retryable\)/);
  }, 120_000);
});
