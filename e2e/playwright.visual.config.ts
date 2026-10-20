import { defineConfig } from "@playwright/test";

// Editor UI stories (packages/editor-ui): axe on every story in both themes, and screenshots in
// the pinned Linux CI container (R8), where fonts and rendering are stable. Build Storybook
// first: `pnpm visual` at the repository root does both. Screenshots are compared only when
// VISUAL_SCREENSHOTS=1, so local runs on Windows or macOS check accessibility only.
const PORT = 6107;

export default defineConfig({
  testDir: "./visual",
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 30_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  expect: {
    toHaveScreenshot: { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.001 },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: "chromium",
    viewport: { width: 800, height: 480 },
    // Menus and dialogs fade in; axe must not measure contrast halfway through a fade.
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node visual/serve-storybook.ts ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.json`,
    reuseExistingServer: !process.env.CI,
  },
});
