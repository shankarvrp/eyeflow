import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  globalTeardown: "./e2e/global-teardown.ts",
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm exec vite dev --host 127.0.0.1 --port 3000",
    env: {
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ?? "eyeflow-development-secret-change-before-production",
      BETTER_AUTH_URL: "http://127.0.0.1:3000",
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://eyeflow:eyeflow_dev_password@127.0.0.1:5432/eyeflow",
    },
    reuseExistingServer: !process.env.CI,
    url: "http://127.0.0.1:3000",
  },
});
