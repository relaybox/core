import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // silent: true,
    tsconfig: './tsconfig.json',
    include: ['**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/node_modules/**', '**/*.test.ts']
    },
    logLevel: 'info'
  }
});
