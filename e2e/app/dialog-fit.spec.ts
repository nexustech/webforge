import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { createSite, type MediaId, newId } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { heroPhoto } from "@webforge/test-utils";
import {
  type Fit,
  type FitFault,
  type FitRule,
  fitFaults,
  fitOf,
  movedFaults,
  sizeWindow,
  titleBarFaults,
  titleBarLayout,
} from "./fits.js";
import {
  launchDesktopApp,
  newUserDataDir,
  removeWhenFree,
  type WebforgeApp,
  waitForCanvas,
} from "./launch.js";
import { chooseFromMenu, openTitleBarMenu } from "./menus.js";
import { stubFileDialogs } from "./sites.js";

// Every dialog and panel fits the window (product owner, 26 Nov 2026; #1433): each one the UX/UI
// review of 25 Nov 2026 opened (its §2), at 960 × 600 and 1366 × 768, in Dark and Light, and at
// 125% text, held to the same rules (`fits.ts`):
// - 2: inside the window, its top below the title bar;
// - 3: nothing in it scrolls sideways;
// - 4: when something inside it scrolls, it doesn't scroll itself as well;
// - 5: its top stays put through each change of state driven here;
// - 6: the title bar fits with every optional control showing.
// A dialog, panel or title bar control added later is added to CASES (`docs/extending.md`).
//
// One broken dialog doesn't hide the rest: each case is a step whose rules are soft, and a case
// that leaves something open relaunches the app for the next. A fault known and filed is listed
// in KNOWN_FAULTS, which asserts that exact fault is still there until its fix removes the entry.

/** A round: one window size, appearance and text size, with the rules checked in it. */
type Round = {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
  readonly theme: "dark" | "light";
  readonly rules: readonly FitRule[];
  /** Whether each case's changes of state are driven, for rule 5. */
  readonly changes: boolean;
  /** Whether only dialogs are opened, not menus or panels. */
  readonly dialogsOnly?: true;
};

const ROUNDS: readonly Round[] = [
  {
    name: "960 × 600, Dark",
    width: 960,
    height: 600,
    zoom: 1,
    theme: "dark",
    rules: [2, 3, 4, 5, 6],
    changes: true,
  },
  // Appearance changes colours, not layout: Light skips the changes of state, which Dark covers.
  {
    name: "960 × 600, Light",
    width: 960,
    height: 600,
    zoom: 1,
    theme: "light",
    rules: [2, 3, 4, 6],
    changes: false,
  },
  {
    name: "1366 × 768, Dark",
    width: 1366,
    height: 768,
    zoom: 1,
    theme: "dark",
    rules: [2, 3, 4, 5, 6],
    changes: true,
  },
  {
    name: "1366 × 768, Light",
    width: 1366,
    height: 768,
    zoom: 1,
    theme: "light",
    rules: [2, 3, 4, 6],
    changes: false,
  },
  // At 125% the smallest window allowed, 1200 × 750, lays out as 960 × 600 does, so the round at
  // 125% is the larger window: 1366 × 768, laid out at about 1093 × 614. Don't add 960 × 600 at 125%.
  {
    name: "1366 × 768 at 125%, Dark",
    width: 1366,
    height: 768,
    zoom: 1.25,
    theme: "dark",
    rules: [2, 3, 4, 5, 6],
    changes: true,
  },
  // Dialogs below the title bar at 150% text (#1411): Theme Studio's X was under the window's own
  // close button. The interface zoom scales the title bar and the window controls alike.
  {
    name: "1440 × 900 at 150%, Dark",
    width: 1440,
    height: 900,
    zoom: 1.5,
    theme: "dark",
    rules: [2, 6],
    changes: false,
    dialogsOnly: true,
  },
];

/** The app, its window and the round it's in. */
type Context = { readonly app: WebforgeApp; readonly page: Page; readonly round: Round };

/** A change of state inside a dialog, through which its top stays put (rule 5). */
type Change = { readonly name: string; run(target: Locator, context: Context): Promise<void> };

/** A dialog, menu or panel: how to open it, and the changes of state to drive in it. */
type FitCase = {
  readonly name: string;
  readonly kind: "dialog" | "menu" | "panel";
  /** Opens it, and gives the element measured: the dialog, the menu or the panel's region. */
  open(context: Context): Promise<Locator>;
  readonly changes?: readonly Change[];
  /** Whether it's checked in `round` on this system; every round by default. */
  when?(round: Round): boolean;
};

/**
 * A fault found and filed, not yet fixed: the check asserts that exact rule still fails for that
 * case, in the rounds named, so a new fault in the same dialog still fails, and the fix fails the
 * check until it removes the entry.
 */
type KnownFault = {
  readonly case: string;
  readonly rule: FitRule;
  readonly issue: number;
  /** The rounds it shows in, by name; every round that checks the rule by default. */
  readonly rounds?: readonly string[];
  /** The systems it shows on; every one by default. Scrollbars and fonts differ between them. */
  readonly systems?: readonly NodeJS.Platform[];
  /**
   * The change of state it shows after, by name; any, or none, by default. Name it where the case
   * drives others, so the same rule broken after another change still fails.
   */
  readonly change?: string;
};

const KNOWN_FAULTS: readonly KnownFault[] = [
  // Colours: the dialog scrolls as well as its colours, which scroll sideways at 960 × 600.
  {
    case: "Theme Studio",
    rule: 3,
    issue: 1535,
    rounds: ["960 × 600, Dark"],
    change: "the Colours tab",
  },
  {
    case: "Theme Studio",
    rule: 4,
    issue: 1535,
    rounds: ["960 × 600, Dark", "1366 × 768, Dark", "1366 × 768 at 125%, Dark"],
    change: "the Colours tab",
  },
  // Taller than the room below the title bar, so it opens over it.
  {
    case: "the View menu",
    rule: 2,
    issue: 1536,
    rounds: ["960 × 600, Dark", "960 × 600, Light", "1366 × 768 at 125%, Dark"],
  },
];

