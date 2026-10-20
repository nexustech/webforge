import { defineConfig } from "@playwright/test";

// E2E tests against the production build in apps/desktop/out, so build the app first:
// `pnpm e2e` at the repository root does both.
//
// - app: the Electron app itself.
// - export-setup → export-*: the app exports the fixture site once, then Chromium, Firefox and
//   WebKit open it from disk (file://) with the network blocked (X1, C8).
export default defineConfig({
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
  projects: [
    { name: "app", testDir: "./app" },
    { name: "export-setup", testDir: "./export", testMatch: /\.setup\.ts$/ },
    ...(["chromium", "firefox", "webkit"] as const).map((browserName) => ({
      name: `export-${browserName}`,
      testDir: "./export",
      testMatch: /\.spec\.ts$/,
      dependencies: ["export-setup"],
      use: { browserName },
    })),
  ],
});
