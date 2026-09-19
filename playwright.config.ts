import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
const localChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (process.platform === 'win32' && existsSync(localChrome) ? localChrome : undefined);
const testBase = process.env.PWA_BASE_PATH || '/dragon/';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.ts', fullyParallel: false, workers: 1,
  timeout: 30_000, expect: { timeout: 8_000 },
  use: { baseURL: `http://127.0.0.1:4173${testBase}`, ...devices['Desktop Chrome'], launchOptions: executablePath ? { executablePath } : {}, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: process.env.SKIP_WEB_SERVER ? undefined : { command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort', url: `http://127.0.0.1:4173${testBase}`, reuseExistingServer: !process.env.CI },
});
