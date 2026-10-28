import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { clickOnCanvas } from "./canvas-click.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// Repeating lists in the Edit panel (F-ED-6): a FAQ's questions, and a Testimonials section's
// testimonials (2.7b), are added, moved, edited and deleted there, one labelled undo step each.

let dir: string;
let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-lists-"));
  const sitePath = join(dir, "Lists.wforge");
  const site = createSite({
    name: "Lists",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  site.pages[site.homePageId]?.doc.content.push({
    type: "Faq",
    props: {
      id: "faq",
      title: "Questions",
      items: [
        { type: "FaqItem", props: { id: "q1", question: "Open on Sunday?", answer: "<p>No</p>" } },
        { type: "FaqItem", props: { id: "q2", question: "Parking?", answer: "<p>Yes</p>" } },
      ],
    },
  });
  site.pages[site.homePageId]?.doc.content.push({
    type: "Testimonials",
    props: {
      id: "testimonials",
      title: "Kind words",
      variant: "cards",
      items: [
        {
          type: "Testimonial",
          props: { id: "t1", quote: "Lovely bread.", name: "Priya", role: "" },
        },
      ],
    },
  });
  const store = ProjectStore.create(sitePath, { name: "Lists" });
  store.saveSite(site);
  store.close();
  app = await launchDesktopApp({ args: [sitePath] });
  page = await app.firstWindow();
  // Undo History is the left column's second tab, after Add.
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Undo History" })
    .click();
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const panel = () => page.getByRole("region", { name: "Right panels" });
const steps = () => page.locator(".undo-history__step");
const questions = () => canvas().locator(".site-faq-item summary");

test("adds, moves and deletes a FAQ's questions in the Edit panel, one step each", async () => {
  // Past the end of the FAQ's title: clicking the text itself would edit it.
  const title = canvas().locator(".site-faq h2");
  const box = await title.boundingBox();
  if (box === null) throw new Error("FAQ not visible");
  await clickOnCanvas(title, { position: { x: box.width * 0.97, y: box.height / 2 } });
  const list = panel().getByRole("group", { name: "Questions" });
  await expect(list.getByRole("listitem")).toHaveCount(2);

  await list.getByRole("button", { name: "Add Question" }).click();
  await expect(questions()).toHaveCount(3);
  await list.getByRole("button", { name: "Move Question down" }).first().click();
  await expect(questions().first()).toHaveText("Parking?");
  await list.getByRole("button", { name: "Delete Question" }).last().click();

  await expect(questions()).toHaveText(["Parking?", "Open on Sunday?"]);
  await expect(steps()).toHaveText([
    "Deleted Question",
    "Moved Question",
    "Added Question",
    "Opened page",
  ]);

  await page.keyboard.press("ControlOrMeta+z");
  await expect(questions()).toHaveCount(3);
});

test("adds a testimonial in the Edit panel and edits its name in its row (2.7b)", async () => {
  const title = canvas().locator(".site-testimonials h2");
  await title.scrollIntoViewIfNeeded();
  const box = await title.boundingBox();
  if (box === null) throw new Error("Testimonials not visible");
  // Beside the title, not on its text, which would start editing it.
  await clickOnCanvas(title, { position: { x: box.width * 0.97, y: box.height / 2 } });
  const list = panel().getByRole("group", { name: "Testimonials" });
  await expect(list.getByRole("listitem")).toHaveCount(1);

  await list.getByRole("button", { name: "Add Testimonial" }).click();
  const names = canvas().locator(".site-testimonial figcaption span").filter({ hasText: /./ });
  await expect(canvas().locator("figure.site-testimonial")).toHaveCount(2);
  const name = list.getByRole("listitem").last().getByRole("textbox", { name: "Name" });
  await name.fill("Tom");
  await name.blur();

  await expect(canvas().locator("figure.site-testimonial").last()).toContainText("Tom");
  await expect(names.first()).toHaveText("Priya");
  await expect(steps()).toHaveText(["Edited Testimonial name", "Added Testimonial", "Opened page"]);
});
