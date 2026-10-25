import { defineConfig } from "@playwright/test";

// The editor UI's and the site components' stories (packages/editor-ui, packages/site-components):
// axe on every story in each theme (and, for site components, on Desktop and Mobile), and
// screenshots in the pinned Linux CI container (R8), where fonts and rendering are stable. Build
// both Storybooks first: `pnpm visual` at the repository root does all of it. Screenshots are
// compared only when VISUAL_SCREENSHOTS=1, so local runs on Windows or macOS check accessibility
// only. Keep the ports in step with visual/stories.spec.ts.
//
// The templates' thumbnails (2.14b) are a project of their own: each template's home page, built by
// the pipeline, screenshotted beside the template (`packages/templates/templates/<id>/`), in the
// same container, so CI checks them as it does the stories. `pnpm template-thumbnails` rewrites
// them.
const EDITOR_PORT = 6107;
const SITE_PORT = 6108;

export default defineConfig({
  testDir: "./visual",
  // Every story is its own test in one file; run them across workers.
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 30_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  expect: {
    toHaveScreenshot: { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.001 },
  },
  use: {
    browserName: "chromium",
    viewport: { width: 800, height: 480 },
    // Menus and dialogs fade in; axe must not measure contrast halfway through a fade.
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "stories", testMatch: /stories\.spec\.ts$/ },
    {
      name: "template-thumbnails",
      testMatch: /template-thumbnails\.spec\.ts$/,
      snapshotPathTemplate: "../packages/templates/templates/{arg}{ext}",
      // A desktop page, drawn at half size: a card's thumbnail, 640×400.
      use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 0.5 },
    },
  ],
  webServer: [
    {
      command: `node visual/serve-storybook.ts editor-ui ${EDITOR_PORT}`,
      url: `http://127.0.0.1:${EDITOR_PORT}/index.json`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `node visual/serve-storybook.ts site-components ${SITE_PORT}`,
      url: `http://127.0.0.1:${SITE_PORT}/index.json`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
