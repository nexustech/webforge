import { mkdtempSync, readdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { changedDocuments, createSite } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { themePreset } from "@webforge/themes";
import { clickOnCanvas } from "./canvas-click.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { exportFromEditor, stubFileDialogs } from "./sites.js";

// A font for each element (3.22, PF-5): a Heading's Font set to Accent takes the theme's accent
// font on the canvas, whose files load only then, goes into the export with them, and takes the
// new theme's accent after a theme switch.

let dir: string;
let app: ElectronApplication | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-e2e-element-fonts-"));
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/** A site with a Section holding a Heading, its theme's accent font Pacifico. */
function createSiteWithAccent(path: string): void {
  const site = createSite({
    name: "Fonts",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Page not found",
  });
  site.theme = {
    ...site.theme,
    fonts: { ...site.theme.fonts, accent: { family: "Pacifico", fallback: "sans-serif" } },
  };
  site.pages[site.homePageId]?.doc.content.push({
    type: "Section",
    props: {
      id: "band",
      content: [{ type: "Heading", props: { id: "heading", text: "Fresh bread daily" } }],
    },
  });
  const store = ProjectStore.create(path, { name: "Fonts" });
  try {
    store.commit(changedDocuments(undefined, site));
  } finally {
    store.close();
  }
}

const canvas = (page: Page) => page.frameLocator(".editor__canvas iframe");
const panel = (page: Page) => page.getByRole("region", { name: "Right panels" });

/** Whether the canvas has loaded `family`. */
const loaded = (page: Page, family: string) =>
  canvas(page)
    .locator("body")
    .evaluate(async (_, name) => {
      await document.fonts.ready;
      return [...document.fonts].some(
        (font) => font.family.replaceAll('"', "") === name && font.status === "loaded",
      );
    }, family);

test("a Heading set to the Accent font takes the theme's, exported with it, and the new theme's after a switch", async () => {
  const sitePath = join(dir, "Fonts.wforge");
  createSiteWithAccent(sitePath);
  app = await launchDesktopApp({ args: [sitePath] });
  const page = await app.firstWindow();
  await waitForCanvas(page);

  // Nothing uses the accent font yet: the canvas has none of its files.
  const heading = canvas(page).locator(".site-heading");
  await expect(heading).not.toHaveCSS("font-family", /Pacifico/);
  expect(await loaded(page, "Pacifico")).toBe(false);

  // Selected past the end of its text (clicking the text edits it).
  const box = await heading.boundingBox();
  if (box === null) throw new Error("Heading not visible");
  await clickOnCanvas(heading, { position: { x: box.width * 0.97, y: box.height - 2 } });
  await panel(page).getByRole("tab", { name: "Style" }).click();
  await panel(page).getByLabel("Font", { exact: true }).selectOption("accent");

  await expect(heading).toHaveCSS("font-family", /Pacifico/);
  await expect.poll(() => loaded(page, "Pacifico")).toBe(true);

  // The export holds the accent font's files now that something uses it.
  const folder = join(dir, "export");
  await stubFileDialogs(app, folder);
  expect(await exportFromEditor(page)).toContain("Saved in the folder “export”.");
  expect(readdirSync(join(folder, "assets", "fonts")).some((file) => /^pacifico-/.test(file))).toBe(
    true,
  );

  // A theme switch keeps the choice, in the new theme's accent font.
  await panel(page).getByRole("tab", { name: "Theme", exact: true }).click();
  await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption("bistro");
  await page.getByRole("alertdialog").getByRole("button", { name: "Switch Theme" }).click();
  const accent = themePreset("bistro")?.fonts.accent.family ?? "";
  expect(accent).not.toBe("");
  await expect(heading).toHaveClass(/font-accent!/);
  await expect(heading).toHaveCSS("font-family", new RegExp(accent));
});
