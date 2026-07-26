import {defineConfig, devices} from '@playwright/test';

// Smoke E2E for the login/boot path. Run:  npx playwright install chromium && npm run test:e2e
// It boots the Vite dev server automatically. A fresh browser context has no
// persisted auth, so the app renders the LoginScreen.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{name: 'chromium', use: {...devices['Desktop Chrome']}}],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
