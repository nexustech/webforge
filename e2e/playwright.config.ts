import { defineConfig } from "@playwright/test";

// E2E tests against the production build in apps/desktop/out, so build the app first:
// `pnpm e2e` at the repository root does both.
//
// - app: the Electron app itself.
// - export-setup → export-*: the app exports the fixture site once, and the pipeline every
//   template (3.10), then Chromium, Firefox and WebKit, and Edge on Windows, open them from disk
//   (file://) with the network blocked (X1, C8).
export default defineConfig({
  // One Electron instance at a time keeps runs stable on CI machines.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  // On CI, the whole run stops after 26 minutes with Playwright's report of the test it was in and
  // the ones it didn't reach: a run held up past the job's limit was cancelled with no report at
  // all (#1161). The E2E jobs allow 35 (ci.yml), and the 9 minutes between cover what the job does
  // besides Playwright: its setup (about 1.5), `pnpm e2e`'s build before the tests, uncached on a
  // slow runner, and the report's upload after. CI runs the tests in parts (#1286): the app's in
  // shards and the exported site's in a job of their own. In a full run on 21 Nov 2026 the longest
  // part, macOS's app 2/3, took 13 minutes, half the limit; the two shards before took 18–26.
  globalTimeout: process.env.CI ? 26 * 60_000 : 0,
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
    // Edge, installed with Windows, which has no other browser to try the exported site in (3.10).
    ...(process.platform === "win32"
      ? [
          {
            name: "export-msedge",
            testDir: "./export",
            testMatch: /\.spec\.ts$/,
            dependencies: ["export-setup"],
            use: { browserName: "chromium" as const, channel: "msedge" },
          },
        ]
      : []),
  ],
});
