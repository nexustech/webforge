import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp } from "./launch.js";

// Repeating lists in the Edit panel (F-ED-6): a FAQ's questions are added, moved and deleted there,
// one labelled undo step each.

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
  const store = ProjectStore.create(sitePath, { name: "Lists" });
  store.saveSite(site);
  store.close();
  app = await launchDesktopApp({ args: [sitePath] });
  page = await app.firstWindow();
  await expect(canvas().locator("style[data-webforge-site-css]")).toHaveCount(1);
});

test.afterEach(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
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
  await title.click({ position: { x: box.width * 0.97, y: box.height / 2 } });
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
