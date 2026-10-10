import { defineConfig, devices } from '@playwright/test';

// v1.76.0 : tests FONCTIONNELS complets sur la pile locale (scripts/qa-stack/),
// jamais sur la production : vraie application, vraie base PostgreSQL
// (migrations du dépôt + données synthétiques), vrais clics dans Chromium.
// Lancer : npm run qa:functional (voir scripts/qa-stack/README.md).
export default defineConfig({
  testDir: './qa/functional',
  timeout: 120_000,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: '.qa/functional-report.json' }]],
  use: {
    baseURL: process.env.QA_BASE_URL || 'http://localhost:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Caméra simulée (comme un vrai téléphone) : sans elle, le scanner QR et
    // l'invité surprise échouent faute de périphérique.
    permissions: ['camera'],
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
      ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
    },
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 14'], browserName: 'chromium' } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'ipad-paysage', use: { ...devices['iPad (gen 7) landscape'], browserName: 'chromium' } },
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'] } },
  ],
});
