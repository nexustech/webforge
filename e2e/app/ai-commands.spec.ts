import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// AI apps' commands (F-AI-1, 4.8): main forwards a tool call to the window, which runs it through
// the command layer as one undo step labelled for the app; a change to every page asks first (D7).

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Undo History" })
    .click();
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const step = (label: string) =>
  page.getByRole("list", { name: "Undo History" }).getByRole("button", { name: label });

/** Asks the window through main's bridge, as the MCP server (4.9) will for an AI app. */
const ask = (request: object) =>
  app.evaluate(async (_electron, sent) => {
    type Bridge = { ask(request: unknown): Promise<unknown> };
    return (globalThis as unknown as { webforgeAi: Bridge }).webforgeAi.ask(sent);
  }, request);

test("an AI app adds a section and changes the theme, each one undo step", async () => {
  const outline = (await ask({ kind: "query", name: "outline", input: {} })) as {
    status: string;
    data: { homePageId: string };
  };
  expect(outline.status).toBe("done");

  const added = await ask({
    kind: "command",
    name: "addNode",
    input: {
      location: { kind: "page", pageId: outline.data.homePageId },
      type: "Hero",
      values: { title: "Fresh bread every morning" },
      index: 0,
    },
    app: "Claude",
  });
  expect(added).toMatchObject({ status: "done", label: "AI (Claude): Added Hero" });
  await expect(canvas().getByText("Fresh bread every morning")).toBeVisible();
  await expect(step("AI (Claude): Added Hero")).toBeVisible();

  // The theme is on every page: the window asks the person first.
  const theme = ask({
    kind: "command",
    name: "setThemeTokens",
    input: { tokens: { spacing: "roomy" } },
    app: "Claude",
  });
  const question = page.getByRole("alertdialog");
  await expect(question).toHaveAccessibleName("Allow Claude to change the theme?");
  await question.getByRole("button", { name: "Allow" }).click();
  expect(await theme).toMatchObject({ status: "done", label: "AI (Claude): Changed the theme" });
  await expect(step("AI (Claude): Changed the theme")).toBeVisible();

  // Undo takes an AI app's steps back as any other.
  const undo = page.getByRole("banner").getByRole("button", { name: "Undo", exact: true });
  await undo.click();
  await undo.click();
  await expect(canvas().getByText("Fresh bread every morning")).toHaveCount(0);
});

test("an AI app's request is busy while a question is open, and declined when cancelled", async () => {
  const theme = ask({
    kind: "command",
    name: "setThemeTokens",
    input: { tokens: { spacing: "compact" } },
    app: "Claude",
  });
  await expect(page.getByRole("alertdialog")).toBeVisible();
  // While the person is asked, another request is busy, and doesn't replace the question.
  const busy = await ask({
    kind: "command",
    name: "addPage",
    input: { title: "Menu" },
    app: "Claude",
  });
  expect(busy).toMatchObject({ status: "busy" });
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  expect(await theme).toMatchObject({ status: "declined" });
});
