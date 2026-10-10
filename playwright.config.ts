import { defineConfig, devices } from '@playwright/test';

// v1.75.0 : parcours de bout en bout « première utilisation » par rôle, sur un
// déploiement réel (aperçu Vercel ou production). Voir e2e/README.md.
// Les identifiants viennent de variables d'environnement, jamais du dépôt.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: 'retain-on-failure',
    // Navigateur préinstallé (cloud Claude Code) si présent, sinon celui de Playwright.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 14'], browserName: 'chromium' } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'ipad', use: { ...devices['iPad (gen 7) landscape'], browserName: 'chromium' } },
  ],
});
