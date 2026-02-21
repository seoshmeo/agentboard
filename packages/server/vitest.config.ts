import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      DB_PATH: ':memory:',
    },
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
