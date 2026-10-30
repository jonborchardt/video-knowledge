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
