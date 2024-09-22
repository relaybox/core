import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      src: resolve(__dirname, 'src'),
      '@/util': resolve(__dirname, 'src/util'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/modules': resolve(__dirname, 'src/modules'),
      '@/lib': resolve(__dirname, 'src/lib')
    }
  },
  test: {
    // silent: true,
    globals: true,
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
