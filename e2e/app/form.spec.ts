import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// The Form element (2.11): placed from the Add panel with its three starter fields, and a field
// added beside them from Suggested, each one step.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const left = () => page.getByRole("region", { name: "Left panels" });
const item = (name: string) => left().getByRole("button", { name, exact: true });

test("places a Form with its fields, and adds another field from Suggested, one step each", async () => {
  await left().getByRole("tab", { name: "Elements" }).click();
  await item("Form").click();

  const form = canvas().locator(".site-form-element form");
  await expect(form.locator(".site-form-field")).toHaveCount(3);
  await expect(form.getByRole("textbox", { name: "Email address" })).toHaveAttribute(
    "aria-required",
    "true",
  );
  // The Form is selected: Suggested offers its fields.
  await item("Form field").first().click();
  await expect(form.locator(".site-form-field")).toHaveCount(4);

  await left().getByRole("tab", { name: "Undo History" }).click();
  await expect(page.locator(".undo-history__step")).toHaveText([
    "Added Form field",
    "Added Form",
    "Opened page",
  ]);
});
