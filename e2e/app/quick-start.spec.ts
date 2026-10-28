import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { OPEN_WAIT } from "./budget.js";
import { launchDesktopApp, type WebforgeApp } from "./launch.js";
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
  await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible();
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
  await quickStart.getByRole("checkbox", { name: "Visit us" }).uncheck();
  await quickStart.getByRole("checkbox", { name: "Private hire" }).check();
  await quickStart.getByRole("button", { name: "Next" }).click();

  // Colours and details.
  await quickStart.getByRole("radio", { name: "Light" }).check();
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
        general: { name: string; description?: string };
        address: { url?: string };
        contact: { phone?: string };
        search: { businessType?: string };
      };
      theme: { preset: string };
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
  expect(site.settings.search.businessType).toBe("food");
  expect(site.theme.preset).toBe("bistro");
  const titles = Object.values(site.pages).map((each) => each.title);
  expect(titles).toContain("Private hire");
  expect(titles).not.toContain("Visit us");
});
