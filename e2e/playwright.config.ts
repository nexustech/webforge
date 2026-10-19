import { defineConfig } from "@playwright/test";

// Electron E2E tests. They run against the production build in apps/desktop/out, so build the
// app first: `pnpm e2e` at the repository root does both.
export default defineConfig({
  testDir: "./app",
  // One Electron instance at a time keeps runs stable on CI machines.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    trace: "retain-on-failure",
  },
});