/** Whether an AI app's key can be kept: Windows' and macOS's keychains (ADR 0006 §5, ADR 0021). */
const keychain = process.platform === "win32" || process.platform === "darwin";

/** Whether macOS's menu bar holds the menus, so the title bar has none (LF-13). */
const nativeMenus = process.platform === "darwin";

/** Page Settings' tabs, each chosen in turn (#1443): through which its top stays put. */
const pageSettingsTabs: readonly Change[] = ["Search engines", "Social & sharing", "General"].map(
  (tab): Change => ({
    name: `the ${tab} tab`,
    run: (target) => target.getByRole("tab", { name: tab, exact: true }).click(),
  }),
);

const canvas = (page: Page) => page.frameLocator(".editor__canvas iframe");

/**
 * Opens the side column's tab `tab`: from the column's tabs, or, where the window is too narrow to
 * show the column, from the strip it folds into (#1166).
 */
async function sideTab(page: Page, side: "Left" | "Right", tab: string): Promise<Locator> {
  const region = page.getByRole("region", { name: `${side} panels` });
  if (await region.isVisible()) {
    await region.getByRole("tab", { name: tab, exact: true }).click();
  } else {
    await page
      .getByRole("navigation", { name: `${side} panels, collapsed` })
      .getByRole("button", { name: tab, exact: true })
      .click();
  }
  await expect(region).toBeVisible();
  return region;
}

/** Selects the home page's Hero, from the canvas, and shows its Edit panel. */
async function selectHero(page: Page): Promise<Locator> {
  await canvas(page).locator(".site-hero h1").click();
  const panel = await sideTab(page, "Right", "Edit");
  await expect(panel.getByRole("heading", { name: "Hero", exact: true })).toBeVisible();
  return panel;
}

/** Opens the Site panel's actions for the page `title`, and gives its menu. */
async function pageActions(page: Page, title: string): Promise<Locator> {
  const panel = await sideTab(page, "Right", "Site");
  await panel
    .getByRole("list", { name: "Pages" })
    .getByRole("button", { name: `Actions for ${title}` })
    .click();
  return page.getByRole("menu");
}

/** Opens the menu of the version seeded in the site, in Version History. */
async function versionMenu(page: Page): Promise<Locator> {
  const panel = await sideTab(page, "Left", "Version History");
  await panel
    .getByRole("list", { name: "Versions" })
    .getByRole("button", { name: "More for “First draft”" })
    .click();
  return page.getByRole("menu");
}

/** A dialog by role and name, once it shows. */
async function shown(target: Locator): Promise<Locator> {
  await expect(target).toBeVisible();
  return target;
}

/** Clicks the tab `name` of `target`'s tab list. */
const tab = (name: string): Change => ({
  name: `the ${name} tab`,
  run: (target) => target.getByRole("tab", { name, exact: true }).click(),
});

/** Types `text` into `target`'s search box named `label`. */
const search = (label: string, text: string): Change => ({
  name: `a search for "${text}"`,
  run: (target) => target.getByLabel(label).fill(text),
});

