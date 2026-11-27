import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  chromium,
  type ElectronApplication,
  expect,
  type FrameLocator,
  type Page,
  test,
} from "@playwright/test";
import { createSite, type NodeDoc } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { boxOf, drag } from "./drag.js";
import { sizeWindow } from "./fits.js";
import { launchDesktopApp, removeWhenFree, waitForCanvas } from "./launch.js";
import { openPreview } from "./sites.js";

// Columns' Line up and Last column first (CP-14, #1544): lined up on the canvas as in Preview,
// where Puck's wrapper sits between the grid and each column, and drawn last first on the devices
// chosen, with the columns kept in their saved order for selecting, dragging and Layers.

const paragraph = (id: string, text: string): NodeDoc => ({
  type: "Text",
  props: { id, text: `<p>${text}</p>` },
});
const LONG =
  "Baked before dawn from flour milled down the road, with butter from the farm next door.";

/** A short column beside a tall one, lined up as `lineUp`. */
const linedUp = (lineUp: string): NodeDoc => ({
  type: "Columns",
  props: {
    id: `line-up-${lineUp}`,
    layout: "equal",
    lineUp,
    columns: [
      {
        type: "Column",
        props: { id: `${lineUp}-a`, content: [paragraph(`${lineUp}-a-text`, `Short ${lineUp}`)] },
      },
      {
        type: "Column",
        props: {
          id: `${lineUp}-b`,
          content: [0, 1, 2, 3].map((index) => paragraph(`${lineUp}-b-${index}`, LONG)),
        },
      },
    ],
  },
});

/** Two columns, equal, one under another on Mobile, saying which they are. */
const ordered: NodeDoc = {
  type: "Columns",
  props: {
    id: "ordered",
    layout: { $responsive: { desktop: "equal", mobile: "stacked" } },
    columns: [1, 2].map((index) => ({
      type: "Column",
      props: {
        id: `ordered-${index}`,
        content: [
          paragraph(`ordered-${index}-text`, `Column ${index} of 2`),
          // Something to drag: a Text's editor takes a press to select words.
          ...(index === 1
            ? [{ type: "Spacer", props: { id: "ordered-spacer", height: "large" } }]
            : []),
        ],
      },
    })),
  },
};

let dir: string;
let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-columns-"));
  const sitePath = join(dir, "Columns.wforge");
  const site = createSite({
    name: "Columns",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "x",
  });
  site.pages[site.homePageId]?.doc.content.push({
    type: "Section",
    props: {
      id: "section",
      contentWidth: "medium",
      content: [linedUp("top"), linedUp("middle"), linedUp("bottom"), ordered],
    },
  });
  const store = ProjectStore.create(sitePath, { name: "Columns" });
  store.saveSite(site);
  store.close();
  app = await launchDesktopApp({ args: [sitePath] });
  page = await app.firstWindow();
  await waitForCanvas(page);
  await sizeWindow(app, page, { width: 1366, height: 768 });
});

test.afterEach(async () => {
  await app.close();
  void removeWhenFree(dir);
});

const canvas = () => page.frameLocator(".editor__canvas iframe");

/** Each Columns' columns' tops and bottoms, in page order, by the text each column starts with. */
function columnBoxes(root: Page | FrameLocator) {
  return root.locator("body").evaluate((body) =>
    [...body.querySelectorAll(".site-columns")].map((columns) =>
      [...columns.querySelectorAll<HTMLElement>(".site-column")].map((column) => {
        // What the column holds: a column has no box of its own, and on the site the grid
        // stretches it, where on the canvas Puck's wrapper around it is the one stretched.
        const box = (column.firstElementChild ?? column).getBoundingClientRect();
        return {
          text: column.textContent?.trim() ?? "",
          top: Math.round(box.top),
          bottom: Math.round(box.bottom),
          left: Math.round(box.left),
        };
      }),
    ),
  );
}

/** Checks the first three Columns are lined up at the top, in the middle and at the bottom. */
function expectLinedUp(boxes: Awaited<ReturnType<typeof columnBoxes>>, where: string): void {
  const [top, middle, bottom] = boxes;
  const pair = (each: typeof top) => {
    const [short, tall] = each ?? [];
    if (short === undefined || tall === undefined) throw new Error(`${where}: no columns`);
    // The short one is short: something to line up.
    expect(tall.bottom - tall.top, where).toBeGreaterThan(short.bottom - short.top + 40);
    return { short, tall };
  };
  const t = pair(top);
  expect.soft(Math.abs(t.short.top - t.tall.top), `${where}, Top`).toBeLessThanOrEqual(1);
  const m = pair(middle);
  expect
    .soft(
      Math.abs((m.short.top + m.short.bottom) / 2 - (m.tall.top + m.tall.bottom) / 2),
      `${where}, Middle`,
    )
    .toBeLessThanOrEqual(1);
  const b = pair(bottom);
  expect.soft(Math.abs(b.short.bottom - b.tall.bottom), `${where}, Bottom`).toBeLessThanOrEqual(1);
}

