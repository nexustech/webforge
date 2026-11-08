import { defineConfig } from "@playwright/test";

// The app's timings against architecture §10 (ADR 0007, 5.1) against a `--mode perf` build of the
// app: `pnpm e2e:perf` from the repository root, and CI's nightly Performance job on Windows and
// macOS. Never part of `pnpm e2e` or a pull request's CI, so timing noise can't fail unrelated
// builds. On CI a miss must repeat to fail: one retry, as a shared runner's one slow moment isn't
// the app's. A failure keeps its trace and screenshot, which the job uploads.
export default defineConfig({
  testDir: "./perf",
  testMatch: /\.perf\.ts$/,
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  reporter: "list",
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
});
