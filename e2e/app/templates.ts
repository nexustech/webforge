import { expect, type Page } from "@playwright/test";

// The templates New Site offers, as the E2E tests and the opening perf check make them.

/** Each template: its card's title, the theme it brings, and its home page's heading. */
export const TEMPLATES = [
  { title: "Café / Restaurant", theme: "Bistro", heading: "Good coffee and proper breakfasts" },
  { title: "Salon / Beauty", theme: "Atelier", heading: "Hair and beauty, with time to talk" },
  { title: "Trades", theme: "Workshop", heading: "Safe, tidy electrical work in Leeds" },
  { title: "Consultant", theme: "Meridian", heading: "Clear advice for growing businesses" },
  { title: "Photographer / Portfolio", theme: "Darkroom", heading: "Light, land and people" },
  { title: "Shop", theme: "Market", heading: "Handmade pots for happy plants" },
] as const;

/** One of {@link TEMPLATES}. */
export type Template = (typeof TEMPLATES)[number];

/**
 * Makes a site from `template` with New Site, from the start screen: opens the dialog, picks the
 * template's card (which brings its theme) and clicks Create. `beforeCreate` runs just before the
 * click, to start timing or measuring what Create sets off.
 */
export async function createFromTemplate(
  page: Page,
  template: Template,
  beforeCreate: () => Promise<void> = async () => undefined,
): Promise<void> {
  // Exactly: the title bar's New Site… button has the same name in another case.
  await page.getByRole("button", { name: "New site…", exact: true }).click();
  const newSite = page.getByRole("dialog", { name: "New Site" });
  // The card (its radio is visually hidden, so its label), named with its pages: not the business
  // type's chip of the same name.
  await newSite
    .locator("label")
    .filter({ has: page.getByRole("radio", { name: new RegExp(`^${template.title}.*pages`) }) })
    .click();
  await expect(newSite.getByRole("radio", { name: template.theme })).toBeChecked();
  await beforeCreate();
  await newSite.getByRole("button", { name: "Create" }).click();
}