/** The address Preview opens in the default browser, caught instead. */
async function previewAddress(): Promise<string> {
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    Object.assign(globalThis, { opened });
    Object.assign(shell, {
      openExternal: async (url: string) => {
        opened.push(url);
      },
    });
  });
  const opened = () =>
    app.evaluate(() => (globalThis as unknown as { opened: string[] }).opened.slice());
  await page.getByRole("banner").getByRole("button", { name: "Preview", exact: true }).click();
  await expect.poll(opened).toHaveLength(1);
  return (await opened())[0] ?? "";
}

/** Shows the canvas as `device`. */
const showAs = (device: "Desktop" | "Mobile") =>
  page.getByRole("toolbar", { name: "Canvas" }).getByRole("radio", { name: device }).click();

test("lines the columns up at the top, in the middle and at the bottom, on the canvas as in Preview (#1544)", async () => {
  await expect(canvas().getByText("Short bottom")).toBeVisible();
  expectLinedUp(await columnBoxes(canvas()), "the canvas");

  const browser = await chromium.launch();
  try {
    const site = await browser.newPage({ viewport: { width: 1024, height: 800 } });
    await openPreview(site, await previewAddress());
    expectLinedUp(await columnBoxes(site), "Preview");
  } finally {
    await browser.close();
  }
});

test("draws the columns last first on Mobile once set there, keeping their order for dragging (#1544)", async () => {
  test.setTimeout(150_000);
  const left = page.getByRole("region", { name: "Left panels" });
  const right = page.getByRole("region", { name: "Right panels" });
  // The fourth Columns, which says which column is which.
  await left
    .getByRole("treeitem", { name: /^Columns/ })
    .nth(3)
    .click();
  await right.getByRole("tab", { name: "Style", exact: true }).click();
  await right.getByRole("button", { name: "Last column first on each device" }).click();
  await right
    .getByRole("group", { name: "Last column first on each device" })
    .getByLabel("Mobile", { exact: true })
    .click();
  await left.getByRole("tab", { name: "Undo History", exact: true }).click();
  await expect(page.locator(".undo-history__step").first()).toHaveText(
    /^Changed Columns last column first/,
  );

  /** The ordered Columns' columns: by their text, as drawn, and in their saved order. */
  const ordered = async () => {
    const boxes = (await columnBoxes(canvas()))[3] ?? [];
    return {
      saved: boxes.map((box) => box.text),
      drawn: [...boxes].sort((a, b) => a.top - b.top || a.left - b.left).map((box) => box.text),
    };
  };
  // Desktop: side by side in their order.
  await expect
    .poll(async () => (await ordered()).drawn)
    .toEqual(["Column 1 of 2", "Column 2 of 2"]);
  // Mobile: the second drawn first, the saved order as it was.
  await showAs("Mobile");
  await expect
    .poll(async () => (await ordered()).drawn)
    .toEqual(["Column 2 of 2", "Column 1 of 2"]);
  expect((await ordered()).saved).toEqual(["Column 1 of 2", "Column 2 of 2"]);

  // In Preview at a phone's width, the same.
  const browser = await chromium.launch();
  try {
    const site = await browser.newPage({ viewport: { width: 390, height: 800 } });
    await openPreview(site, await previewAddress());
    const boxes = (await columnBoxes(site))[3] ?? [];
    expect(
      [...boxes].sort((a, b) => a.top - b.top).map((box) => box.text),
      "Preview at 390 px",
    ).toEqual(["Column 2 of 2", "Column 1 of 2"]);
  } finally {
    await browser.close();
  }

  // The Spacer dragged from the column drawn second into the one drawn first lands there, under
  // its text, and the columns keep their saved order.
  const spacerIn = (index: number) =>
    canvas()
      .locator(".site-columns")
      .nth(3)
      .locator(".site-column")
      .nth(index)
      .locator(".site-spacer");
  await expect(spacerIn(0)).toHaveCount(1);
  // Selected first, as a person picks up what they mean to move: the Columns is selected now.
  await left.getByRole("treeitem", { name: /^Spacer/ }).click();
  // Aimed at Column 2 where it is once the drag is under way, as a person aims at what they see:
  // the canvas moves as a drag starts, and a point found before it can be over the other column.
  const target = canvas().getByText("Column 2 of 2", { exact: true });
  await drag(page, spacerIn(0), async () => {
    const at = await boxOf(target, "Column 2's text");
    return { x: at.x + at.width / 2, y: at.y + at.height * 0.8 };
  });
  await expect(spacerIn(1)).toHaveCount(1);
  await expect(spacerIn(0)).toHaveCount(0);
  expect((await ordered()).saved).toEqual(["Column 1 of 2", "Column 2 of 2"]);
});
