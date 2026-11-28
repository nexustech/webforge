import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { THEME_PRESETS } from "@webforge/themes";
import { z } from "zod";

// Every story of the editor UI in both themes, and of the site components in each theme on Desktop
// and Mobile (standards §5): no serious or critical axe violations, and (in CI's Linux container)
// a screenshot that matches the committed one. The site components are shown in Webforge's own
// presets (2.16): the three development presets on every pull request, and with
// VISUAL_ALL_THEMES=1 (the nightly run) in every preset, screenshots kept for the first three. The site components' colour contrast is reported,
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

/** A footer's button, as the story draws it: its words, its variant and whether it's the way out. */
type FooterButton = { readonly text: string; readonly variant: string; readonly wayOut: boolean };

/** The words of a way out drawn without `DialogCancel`, `DialogCloseButton` or `AlertDialogCancel`. */
const WAY_OUT_WORDS = new Set(["Cancel", "Close"]);

/**
 * What breaks the footer rule (#1444) in `buttons`, in order: a way out (Cancel or Close) not in
 * the filled grey `secondary`; one followed by anything but Back and the primary; a last button
 * that's neither the primary (`default` or `destructive`) nor a way out. While You Were Away's
 * **Keep** is its primary, an answer, not a way out, so it passes as one.
 */
function footerFaults(buttons: readonly FooterButton[]): string[] {
  const faults: string[] = [];
  const primary = (button: FooterButton | undefined) =>
    button?.variant === "default" || button?.variant === "destructive";
  buttons.forEach((button, at) => {
    const wayOut = button.wayOut || WAY_OUT_WORDS.has(button.text);
    if (!wayOut) return;
    if (button.variant !== "secondary") faults.push(`${button.text} is ${button.variant}`);
    const after = buttons.slice(at + 1);
    const allowed =
      after.length === 0 ||
      (after.length === 1 && primary(after[0])) ||
      (after.length === 2 && after[0]?.text === "Back" && primary(after[1]));
    if (!allowed) faults.push(`${button.text} is followed by ${after.map((each) => each.text)}`);
  });
  const last = buttons.at(-1);
  if (last !== undefined && !primary(last) && !last.wayOut && !WAY_OUT_WORDS.has(last.text)) {
    faults.push(`it ends with ${last.text} (${last.variant}), not the primary or a way out`);
  }
  return faults;
}

/**
 * Every editor story that shows a confirmation, by its id, and whether what it confirms is outside
 * Undo (#1445, T6 in research/product/01-terminology.md). Its confirming button is red only when
 * it is. A story showing one that isn't listed fails, so each new confirmation is decided here.
 *
 * It sees AlertDialog confirmations only (`[data-slot="alert-dialog-content"]`): a question that
 * confirms an action is always an AlertDialog in this editor (the site-wide confirmation, Discard,
 * Delete Page and the rest), as `docs/extending.md`'s footer rule has it (`AlertDialogCancel` in a
 * confirmation). One built on a plain `Dialog` with a red button in its footer would slip past.
 */
const CONFIRMATIONS: ReadonlyMap<string, boolean> = new Map([
  ["base-alertdialog--delete-page", false],
  ["base-alertdialog--delete-version", true],
  ["base-dialog--unsaved-changes", true],
  ["ai-mediarequestdialog--asking", false],
  ["edit-apply-look-to-every--confirmation", false],
  ["edit-apply-look-to-every--confirmation-on-this-page", false],
  ["dialogs-ai-apps--removing", true],
  ["dialogs-clear-recent--asking", true],
  ["dialogs-diagnostics--clearing", true],
  ["dialogs-my-themes--delete-in-use", true],
  ["dialogs-publish-outcome--replace-other-site", true],
  ["dialogs-theme-studio-your-colours--deleting-one-in-use", false],
  ["panels-media--deleting-one-in-use", false],
  ["panels-pages--delete-blog", false],
  ["shell-sitewideconfirmdialog--delete-page", false],
  ["shell-sitewideconfirmdialog--ai-app-offers-unasked", false],
  ["shell-sitewideconfirmdialog--shared-footer-element", false],
  ["shell-sitewideconfirmdialog--long-plan", false],
  ["shell-sitewideconfirmdialog--ai-app-sets-logo", false],
]);

/** The development presets (S3) every pull request checks the site components in (2.16). */
const PR_PRESETS: readonly string[] = ["light", "dark", "high-contrast-rounded"];

/** Every preset, checked nightly (2.16); a pull request checks {@link PR_PRESETS}. */
const SITE_THEMES: readonly string[] =
  process.env.VISUAL_ALL_THEMES === "1" ? THEME_PRESETS.map((preset) => preset.preset) : PR_PRESETS;

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
    themes: SITE_THEMES,
    devices: [
      { name: "desktop", width: 1280, height: 800 },
      { name: "mobile", width: 375, height: 812 },
    ],
    contrastReported: true,
  },
];

/**
 * Tablet's narrowest width (`TABLET_FROM` in @webforge/model), where a layout first leaves its
 * one-column Mobile form. A site component's story tagged `tablet` is checked there too: one whose
 * layout changes at that width (a Steps section's row, #1134).
 */
