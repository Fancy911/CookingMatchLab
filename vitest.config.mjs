import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const tsconfigRaw = readFileSync(
  new URL('./tsconfig.vitest.json', import.meta.url),
  'utf8',
);

export default defineConfig({
  esbuild: {
    tsconfigRaw,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: ['default'],
    testTimeout: 20_000,
  },
});
