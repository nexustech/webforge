import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { z } from "zod";

// Every story of the editor UI in both themes, and of the site components in each theme on Desktop
// and Mobile (standards §5): no serious or critical axe violations, and (in CI's Linux container)
// a screenshot that matches the committed one. The site components' colour contrast is reported,
// not enforced: their colours come from the site's theme, which the site owner controls, and
// contrast is a warning they may override (product owner, #312). The editor's own UI stays strict.

const indexSchema = z.object({
  entries: z.record(
    z.string(),
    z.object({
      id: z.string(),
      title: z.string(),
      name: z.string(),
      type: z.string(),
      tags: z.array(z.string()).default([]),
    }),
  ),
});

/** A device width a site component's story is shown at, as the canvas toolbar's (1.15). */
type Device = { readonly name: string; readonly width: number; readonly height: number };

/** A package's Storybook build, served by playwright.visual.config.ts, and how to test it. */
type Build = {
  readonly package: string;
  readonly port: number;
  readonly themes: readonly string[];
  /** The widths to test at; the config's viewport when there are none. */
  readonly devices: readonly Device[];
  /** Whether axe's colour contrast is only reported (the site's theme decides it), not enforced. */
  readonly contrastReported: boolean;
};

/** Keep the ports in step with playwright.visual.config.ts. */
const BUILDS: readonly Build[] = [
  {
    package: "editor-ui",
    port: 6107,
    themes: ["dark", "light"],
    devices: [],
    contrastReported: false,
  },
  {
    package: "site-components",
    port: 6108,
    themes: ["light", "dark", "cupcake"],
    devices: [
      { name: "desktop", width: 1280, height: 800 },
      { name: "mobile", width: 375, height: 812 },
    ],
    contrastReported: true,
  },
];

/** The stories of `build`, from its index. */
function storiesOf(build: Build) {
  const index = resolve(
    import.meta.dirname,
    `../../packages/${build.package}/storybook-static/index.json`,
  );
  if (!existsSync(index)) {
    throw new Error(
      `No Storybook build at ${index}. Run \`pnpm visual\` from the repository root.`,
    );
  }
  return Object.values(indexSchema.parse(JSON.parse(readFileSync(index, "utf8"))).entries)
    .filter((entry) => entry.type === "story")
    .toSorted((a, b) => a.id.localeCompare(b.id));
}

const SCREENSHOTS = process.env.VISUAL_SCREENSHOTS === "1";

for (const build of BUILDS) {
  const stories = storiesOf(build);

  test(`finds the ${build.package} stories`, () => {
    expect(stories.length).toBeGreaterThan(0);
  });

  for (const story of stories) {
    for (const theme of build.themes) {
      for (const device of build.devices.length === 0 ? [undefined] : build.devices) {
        const shown = device === undefined ? theme : `${theme}, ${device.name}`;
        test(`${story.title} › ${story.name} (${shown})`, async ({ page }) => {
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));

          // Whole-window stories (the UI1 parity story) get a window-sized page.
          if (story.tags.includes("full-window")) {
            await page.setViewportSize({ width: 1280, height: 800 });
          }
          if (device !== undefined) {
            await page.setViewportSize({ width: device.width, height: device.height });
          }
          await page.goto(
            `http://127.0.0.1:${build.port}/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme}`,
          );
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          // Wait until Storybook has rendered the story and run its play function (the ContextMenu
          // story opens its menu there); dialogs render outside #storybook-root, so don't look there.
          await page.waitForFunction(
            () =>
              (window as { __STORYBOOK_PREVIEW__?: { currentRender?: { phase?: string } } })
                .__STORYBOOK_PREVIEW__?.currentRender?.phase === "finished",
          );
          await page.evaluate(() => document.fonts.ready);

          const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();
          const describe = (violation: (typeof results.violations)[number]) =>
            `${violation.id}: ${violation.nodes.map((node) => node.target).join(", ")}`;
          const serious = results.violations.filter(
            (violation) => violation.impact === "serious" || violation.impact === "critical",
          );
          const reported = build.contrastReported
            ? serious.filter((violation) => violation.id === "color-contrast")
            : [];
          for (const violation of reported) {
            test.info().annotations.push({ type: "contrast", description: describe(violation) });
            console.warn(`Contrast in ${story.id} (${theme}): ${describe(violation)}`);
          }
          expect(
            serious.filter((violation) => !reported.includes(violation)).map(describe),
          ).toEqual([]);
          expect(errors).toEqual([]);

          if (SCREENSHOTS) {
            const name =
              device === undefined
                ? `${story.id}--${theme}.png`
                : `${story.id}--${theme}--${device.name}.png`;
            await expect(page).toHaveScreenshot(name, { fullPage: true });
          }
        });
      }
    }
  }
}