const TABLET: Device = { name: "tablet", width: 768, height: 1024 };

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
    // A story that shows its own theme (the themes' pages, 2.13) looks the same in every one.
    const themes = story.tags.includes("own-theme") ? build.themes.slice(0, 1) : build.themes;
    for (const theme of themes) {
      const devices =
        build.devices.length > 0 && story.tags.includes("tablet")
          ? [...build.devices, TABLET]
          : build.devices;
      for (const device of devices.length === 0 ? [undefined] : devices) {
        const shown = device === undefined ? theme : `${theme}, ${device.name}`;
        test(`${story.title} › ${story.name} (${shown})`, async ({ page }) => {
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));

          // Whole-window stories (the UI1 parity story) get a window-sized page, and those that
          // show a dialog filling a large window (CT-11) a full-HD one.
          if (story.tags.includes("full-window")) {
            await page.setViewportSize({ width: 1280, height: 800 });
          }
          if (story.tags.includes("wide-window")) {
            await page.setViewportSize({ width: 1920, height: 1080 });
          }
          // A dialog in the app's smallest window (#1172): its buttons stay in view.
          if (story.tags.includes("short-window")) {
            await page.setViewportSize({ width: 960, height: 600 });
          }
          if (device !== undefined) {
            await page.setViewportSize({ width: device.width, height: device.height });
          }
          await page.goto(
            `http://127.0.0.1:${build.port}/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme}`,
          );
          // Wait until Storybook has rendered the story and run its play function (the ContextMenu
          // story opens its menu there); dialogs render outside #storybook-root, so don't look there.
          await page.waitForFunction(
            () =>
              (window as { __STORYBOOK_PREVIEW__?: { currentRender?: { phase?: string } } })
                .__STORYBOOK_PREVIEW__?.currentRender?.phase === "finished",
          );
          // A story that draws after it renders says so until it has (the app's panelStory():
          // its panels register in an effect), so a slow story is waited for, not failed (#365).
          await expect(
            page.locator('[data-story-state="drawing"]'),
            `${story.title} › ${story.name} is still drawing: its panels never registered`,
          ).toHaveCount(0, { timeout: 15_000 });
          // A play function, or the keyboard check every site component's story ends with (2.16),
          // that fails shows Storybook's error display, not the story.
          const failed = await page.evaluate(() =>
            document.body.classList.contains("sb-show-errordisplay")
              ? (document.querySelector("#error-message")?.textContent ?? "an error")
              : null,
          );
          expect(failed, `${story.title} › ${story.name} failed its checks`).toBeNull();
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          if (build.package === "site-components" && !story.tags.includes("own-theme")) {
            // The preset's stylesheet is on the page (2.16): a theme that fails to load fails here,
            // nightly too, where most presets have no screenshots to show it (PH2-16).
            const stylesheet = await page
              .locator("style#webforge-theme")
              .evaluate((style) => style.textContent?.length ?? 0);
            expect(stylesheet, `${theme}'s stylesheet`).toBeGreaterThan(1000);
          }
          await page.evaluate(() => document.fonts.ready);

          const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();
          // axe checked the story: a story that drew nothing passes no rule (PH2-16).
          expect(results.passes.length, "axe checked the story").toBeGreaterThan(0);
          const summarise = (violation: (typeof results.violations)[number]) =>
            `${violation.id}: ${violation.nodes.map((node) => node.target).join(", ")}`;
          const serious = results.violations.filter(
            (violation) => violation.impact === "serious" || violation.impact === "critical",
          );
          const reported = build.contrastReported
            ? serious.filter((violation) => violation.id === "color-contrast")
            : [];
          for (const violation of reported) {
            test.info().annotations.push({ type: "contrast", description: summarise(violation) });
            console.warn(`Contrast in ${story.id} (${theme}): ${summarise(violation)}`);
          }
          expect(
            serious.filter((violation) => !reported.includes(violation)).map(summarise),
          ).toEqual([]);
          expect(errors).toEqual([]);

          // Every dialog's footer follows the rule (#1444, docs/extending.md): other actions, the
          // way out (Cancel or Close, filled grey), Back in a dialog of steps, then the primary.
          if (build.package === "editor-ui") {
            const footers = await page.evaluate(() =>
              [
                ...document.querySelectorAll<HTMLElement>(
                  '[data-slot="dialog-footer"], [data-slot="alert-dialog-footer"]',
                ),
              ]
                .filter((footer) => footer.checkVisibility())
                .map((footer) =>
                  [...footer.querySelectorAll<HTMLElement>("button")]
                    .filter((button) => button.checkVisibility())
                    .map((button) => ({
                      text: button.textContent?.trim() ?? "",
                      variant: button.dataset.variant ?? "",
                      wayOut: button.dataset.wayOut !== undefined,
                    })),
                ),
            );
            for (const buttons of footers) {
              expect(footerFaults(buttons), `${story.title} › ${story.name}'s footer`).toEqual([]);
            }

            // A confirmation's button is red only for what Undo can't bring back (#1445).
            const red = await page.evaluate(() => {
              const shown = [
                ...document.querySelectorAll<HTMLElement>('[data-slot="alert-dialog-content"]'),
              ].some((content) => content.checkVisibility());
              if (!shown) return null;
              return [
                ...document.querySelectorAll<HTMLElement>(
                  '[data-slot="alert-dialog-footer"] button',
                ),
              ].some(
                (button) => button.checkVisibility() && button.dataset.variant === "destructive",
              );
            });
            if (red !== null) {
              const outsideUndo = CONFIRMATIONS.get(story.id);
              expect(
                outsideUndo,
                `${story.id} shows a confirmation: add it to CONFIRMATIONS, saying whether Undo can bring back what it does`,
              ).toBeDefined();
              expect(
                red,
                `${story.title} › ${story.name}: red only when Undo can't bring it back (T6)`,
              ).toBe(outsideUndo);
            }
          }

          // Screenshots in the development presets; the curated themes' look is the theme
          // stories' own screenshots (2.13), and the nightly run checks them with axe.
          const screenshot = build.package !== "site-components" || PR_PRESETS.includes(theme);
          if (SCREENSHOTS && screenshot) {
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