const CASES: readonly FitCase[] = [
  // Dialogs.
  {
    name: "Start a Site",
    kind: "dialog",
    open: async ({ app, page }) => {
      await chooseFromMenu(app, page, "File", "Start a Site…");
      return shown(page.getByRole("dialog", { name: "Start a site" }));
    },
    changes: [
      {
        name: "a business chosen and named",
        run: async (target) => {
          await target.getByRole("radio", { name: "Food and drink" }).click();
          await target
            .getByRole("textbox", { name: "Business or site name" })
            .fill("Rosa's Bakery");
        },
      },
      ...[2, 3, 4].map(
        (step): Change => ({
          name: `step ${step}`,
          run: (target) => target.getByRole("button", { name: "Next" }).click(),
        }),
      ),
    ],
  },
  {
    name: "New Site",
    kind: "dialog",
    open: async ({ app, page }) => {
      await chooseFromMenu(app, page, "File", "New Site…");
      return shown(page.getByRole("dialog", { name: "New Site" }));
    },
  },
  {
    name: "Theme Studio",
    kind: "dialog",
    open: async ({ app, page }) => {
      await chooseFromMenu(app, page, "Site", "Theme Studio…");
      return shown(page.getByRole("dialog", { name: "Theme Studio" }));
    },
    changes: [tab("Colours"), tab("Text"), tab("Styles"), tab("Components"), tab("Themes")],
  },
  {
    name: "Colour picker",
    kind: "dialog",
    open: async ({ app, page }) => {
      await chooseFromMenu(app, page, "Site", "Theme Studio…");
      const studio = await shown(page.getByRole("dialog", { name: "Theme Studio" }));
      await studio.getByRole("tab", { name: "Colours", exact: true }).click();
      await studio.getByRole("button", { name: "Brand Page", exact: true }).click();
      return shown(page.getByRole("dialog", { name: "Colour picker" }));
    },
  },
  {
    name: "Style This Hero",
    kind: "dialog",
    open: async ({ page }) => {
      const panel = await selectHero(page);
      await panel.getByRole("tab", { name: "Style" }).click();
      await panel.getByRole("button", { name: "Style This Hero…" }).click();
      return shown(page.getByRole("dialog", { name: "Style this Hero" }));
    },
  },
  {
    name: "Settings",
    kind: "dialog",
    open: async ({ page }) => {
      await page.keyboard.press("ControlOrMeta+Comma");
      return shown(page.getByRole("dialog", { name: "Settings", exact: true }));
    },
    // Each of its sections in turn, as its side list names them.
    changes: [
      {
        name: "each section",
        run: async (target, { page, round }) => {
          const sections = target.getByRole("navigation").getByRole("tab");
          const before = await fitOf(target);
          const moved: FitFault[] = [];
          for (const section of await sections.all()) {
            const name = (await section.textContent()) ?? "";
            await section.click();
            moved.push(...movedFaults(before, await fitOf(target), `its ${name} section`));
            moved.push(
              ...fitFaults(await fitOf(target), round.rules).map((fault) => ({
                ...fault,
                says: `in ${name}, ${fault.says}`,
              })),
            );
          }
          sectionFaults.set(page, moved);
        },
      },
    ],
  },
  {
    name: "Page Settings",
    kind: "dialog",
    open: async ({ page }) => {
      await pageActions(page, "Home");
      await page.getByRole("menuitem", { name: "Page Settings…" }).click();
      return shown(page.getByRole("dialog", { name: /^Settings for / }));
    },
    changes: pageSettingsTabs,
  },
  // An ordinary page's: all its toggles, the longest form (#1443).
  {
    name: "Page Settings for About us",
    kind: "dialog",
    open: async ({ page }) => {
      await pageActions(page, "About us");
      await page.getByRole("menuitem", { name: "Page Settings…" }).click();
      return shown(page.getByRole("dialog", { name: "Settings for 'About us'" }));
    },
    changes: pageSettingsTabs,
  },
  // A post's: its Date, Summary, Picture and Tags too (#1443). Add Page › Blog shows its first
  // post, and the command box's Page Settings… opens the page shown.
  {
    name: "Page Settings for a blog post",
    kind: "dialog",
    open: async ({ page }) => {
      const panel = await sideTab(page, "Right", "Site");
      await panel.getByRole("button", { name: "Add Page" }).click();
      await page.getByRole("menuitem", { name: "Blog", exact: true }).click();
      await page.getByRole("button", { name: /^Search commands/ }).click();
      const commands = page.getByRole("dialog", { name: "Commands" });
      await page.keyboard.type("Page Settings");
      await commands.getByRole("option", { name: /^Page Settings…/ }).click();
      const settings = page.getByRole("dialog", { name: /^Settings for / });
      await expect(settings.getByRole("textbox", { name: "Date" })).toBeVisible();
      return shown(settings);
    },
    changes: pageSettingsTabs,
  },
  {
    name: "Add Page",
    kind: "dialog",
    open: async ({ page }) => {
      const panel = await sideTab(page, "Right", "Site");
      await panel.getByRole("button", { name: "Add Page" }).click();
      await page.getByRole("menuitem", { name: "Blank Page…" }).click();
      return shown(page.getByRole("dialog", { name: "Add Page" }));
    },
  },
  {
    name: "Link",
    kind: "dialog",
    open: async ({ page }) => {
      const panel = await selectHero(page);
      await panel.getByRole("tab", { name: "Content" }).click();
      await panel
        .locator('[data-field="buttonLink"]')
        .getByRole("button", { name: "Add Link…" })
        .click();
      return shown(page.getByRole("dialog", { name: "Link" }));
    },
    changes: ["Email", "Phone", "Web address", "Page"].map(
      (kind): Change => ({
        name: `the ${kind} link type`,
        run: (target) => target.getByRole("radio", { name: kind, exact: true }).click(),
      }),
    ),
  },
  {
    name: "Choose an Image",
    kind: "dialog",
    open: async ({ page }) => {
      const panel = await selectHero(page);
      await panel.getByRole("tab", { name: "Content" }).click();
      await panel.getByRole("button", { name: /(Choose an|Change) Image…$/i }).click();
      return shown(page.getByRole("dialog", { name: "Choose an image" }));
    },
    changes: [search("Search", "shop")],
  },
  {
    name: "Choose a Font",
    kind: "dialog",
    open: async ({ page }) => {
      const panel = await sideTab(page, "Right", "Theme");
      await panel.getByRole("button", { name: /^Headings / }).click();
      return shown(page.getByRole("dialog", { name: "Choose a font" }));
    },
  },
  {
    name: "Publish",
    kind: "dialog",
    open: async ({ page }) => {
      await page.getByRole("banner").getByRole("button", { name: "Publish", exact: true }).click();
      return shown(page.getByRole("dialog", { name: "Publish", exact: true }));
    },
  },
  {
    name: "Publish to Your Web Host",
    kind: "dialog",
    open: async ({ page }) => {
      await page.getByRole("banner").getByRole("button", { name: "Publish", exact: true }).click();
      await page
        .getByRole("dialog", { name: "Publish", exact: true })
        .getByRole("button", { name: "A web host with a control panel", exact: true })
        .click();
      return shown(page.getByRole("dialog", { name: "Publish to your web host" }));
    },
    changes: [
      {
        name: "More Options",
        run: async (target) => {
          await target.getByRole("button", { name: "More Options" }).click();
          // No live check of the site's address: nothing leaves the computer.
          await target.getByLabel("Web address", { exact: true }).fill("");
        },
      },
      {
        name: "Save with its fields empty, showing their errors",
        run: async (target) => {
          await target.getByRole("button", { name: "Save", exact: true }).click();
          await expect(target.getByLabel("Host", { exact: true })).toHaveAttribute(
            "aria-invalid",
            "true",
          );
        },
      },
    ],
  },
  {
    name: "Export Site",
    kind: "dialog",
    open: async ({ page }) => {
      await page.getByRole("banner").getByRole("button", { name: "Export", exact: true }).click();
      return shown(page.getByRole("dialog", { name: "Export Site" }));
    },
    changes: [
      {
        name: "A ZIP file",
        run: (target) => target.getByRole("radio", { name: "A ZIP file" }).click(),
      },
    ],
  },
  {
    // A real export, so one round only.
    name: "Site Exported",
    kind: "dialog",
    when: (round) => round === ROUNDS[0],
    open: async ({ app, page }) => {
      const folder = mkdtempSync(join(tmpdir(), "webforge-fit-export-"));
      folders.push(folder);
      await stubFileDialogs(app, folder);
      await page.getByRole("banner").getByRole("button", { name: "Export", exact: true }).click();
      const dialog = await shown(page.getByRole("dialog", { name: "Export Site" }));
      await dialog.getByRole("radio", { name: "A folder" }).click();
      await dialog.getByRole("button", { name: /^Export/ }).click();
      const report = page.getByRole("dialog", { name: "Site exported" });
      await expect(report).toBeVisible({ timeout: 30_000 });
      return report;
    },
  },
  {
    name: "AI Apps",
    kind: "dialog",
    open: async ({ app, page }) => {
      await chooseFromMenu(app, page, "File", "AI Apps…");
      return shown(page.getByRole("dialog", { name: "AI Apps" }));
    },
  },
  {
    name: "Preview on Your Phone",
    kind: "dialog",
    open: async ({ app, page }) => {
      await chooseFromMenu(app, page, "File", "Preview on Phone…");
      const dialog = await shown(page.getByRole("dialog", { name: "Preview on your phone" }));
      await expect(
        dialog.getByRole("img", { name: "QR code of the preview's address" }),
      ).toBeVisible({ timeout: 15_000 });
      return dialog;
    },
  },
  {
    name: "Save Version",
    kind: "dialog",
    open: async ({ page }) => {
      await page.keyboard.press("ControlOrMeta+Alt+s");
      return shown(page.getByRole("dialog", { name: "Save Version" }));
    },
  },
  {
    name: "Assistant settings",
    kind: "dialog",
    open: async ({ page }) => {
      const panel = await sideTab(page, "Left", "Assistant");
      await panel.getByRole("button", { name: "Set Up the Assistant…" }).click();
      return shown(page.getByRole("dialog", { name: "Assistant" }));
    },
  },
  {
    name: "About",
    kind: "dialog",
    open: async ({ app, page }) => {
      await chooseFromMenu(app, page, "Help", /^About /);
      return shown(page.getByRole("dialog"));
    },
  },
  {
    name: "Open-Source Licences",
    kind: "dialog",
    open: async ({ app, page }) => {
      await chooseFromMenu(app, page, "Help", "Open-Source Licences");
      const dialog = await shown(page.getByRole("dialog", { name: "Open-Source Licences" }));
      await expect(
        dialog.getByRole("list", { name: "Open-source software" }).getByRole("listitem").first(),
      ).toBeVisible();
      return dialog;
    },
    changes: [search("Find a package or licence", "react")],
  },
  {
    name: "Diagnostics",
    kind: "dialog",
    open: async ({ app, page }) => {
      await chooseFromMenu(app, page, "Help", "Diagnostics…");
      const dialog = await shown(page.getByRole("dialog", { name: "Diagnostics" }));
      await expect(dialog.getByText("Install number")).toBeVisible();
      return dialog;
    },
  },
  {
    name: "Report a Problem",
    kind: "dialog",
    open: async ({ app, page }) => {
      await chooseFromMenu(app, page, "Help", "Report a Problem…");
      const dialog = await shown(page.getByRole("dialog", { name: "Report a Problem" }));
      await expect(dialog.getByText(/^Sent with it: /)).toBeVisible();
      return dialog;
    },
  },
  {
    name: "Keyboard Shortcuts",
    kind: "dialog",
    open: async ({ app, page }) => {
      await chooseFromMenu(app, page, "Help", "Keyboard Shortcuts");
      return shown(page.getByRole("dialog", { name: "Keyboard Shortcuts" }));
    },
    changes: [search("Search shortcuts", "undo")],
  },
  {
    name: "Commands",
    kind: "dialog",
    open: async ({ page }) => {
      await page.getByRole("button", { name: /^Search commands/ }).click();
      return shown(page.getByRole("dialog", { name: "Commands" }));
    },
    changes: [
      {
        name: "a search for theme",
        run: async (_target, { page }) => page.keyboard.type("theme"),
      },
    ],
  },
  {
    name: "Confirm: delete a page",
    kind: "dialog",
    open: async ({ page }) => {
      await pageActions(page, "About us");
      await page.getByRole("menuitem", { name: "Delete…" }).click();
      return shown(page.getByRole("alertdialog"));
    },
  },
  {
    name: "Confirm: switch the theme",
    kind: "dialog",
    open: async ({ page }) => {
      const panel = await sideTab(page, "Right", "Theme");
      const theme = panel.getByRole("combobox", { name: "Theme", exact: true });
      const other = await theme.evaluate(
        (select) =>
          [...(select as HTMLSelectElement).options].find((option) => !option.selected)?.value ??
          "",
      );
      await theme.selectOption(other);
      return shown(page.getByRole("alertdialog"));
    },
  },
  {
    name: "Confirm: restore a version",
    kind: "dialog",
    open: async ({ page }) => {
      await versionMenu(page);
      await page.getByRole("menuitem", { name: "Restore…" }).click();
      return shown(page.getByRole("alertdialog"));
    },
  },
  {
    name: "Confirm: delete a picture",
    kind: "dialog",
    open: async ({ page }) => {
      const panel = await sideTab(page, "Right", "Media");
      const media = panel.getByRole("region", { name: "Media" });
      await media.getByRole("button", { name: "Shop front.jpg" }).click();
      await media.getByRole("button", { name: "Delete" }).click();
      return shown(page.getByRole("alertdialog"));
    },
  },

  // Menus. macOS has its menus in the system's menu bar, none in the title bar (LF-13).
  ...["File", "Edit", "View", "Site", "Help"].map(
    (menu): FitCase => ({
      name: `the ${menu} menu`,
      kind: "menu",
      when: () => !nativeMenus,
      open: async ({ page }) => {
        await openTitleBarMenu(page, menu);
        return shown(page.getByRole("menu", { name: menu }));
      },
    }),
  ),
  {
    name: "a page's actions",
    kind: "menu",
    open: async ({ page }) => shown(await pageActions(page, "Home")),
  },
  {
    name: "a version's menu",
    kind: "menu",
    open: async ({ page }) => shown(await versionMenu(page)),
  },

  // Panels: each side column's tabs, Layers, and the bottom drawer's two.
  ...["Add", "Undo History", "Version History", "Assistant"].map(
    (name): FitCase => ({
      name: `the ${name} panel`,
      kind: "panel",
      open: ({ page }) => sideTab(page, "Left", name),
    }),
  ),
  {
    name: "the Layers panel",
    kind: "panel",
    open: async ({ page }) => {
      const column = await sideTab(page, "Left", "Add");
      return shown(column.getByRole("tree", { name: "Layers" }));
    },
  },
  {
    name: "the Edit panel",
    kind: "panel",
    open: ({ page }) => selectHero(page),
  },
  ...["Site", "Theme", "Media"].map(
    (name): FitCase => ({
      name: `the ${name} panel`,
      kind: "panel",
      open: ({ page }) => sideTab(page, "Right", name),
    }),
  ),
  {
    name: "the Site Check panel",
    kind: "panel",
    open: async ({ page }) => {
      await page
        .getByRole("banner")
        .getByRole("button", { name: /^Site Check: / })
        .click();
      return shown(page.getByRole("region", { name: "Bottom panel" }));
    },
  },
  {
    name: "the Find and Replace panel",
    kind: "panel",
    open: async ({ page }) => {
      await page.keyboard.press("ControlOrMeta+f");
      return shown(page.getByRole("region", { name: "Bottom panel" }));
    },
  },
];

