import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// The Carousel on the canvas (2.10): its slides are a repeating list in the Edit panel, and the
// canvas shows every slide, one under another, to be edited.

let dir: string;
let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-carousel-"));
  const sitePath = join(dir, "Carousel.wforge");
  const site = createSite({
    name: "Carousel",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  site.pages[site.homePageId]?.doc.content.push({
    type: "Section",
    props: {
      id: "quotes-section",
      content: [
        {
          type: "Carousel",
          props: {
            id: "quotes",
            label: "What customers say",
            variant: "testimonials",
            slides: [
              {
                type: "CarouselSlide",
                props: { id: "s1", text: "The best sourdough in town.", name: "Sam" },
              },
            ],
          },
        },
      ],
    },
  });
  const store = ProjectStore.create(sitePath, { name: "Carousel" });
  store.saveSite(site);
  store.close();
  app = await launchDesktopApp({ args: [sitePath] });
  page = await app.firstWindow();
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const left = () => page.getByRole("region", { name: "Left panels" });
const panel = () => page.getByRole("region", { name: "Right panels" });
const slides = () => canvas().locator(".site-carousel-slide");

test("adds slides from the Edit panel's list, and shows each one on the canvas", async () => {
  await left()
    .getByRole("tree", { name: "Layers" })
    .getByRole("treeitem", { name: /^Carousel/ })
    .click();
  const list = panel().getByRole("group", { name: "Slides" });
  await expect(list.getByRole("listitem")).toHaveCount(1);

  await list.getByRole("button", { name: "Add Slide" }).click();

  await expect(slides()).toHaveCount(2);
  // One under the other, not scrolled out of sight, so each can be edited.
  const [first, second] = [
    await slides().nth(0).boundingBox(),
    await slides().nth(1).boundingBox(),
  ];
  if (first === null || second === null) throw new Error("Slides not visible");
  expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
  await expect(slides().nth(1)).toContainText("Say what this slide shows.");
  // Its buttons only show on the exported site, where they work.
  await expect(canvas().getByRole("button", { name: "Next slide" })).toBeHidden();

  // Autoplay is the person's choice, off by default, with its interval beside it and a word on
  // reduced motion.
  await panel().getByRole("tab", { name: "Style" }).click();
  const autoplay = panel().getByRole("switch", { name: "Play automatically" });
  await expect(autoplay).toHaveAttribute("aria-checked", "false");
  await expect(autoplay).toHaveAccessibleDescription(/prefer less motion/);
  await expect(panel().getByLabel("Next slide after")).toBeVisible();

  await left().getByRole("tab", { name: "Undo History" }).click();
  await expect(page.locator(".undo-history__step")).toHaveText(["Added Slide", "Opened page"]);
});
