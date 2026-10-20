import { defineConfig } from "@playwright/test";

// Large-page performance check (spec/04 item 0.4, ADR 0007) against a `--mode perf` build of the
// app. Run on demand with `pnpm e2e:perf` from the repository root; never part of `pnpm e2e` or
// CI, so timing noise can't fail unrelated builds.
export default defineConfig({
  testDir: "./perf",
  testMatch: /\.perf\.ts$/,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  reporter: "list",
});