/**
 * Pairs an AI app in AI apps… and connects it, as ai-apps.spec.ts does, so the title bar shows
 * that it's connected. `remove` takes it out again, and its key out of the system's keychain.
 */
async function connectAiApp({ app, page }: Context): Promise<{ remove(): Promise<void> }> {
  const dialog = page.getByRole("dialog", { name: "AI Apps" });
  await chooseFromMenu(app, page, "File", "AI Apps…");
  const allow = dialog.getByRole("checkbox", { name: "Let AI apps connect" });
  if (!(await allow.isChecked())) await allow.click();
  await dialog.getByRole("button", { name: "Add AI app" }).click();
  await dialog.getByRole("radio", { name: "Another app" }).click();
  await dialog.getByRole("textbox", { name: "Name" }).fill("Test client");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  // From here its key is in the keychain: removed again whatever happens next.
  let client: Client | undefined;
  const remove = async () => {
    try {
      await client?.close();
    } finally {
      await closeAll(page);
      await chooseFromMenu(app, page, "File", "AI Apps…");
      await dialog.getByRole("button", { name: "Remove Test client" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
      await expect(dialog.getByText("No AI apps yet.")).toBeVisible();
    }
  };
  try {
    const added = dialog.getByRole("region", { name: "Test client is added" });
    await expect(added.getByText(/You won't see it again/)).toBeVisible();
    const [address, key] = await added.locator("dd code").allTextContents();
    if (address === undefined || key === undefined) throw new Error("no address or key shown");
    await added.getByRole("button", { name: "Done" }).click();
    client = new Client({ name: "e2e", version: "1" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(address), {
        requestInit: { headers: { authorization: `Bearer ${key}` } },
      }),
    );
    await client.listTools();
    // Connected, as AI apps says, before it closes: the title bar's status follows that (a 5 s
    // wait for the status alone, the dialog closed at once, missed it once on macOS).
    await expect(dialog.getByText("Connected", { exact: true })).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(
      page.getByRole("button", { name: "Connected AI apps: Test client. Open AI apps." }),
    ).toBeVisible({ timeout: 15_000 });
  } catch (error) {
    await remove().catch(() => undefined);
    throw error;
  }
  return { remove };
}

/** The faults Settings' sections showed, kept by its change for its case to report. */
const sectionFaults = new WeakMap<Page, FitFault[]>();

/**
 * A site with what the cases need: a Hero with a picture from Media placed on it, a second page to
 * delete, a web address (so Export doesn't ask for one first), and a version.
 */
function seedSite(folder: string): string {
  const path = join(folder, "Rosa's Bakery.wforge");
  const store = ProjectStore.create(path, { name: "Rosa's Bakery" });
  try {
    const { hash } = store.putAsset({
      mediaId: "shop",
      data: heroPhoto(),
      mime: "image/jpeg",
      width: 1600,
      height: 1000,
      originalName: "Shop front.jpg",
    });
    const site = createSite({
      name: "Rosa's Bakery",
      language: "en-GB",
      homeTitle: "Home",
      notFoundTitle: "Page not found",
    });
    site.media = {
      ["shop" as MediaId]: {
        id: "shop" as MediaId,
        hash,
        name: "shop-front",
        fileName: "Shop front.jpg",
        kind: "image",
        mimeType: "image/jpeg",
        width: 1600,
        height: 1000,
        alt: "Our shop front",
      },
    };
    site.settings.address.url = "https://rosas.example";
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home page");
    home.doc.content = [
      { type: "Hero", props: { id: "hero", title: "Fresh bread", image: { mediaId: "shop" } } },
    ];
    const about = structuredClone(home);
    about.id = newId("page");
    about.slug = "about-us";
    about.title = "About us";
    about.doc.content = [];
    site.pages[about.id] = about;
    site.pageOrder.splice(1, 0, about.id);
    store.saveSite(site);
    store.saveVersion("First draft", "manual");
  } finally {
    store.close();
  }
  return path;
}

/** Folders a round made, removed once it's done. */
const folders: string[] = [];

/** Launches the app on a seeded site, in `round`'s appearance, size and text size. */
async function start(round: Round): Promise<Context> {
  const userData = newUserDataDir();
  const siteFolder = mkdtempSync(join(tmpdir(), "webforge-fit-"));
  folders.push(userData, siteFolder);
  writeFileSync(
    join(userData, "preferences.json"),
    JSON.stringify({
      theme: round.theme,
      onboarding: { tour: "new", tipsSeen: [], showTips: false },
    }),
  );
  const app = await launchDesktopApp({ userDataDir: userData, args: [seedSite(siteFolder)] });
  try {
    const page = await app.firstWindow();
    // A case that can't find what it clicks gives up in 10 s, not at the test's timeout.
    page.setDefaultTimeout(10_000);
    await waitForCanvas(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", round.theme);
    await sizeWindow(app, page, round);
    return { app, page, round };
  } catch (error) {
    await app.close().catch(() => undefined);
    throw error;
  }
}

/** What's open over the editor: dialogs, alert dialogs and menus. */
const overlays = (page: Page) =>
  page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible, [role="menu"]:visible');

/**
 * Closes whatever a case left open: Escape, or Discard where Theme Studio asks about a draft.
 * Whether everything closed.
 */
async function closeAll(page: Page): Promise<boolean> {
  for (let tries = 0; tries < 5; tries++) {
    if ((await overlays(page).count()) === 0) return true;
    const discard = page.getByRole("alertdialog").getByRole("button", { name: /^Discard/ });
    if (await discard.isVisible()) await discard.click();
    else await page.keyboard.press("Escape");
    await expect(overlays(page))
      .toHaveCount(0, { timeout: 1_500 })
      .catch(() => undefined);
  }
  return (await overlays(page).count()) === 0;
}

/** Whether the known fault `entry` accounts for `fault`: its rule, after its change if it names one. */
const covers = (entry: KnownFault, fault: FitFault) =>
  entry.rule === fault.rule && (entry.change === undefined || entry.change === fault.change);

/**
 * `faults` against the faults known for `name` in `round`: the rules broken that no known fault
 * accounts for, the known faults that no longer show, and a message naming the case, the round
 * and every number measured.
 */
function faultReport(
  name: string,
  round: Round,
  faults: readonly FitFault[],
): { unexpected: FitRule[]; fixed: KnownFault[]; message: string } {
  const known = KNOWN_FAULTS.filter(
    (fault) =>
      fault.case === name &&
      round.rules.includes(fault.rule) &&
      (fault.rule !== 5 || round.changes) &&
      (fault.rounds === undefined || fault.rounds.includes(round.name)) &&
      (fault.systems === undefined || fault.systems.includes(process.platform)),
  );
  const unexpected = faults.filter((fault) => !known.some((entry) => covers(entry, fault)));
  const fixed = known.filter((entry) => !faults.some((fault) => covers(entry, fault)));
  const notes = [
    ...faults.map(
      (fault) => `rule ${fault.rule}: ${fault.says}${unexpected.includes(fault) ? "" : " (known)"}`,
    ),
    ...fixed.map(
      (entry) =>
        `rule ${entry.rule}${entry.change === undefined ? "" : ` after ${entry.change}`} passes: fixed, so remove its KNOWN_FAULTS entry (#${entry.issue})`,
    ),
  ];
  return {
    unexpected: [...new Set(unexpected.map((fault) => fault.rule))].sort(),
    fixed,
    message: `${name}, ${round.name}: ${notes.join("; ") || "fits"}`,
  };
}

/** Checks `faults` are the ones known for `name` in `round` ({@link faultReport}). */
function expectFaults(name: string, round: Round, faults: readonly FitFault[]): void {
  const { unexpected, fixed, message } = faultReport(name, round, faults);
  expect.soft({ unexpected, fixed: fixed.map((entry) => entry.issue) }, message).toEqual({
    unexpected: [],
    fixed: [],
  });
}

/** An error's first line and, when it timed out, what it was waiting for. */
function firstLines(error: unknown): string {
  const lines = String(error).split("\n");
  const waiting = lines.map((line) => line.trim()).find((line) => line.startsWith("- waiting for"));
  return waiting === undefined ? (lines[0] ?? "") : `${lines[0]} (${waiting.slice(2)})`;
}

/** Opens `each`, measures it, drives its changes, and checks what it found. */
async function checkCase(context: Context, each: FitCase): Promise<void> {
  const { page, round } = context;
  const target = await each.open(context);
  // A menu holds no scroll area of its own to check rule 4 against.
  const rules = round.rules.filter((rule) => rule !== 6 && (each.kind !== "menu" || rule !== 4));
  // A menu hangs from its title in the title bar, over its last 2 px.
  const overlap = each.kind === "menu" ? 2 : 0;
  let fit: Fit = await fitOf(target);
  const faults = fitFaults(fit, rules, overlap);
  if (round.changes) {
    for (const change of each.changes ?? []) {
      await change.run(target, context);
      const after = await fitOf(target);
      for (const fault of movedFaults(fit, after, change.name)) {
        faults.push({ ...fault, change: change.name });
      }
      for (const fault of fitFaults(after, rules, overlap)) {
        faults.push({ ...fault, says: `after ${change.name}, ${fault.says}`, change: change.name });
      }
      fit = after;
    }
    for (const fault of sectionFaults.get(page) ?? []) {
      faults.push({ ...fault, change: "each section" });
    }
    sectionFaults.delete(page);
  }
  expectFaults(each.name, round, faults);
}

test.afterAll(() => {
  // Not awaited: it retries for as long as the app's files stay locked, past the hook's timeout.
  for (const folder of folders.splice(0)) void removeWhenFree(folder);
});

/** How many cases a round may fail to check before it stops: past that, what they share is broken. */
const GIVE_UP_AFTER = 5;

for (const round of ROUNDS) {
  test(`every dialog and panel fits the window, ${round.name} (#1433)`, async () => {
    // About forty cases, each opened, measured and closed: under a minute a round in CI, the whole
    // file 3 to 4 minutes in one shard. A round whose cases can't be checked stops after
    // GIVE_UP_AFTER of them, each given up in 10 s, well within this.
    test.setTimeout(4 * 60_000);
    let context: Context | undefined = await start(round);
    const unchecked: string[] = [];
    let failed = 0;
    try {
      for (const each of CASES) {
        if (each.when?.(round) === false) continue;
        if (round.dialogsOnly === true && each.kind !== "dialog") continue;
        if (failed >= GIVE_UP_AFTER) {
          unchecked.push(`the rest: ${failed} cases couldn't be checked, so the round stopped`);
          break;
        }
        const current: Context = context;
        const before = unchecked.length;
        try {
          await test.step(each.name, () => checkCase(current, each));
        } catch (error) {
          unchecked.push(`${each.name}: ${firstLines(error)}`);
        }
        if (!(await closeAll(current.page).catch(() => false))) {
          unchecked.push(`${each.name}: left something open, so the app was started again`);
          await current.app.close().catch(() => undefined);
          context = undefined;
          try {
            context = await start(round);
          } catch (error) {
            unchecked.push(`the app couldn't be started again: ${firstLines(error)}`);
          }
        }
        if (unchecked.length > before) failed++;
        if (context === undefined) break;
      }
      const ready = context;

      // The title bar with its optional controls showing: the phone preview's cue (left on by its
      // case), Site Check's longest count, Undo with steps, and the connected AI apps' status. That
      // needs an app's key in the system's keychain, which Linux's runners haven't got, so Linux
      // checks the title bar without it; Windows and macOS with it.
      if (ready !== undefined && failed < GIVE_UP_AFTER) {
        await test
          .step("the title bar, its optional controls showing", async () => {
            const { app, page } = ready;
            if (
              (await page
                .getByRole("banner")
                .getByRole("button", { name: /Phone Preview|Phone preview on/ })
                .count()) === 0
            ) {
              await chooseFromMenu(app, page, "File", "Preview on Phone…");
              const dialog = page.getByRole("dialog", { name: "Preview on your phone" });
              await expect(
                dialog.getByRole("img", { name: "QR code of the preview's address" }),
              ).toBeVisible({ timeout: 15_000 });
              await dialog.getByRole("button", { name: "Close" }).click();
            }
            // A step to undo: a section added.
            const add = await sideTab(page, "Left", "Add");
            await add.getByRole("button", { name: "Hero", exact: true }).click();
            await expect(
              page.getByRole("banner").getByRole("button", { name: "Undo", exact: true }),
            ).toBeEnabled();
            const connected = keychain ? await connectAiApp(ready) : undefined;
            try {
              let faults: FitFault[] = [];
              await expect
                .poll(async () => {
                  faults = titleBarFaults(await titleBarLayout(page, "99 to fix"));
                  return faults.length;
                })
                .toBe(0)
                .catch(() => undefined);
              expectFaults("the title bar", round, faults);
            } finally {
              await connected?.remove();
            }
          })
          .catch((error: unknown) => {
            unchecked.push(`the title bar: ${firstLines(error)}`);
          });
      }
    } finally {
      await context?.app.close().catch(() => undefined);
    }
    expect(unchecked, `${round.name}: cases that couldn't be checked`).toEqual([]);
  });
}

test("a known fault holds only after its change, and says when it's fixed (#1433)", () => {
  const round = ROUNDS[0];
  if (round === undefined) throw new Error("no rounds");
  // Theme Studio's known faults (#1535): rule 3 and rule 4 after the Colours tab, in this round.
  const scrolls = (rule: 3 | 4, change: string): FitFault => ({
    rule,
    says: `${change}: it scrolls as well as its contents`,
    change,
  });
  const colours = [scrolls(3, "the Colours tab"), scrolls(4, "the Colours tab")];
  // Still there, after its change: nothing to report.
  const still = faultReport("Theme Studio", round, colours);
  expect(still.unexpected, still.message).toEqual([]);
  expect(still.fixed).toEqual([]);
  // The same rule broken after another change in the same dialog: a new fault.
  const other = faultReport("Theme Studio", round, [...colours, scrolls(3, "the Fonts tab")]);
  expect(other.unexpected, other.message).toEqual([3]);
  // Gone: fixed, and the message says to remove the entry.
  const fixed = faultReport("Theme Studio", round, [scrolls(4, "the Colours tab")]);
  expect(fixed.unexpected).toEqual([]);
  expect(fixed.fixed.map((entry) => entry.issue)).toEqual([1535]);
  expect(fixed.message).toBe(
    "Theme Studio, 960 × 600, Dark: rule 4: the Colours tab: it scrolls as well as its contents (known); rule 3 after the Colours tab passes: fixed, so remove its KNOWN_FAULTS entry (#1535)",
  );
  // An entry for any change holds whichever change shows it: the View menu's (#1536).
  const over: FitFault = {
    rule: 2,
    says: "a submenu: it opens over the title bar",
    change: "a submenu",
  };
  expect(faultReport("the View menu", round, [over]).unexpected).toEqual([]);
});

test("rule 2 fails when no title bar is measured (#1433)", () => {
  const fit: Fit = {
    top: 100,
    left: 100,
    right: 860,
    bottom: 500,
    titleBar: 40,
    bar: 40,
    window: { width: 960, height: 600 },
    sideways: [],
    ownScroll: 0,
    innerScrolls: [],
  };
  expect(fitFaults(fit, [2, 3, 4])).toEqual([]);
  expect(fitFaults({ ...fit, titleBar: 0, bar: 0 }, [2, 3, 4])).toEqual([
    { rule: 2, says: 'no title bar measured: no [data-slot="title-bar"] drawn' },
  ]);
  expect(fitFaults({ ...fit, titleBar: 0, bar: 0 }, [3, 4])).toEqual([]);
});

test("an unchecked case says what it was waiting for (#1433)", () => {
  expect(
    firstLines(
      new Error(
        "locator.click: Timeout 10000ms exceeded.\nCall log:\n  - waiting for getByRole('button', { name: 'Add Page' })",
      ),
    ),
  ).toBe(
    "Error: locator.click: Timeout 10000ms exceeded. (waiting for getByRole('button', { name: 'Add Page' }))",
  );
  expect(firstLines(new Error("no address or key shown"))).toBe("Error: no address or key shown");
});

/** Breaks `dialog` in the page by running `breaking` on it, as a fault would. */
const breakIt = (dialog: Locator, breaking: (element: HTMLElement) => void) =>
  dialog.evaluate(breaking);

test("each rule fails when broken on purpose, naming the dialog, the window and what it measured (#1433)", async () => {
  const round = ROUNDS[0];
  if (round === undefined) throw new Error("no rounds");
  const context = await start(round);
  const { app, page } = context;
  const open = async () => {
    await closeAll(page);
    await chooseFromMenu(app, page, "Help", "Keyboard Shortcuts");
    return shown(page.getByRole("dialog", { name: "Keyboard Shortcuts" }));
  };
  /** The report for Keyboard Shortcuts' `faults`, which must break `rule` alone. */
  const expectCaught = (faults: readonly FitFault[], rule: FitRule, measured: RegExp) => {
    const { unexpected, fixed, message } = faultReport("Keyboard Shortcuts", round, faults);
    expect(unexpected, message).toEqual([rule]);
    expect(fixed).toEqual([]);
    expect(message).toContain("Keyboard Shortcuts, 960 × 600, Dark:");
    expect(message).toMatch(measured);
  };
  try {
    // 2: pushed up under the title bar.
    let dialog = await open();
    await breakIt(dialog, (element) => {
      element.style.marginTop = "-2000px";
    });
    expectCaught(
      fitFaults(await fitOf(dialog), [2, 3, 4]),
      2,
      /rule 2: box .* the title bar ending at \d/,
    );

    // 3: something in it wider than it, where it scrolls sideways.
    dialog = await open();
    await breakIt(dialog, (element) => {
      const wide = document.createElement("div");
      wide.style.cssText = "overflow-x: auto; width: 100px";
      wide.ariaLabel = "Too wide";
      wide.append(
        Object.assign(document.createElement("div"), { style: "width: 3000px; height: 1px" }),
      );
      element.append(wide);
    });
    expectCaught(
      fitFaults(await fitOf(dialog), [2, 3, 4]),
      3,
      /rule 3: scrolls sideways: Too wide \(\d+ in 100\)/,
    );

    // 4: scrolling itself while a list inside it scrolls.
    dialog = await open();
    await breakIt(dialog, (element) => {
      element.style.overflowY = "auto";
      const inner = document.createElement("div");
      inner.style.cssText = "overflow-y: auto; height: 40px";
      inner.ariaLabel = "Inner list";
      inner.append(Object.assign(document.createElement("div"), { style: "height: 400px" }));
      element.append(
        inner,
        Object.assign(document.createElement("div"), { style: "height: 3000px" }),
      );
    });
    expectCaught(
      fitFaults(await fitOf(dialog), [2, 3, 4]).filter((fault) => fault.rule !== 2),
      4,
      /rule 4: scrolls \d+ px itself while .*Inner list/,
    );

    // 5: its top moving as its content changes, as a centred dialog's did before they hung from
    // their tops (#1441): moved here by hand.
    dialog = await open();
    const before = await fitOf(dialog);
    await breakIt(dialog, (element) => {
      element.style.top = `${element.getBoundingClientRect().top + 40}px`;
    });
    expectCaught(
      movedFaults(before, await fitOf(dialog), "an error shown"),
      5,
      /rule 5: an error shown: its top moved from [\d.]+ to [\d.]+/,
    );

    // 6: a title bar control reaching under the window's own buttons.
    await closeAll(page);
    await page.getByRole("banner").evaluate((header) => {
      const wide = document.createElement("button");
      wide.textContent = "Too wide";
      wide.style.cssText = "width: 3000px; flex: none";
      header.append(wide);
    });
    expectCaught(titleBarFaults(await titleBarLayout(page, "99 to fix")), 6, /rule 6: .*Too wide/);
  } finally {
    await app.close();
  }
});
