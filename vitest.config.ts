import { configDefaults, defineConfig } from 'vitest/config';

// `unit` is `npm test` (and so `npm run validate` and CI); `browser` drives real browsers against the built site and
// runs only through `npm run test:browser` / `npm run quality` (.claude/skills/web-quality/SKILL.md).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/**/*.test.ts', 'src/modules/**/tests/**/*.test.ts'],
          exclude: [...configDefaults.exclude, 'tests/browser/**'],
          // The unit suite runs the repo's CLIs (board, publish, packaging, final) as real processes beside the
          // fixture-copying tests; vitest's 5 s default was the budget of an in-process suite and times out
          // healthy tests under that load. 30 s still catches a hang; no assertion depends on the timeout.
          testTimeout: 30_000,
          // afterAll hooks delete many copied topic roots; on Windows under a full validate that takes minutes.
          hookTimeout: 300_000,
          // Six workers, not vitest's default of one per logical processor (12 here): on 2026-11-06 two default runs
          // failed on rotating timeouts with ~2 GB of 16 free, six passed every run since. The automated validate
          // (a run's finish, the launch, the scan) runs beside whatever else the machine is doing, a render included.
          maxWorkers: 6,
        },
      },
      {
        test: {
          name: 'browser',
          include: ['tests/browser/**/*.test.ts'],
          testTimeout: 120_000,
          hookTimeout: 180_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
