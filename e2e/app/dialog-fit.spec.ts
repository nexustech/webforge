import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
};

const KNOWN_FAULTS: readonly KnownFault[] = [
  // The Link dialog's link types and the web host form's More Options move their tops (H4).
  { case: "Link", rule: 5, issue: 1441 },
  { case: "Publish to Your Web Host", rule: 5, issue: 1441 },
  // Colours: the dialog scrolls as well as its colours, which scroll sideways at 960 × 600.
  { case: "Theme Studio", rule: 3, issue: 1535, rounds: ["960 × 600, Dark"] },
  {
    case: "Theme Studio",
    rule: 4,
    issue: 1535,
    rounds: ["960 × 600, Dark", "1366 × 768, Dark", "1366 × 768 at 125%, Dark"],
  },
  // Taller than the room below the title bar, so it opens over it.
  {
    case: "the View menu",
    rule: 2,
    issue: 1536,
    rounds: ["960 × 600, Dark", "960 × 600, Light", "1366 × 768 at 125%, Dark"],
  },
];

/** Whether macOS's menu bar holds the menus, so the title bar has none (LF-13). */
const nativeMenus = process.platform === "darwin";

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
      await stubFileDialogs(app, mkdtempSync(join(tmpdir(), "webforge-fit-export-")));
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
  const page = await app.firstWindow();
  await waitForCanvas(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", round.theme);
  await sizeWindow(app, page, round);
  return { app, page, round };
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

/**
 * `faults` against the faults known for `name` in `round`: the rules broken, the rules expected
 * broken, and a message naming the case, the round and every number measured.
 */
function faultReport(
  name: string,
  round: Round,
  faults: readonly FitFault[],
): { broken: FitRule[]; known: FitRule[]; message: string } {
  const known = KNOWN_FAULTS.filter(
    (fault) =>
      fault.case === name &&
      round.rules.includes(fault.rule) &&
      (fault.rule !== 5 || round.changes) &&
      (fault.rounds === undefined || fault.rounds.includes(round.name)),
  );
  const rulesOf = (list: readonly { rule: FitRule }[]) =>
    [...new Set(list.map((each) => each.rule))].sort();
  const broken = rulesOf(faults);
  const notes = [
    ...faults.map((fault) => `rule ${fault.rule}: ${fault.says}`),
    ...known
      .filter((fault) => !broken.includes(fault.rule))
      .map(
        (fault) =>
          `rule ${fault.rule} passes: fixed, so remove its KNOWN_FAULTS entry (#${fault.issue})`,
      ),
  ];
  return {
    broken,
    known: rulesOf(known),
    message: `${name}, ${round.name}: ${notes.join("; ") || "fits"}`,
  };
}

/** Checks `faults` are the ones known for `name` in `round` ({@link faultReport}). */
function expectFaults(name: string, round: Round, faults: readonly FitFault[]): void {
  const { broken, known, message } = faultReport(name, round, faults);
  expect.soft(broken, message).toEqual(known);
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
      faults.push(...movedFaults(fit, after, change.name));
      for (const fault of fitFaults(after, rules, overlap)) {
        if (!faults.some((found) => found.rule === fault.rule)) {
          faults.push({ ...fault, says: `after ${change.name}, ${fault.says}` });
        }
      }
      fit = after;
    }
    faults.push(...(sectionFaults.get(page) ?? []));
    sectionFaults.delete(page);
  }
  expectFaults(each.name, round, faults);
}

test.afterAll(async () => {
  await Promise.all(folders.splice(0).map((folder) => removeWhenFree(folder)));
});

for (const round of ROUNDS) {
  test(`every dialog and panel fits the window, ${round.name} (#1433)`, async () => {
    // About forty cases, each opened, measured and closed.
    test.setTimeout(10 * 60_000);
    let context = await start(round);
    const unchecked: string[] = [];
    try {
      for (const each of CASES) {
        if (each.when?.(round) === false) continue;
        if (round.dialogsOnly === true && each.kind !== "dialog") continue;
        try {
          await test.step(each.name, () => checkCase(context, each));
        } catch (error) {
          unchecked.push(`${each.name}: ${String(error).split("\n")[0]}`);
        }
        if (!(await closeAll(context.page))) {
          unchecked.push(`${each.name}: left something open, so the app was started again`);
          await context.app.close();
          context = await start(round);
        }
      }

      // The title bar with its optional controls showing: the phone preview's cue (left on by its
      // case), Site Check's longest count, and Undo with steps. The connected AI apps' status needs
      // the system's keychain, which Linux's runners haven't got: Windows and macOS check it in
      // ai-apps.spec.ts.
      await test
        .step("the title bar, its optional controls showing", async () => {
          const { app, page } = context;
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
          let faults: FitFault[] = [];
          await expect
            .poll(async () => {
              faults = titleBarFaults(await titleBarLayout(page, "99 to fix"));
              return faults.length;
            })
            .toBe(0)
            .catch(() => undefined);
          expectFaults("the title bar", round, faults);
        })
        .catch((error: unknown) => {
          unchecked.push(`the title bar: ${String(error).split("\n")[0]}`);
        });
    } finally {
      await context.app.close();
    }
    expect(unchecked, `${round.name}: cases that couldn't be checked`).toEqual([]);
  });
}

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
    const { broken, known, message } = faultReport("Keyboard Shortcuts", round, faults);
    expect(broken, message).toEqual([rule]);
    expect(known).toEqual([]);
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

    // 5: shrinking as its content changes, so its top moves: dialogs are centred.
    dialog = await open();
    const before = await fitOf(dialog);
    await breakIt(dialog, (element) => {
      element.style.height = "200px";
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
