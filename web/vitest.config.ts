import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // The integration suite talks to the Auth and Firestore emulators, so it
    // cannot run here — `npm run test:auth` from the repo root starts them and
    // points vitest at vitest.integration.config.ts instead.
    exclude: ['**/node_modules/**', 'src/**/*.integration.test.ts'],
    setupFiles: [],
  },
});
