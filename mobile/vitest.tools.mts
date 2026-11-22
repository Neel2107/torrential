import { defineConfig } from 'vitest/config';

/** The oxlint rules' own tests. oxlint's RuleTester expects `describe` and `it` as globals. */
export default defineConfig({
  test: {
    include: ['tools/oxlint/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'tools/oxlint/anti-slop/rules/require-readable-spacing-cli.test.ts'],
    globals: true,
  },
});
