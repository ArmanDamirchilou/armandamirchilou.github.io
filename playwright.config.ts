import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the production build (vite preview), with the
// twin's backend mocked per test so results never depend on free LLM quotas.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4174',
    launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=user-gesture-required'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    // Safari's engine: its media element and autoplay rules differ, and the
    // twin's voice once worked in Chrome only.
    { name: 'safari', use: { ...devices['Desktop Safari'], launchOptions: {} }, testMatch: /twin\.spec/ },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
