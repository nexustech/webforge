import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { Oklch } from "@webforge/model";
import { brandedTheme, brandFromImage, themePreset } from "@webforge/themes";
import { OPEN_WAIT } from "./budget.js";
import { APP_START_TIMEOUT_MS, launchDesktopApp, type WebforgeApp } from "./launch.js";
import { type RendererWindow, stubFileDialogs } from "./sites.js";

// The quick start (QS-1…QS-4, 3.11b): from the start screen's Start a site, through its four steps,
// into the editor on a site that is already the person's.

let dir: string;
let app: WebforgeApp | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-quick-start-"));
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

test("starts a site from the quick start's answers: the business, a look, pages, colours and details", async () => {
  app = await launchDesktopApp({ userDataDir: join(dir, "user-data"), site: false });
  const page = await app.firstWindow();
  await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible({
    timeout: APP_START_TIMEOUT_MS,
  });
  await stubFileDialogs(app, join(dir, "Rosa's Bakery.wforge"));

  // Exactly: the welcome's card says what it does as well.
  await page.getByRole("button", { name: "Start a site…", exact: true }).click();
  const quickStart = page.getByRole("dialog", { name: "Start a site" });

  // Your business.
  await quickStart.getByRole("radio", { name: "Food and drink" }).click();
  await quickStart.getByRole("textbox", { name: "Business or site name" }).fill("Rosa's Bakery");
  await quickStart.getByRole("textbox", { name: "What you do" }).fill("Bread and cakes");
  await quickStart.getByRole("button", { name: "Next" }).click();

  // A look: the type's template, in its theme.
  await expect(quickStart.getByRole("radio", { name: /^Café \/ Restaurant/ })).toBeChecked();
  await expect(quickStart.getByRole("radio", { name: "Bistro", exact: true })).toBeChecked();
  await quickStart.getByRole("button", { name: "Next" }).click();

  // Pages: one of the template's left out, one suggested page added.
  await quickStart.getByRole("checkbox", { name: "About us" }).uncheck();
  await quickStart.getByRole("checkbox", { name: "Private hire" }).check();
  await quickStart.getByRole("button", { name: "Next" }).click();

  // Colours and details.
  // Another curated theme's brand colours, fitted to Bistro's surfaces.
  // Its label: the radio itself is visually hidden.
  await quickStart.getByText("Workshop", { exact: true }).click();
  await expect(quickStart.getByRole("radio", { name: "Workshop" })).toBeChecked();
  await quickStart.getByRole("textbox", { name: "Phone" }).fill("+44 113 496 0000");
  await quickStart.getByRole("textbox", { name: "Web address" }).fill("https://rosas.example");
  await quickStart.getByRole("button", { name: "Create site" }).click();

  // The editor, on the café's home page, as the person's own.
  await expect(
    page.frameLocator(".editor__canvas iframe").locator("h1", {
      hasText: "Good coffee and proper breakfasts",
    }),
  ).toBeVisible({ timeout: OPEN_WAIT });
  const { site } = (await page.evaluate(() =>
    (window as unknown as RendererWindow).webforge.project.readSite(),
  )) as {
    site: {
      settings: {
        general: { name: string; description?: string; businessType?: string };
        address: { url?: string };
        contact: { phone?: string };
      };
      theme: { preset: string; colors: Record<string, Oklch> };
      pages: Record<string, { title: string }>;
    };
  };
  expect(site.settings.general).toMatchObject({
    name: "Rosa's Bakery",
    description: "Bread and cakes",
  });
  expect(site.settings.contact.phone).toBe("+44 113 496 0000");
  expect(site.settings.address.url).toBe("https://rosas.example");
  // The business type, for search engines (SEO-9).
  expect(site.settings.general.businessType).toBe("food");
  expect(site.theme.preset).toBe("bistro");
  // Workshop's brand colours fitted to Bistro's surfaces, as the palette's swatches showed them:
  // its Brand, Accent and Second accent, as an image of those three would give them.
  const bistro = themePreset("bistro");
  const workshop = themePreset("workshop");
  if (bistro === undefined || workshop === undefined) throw new Error("no preset");
  const roles = ["primary", "secondary", "accent"] as const;
  // Shares 3, 2, 1: the quick start weights a palette's Brand, Accent and Second accent that way
  // (`brandFor` in quick-start.ts), so a change there shows here as a weighting, not a theme bug.
  const proposal = brandFromImage(
    roles.map((role, index) => ({ color: workshop.colors[role], share: 3 - index })),
    bistro,
  );
  if (proposal === undefined) throw new Error("no palette");
  const expected = brandedTheme(bistro, proposal);
  for (const role of [...roles, "primary-content"] as const) {
    expect(site.theme.colors[role], role).toEqual(expected.colors[role]);
  }
  expect(site.theme.colors.primary).not.toEqual(bistro.colors.primary);
  // The name on the canvas, and the phone where the café writes it out: Visit us's contact
  // details. The café's own, not its sample business's.
  const canvas = page.frameLocator(".editor__canvas iframe");
  // The first shown: the phone menu keeps a copy of the name, hidden on a wide screen.
  const shown = async (text: string) => {
    const first = canvas.getByText(text).filter({ visible: true }).first();
    await first.scrollIntoViewIfNeeded();
    await expect(first, text).toBeVisible();
  };
  await shown("Rosa's Bakery");
  await page
    .getByRole("region", { name: "Right panels" })
    .getByRole("tab", { name: "Site", exact: true })
    .click();
  await page
    .getByRole("list", { name: "Pages" })
    .getByRole("button", { name: /^Visit us/ })
    .click();
  await shown("+44 113 496 0000");
  await expect(canvas.getByText("The Copper Kettle")).toHaveCount(0);
  const titles = Object.values(site.pages).map((each) => each.title);
  expect(titles).toContain("Private hire");
  expect(titles).not.toContain("About us");
  expect(titles).toContain("Visit us");
});
