import { defineConfig } from '@playwright/test';

const port = process.env.DATABRICKS_APP_PORT ?? '8000';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: `http://localhost:${port}`,
    screenshot: 'on',
  },
  outputDir: '.smoke-test',
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
