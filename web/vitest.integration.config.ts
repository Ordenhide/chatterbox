import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * The suite that needs live emulators.
 *
 * Separate from vitest.config.ts so `npm test` stays runnable with nothing
 * else started — a suite that only passes when a background service happens to
 * be up is one people learn to skip.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.integration.test.ts'],
    // One file, one Firebase app, and sign-in is global to it.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
