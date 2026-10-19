import { defineConfig } from "@playwright/test";

// Tests of the packaged app (electron-builder --dir output). `pnpm e2e:packaged` at the repository
// root packages the app first.
export default defineConfig({
  testDir: "./packaged",
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
});
