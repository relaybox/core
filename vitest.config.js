import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    tsconfig: './tsconfig.json',
    include: ['**/*.test.ts'],
    environment: 'node',
    // setupFiles: ['./path/to/setupTests.ts'], // Adjust if you have specific setup files
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/node_modules/**', '**/*.test.ts']
    },
    logLevel: 'info'
  }
});
