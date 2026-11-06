import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// AI apps (F-AI-1, 4.9): off until the person lets them connect; an app paired in AI apps…
// reaches the open site through the MCP server on this computer, with the key it was given, and
// its changes are undo steps named after it. Removing it cuts it off.

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
const dialog = () => page.getByRole("dialog", { name: "AI apps" });
const step = (label: string) =>
  page.getByRole("list", { name: "Undo History" }).getByRole("button", { name: label });

/** A client connected as an AI app at `address` with `key`, as Claude Code or Cursor would. */
async function connect(address: string, key: string): Promise<Client> {
  const client = new Client({ name: "e2e", version: "1" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(address), {
      requestInit: { headers: { authorization: `Bearer ${key}` } },
    }),
  );
  return client;
}

/** A tool's answer, as the window gave it. */
const answer = (result: unknown) => {
  const [content] = (result as { content: { text: string }[] }).content;
  return JSON.parse(content?.text ?? "null") as {
    status: string;
    data?: { homePageId: string };
    label?: string;
  };
};

test("an AI app paired in AI apps… changes the site, as undo steps named after it, until removed", async () => {
  await chooseFromMenu(app, page, "File", "AI apps…");
  const allow = dialog().getByRole("checkbox", { name: "Let AI apps connect" });
  // Off by default: nothing listens, and nothing can be added.
  await expect(allow).not.toBeChecked();
  await expect(dialog().getByRole("button", { name: "Add AI app" })).toBeDisabled();

  await allow.click();
  await dialog().getByRole("button", { name: "Add AI app" }).click();
  await dialog().getByRole("textbox", { name: "Name" }).fill("Test client");
  await dialog().getByRole("button", { name: "Add", exact: true }).click();
  const shown = dialog().getByRole("region", { name: "Test client is added" });
  await expect(shown.getByText(/You won't see it again/)).toBeVisible();
  const [address, key] = await shown.locator("dd").allTextContents();
  if (address === undefined || key === undefined) throw new Error("no address or key shown");
  expect(address).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
  await shown.getByRole("button", { name: "Done" }).click();
  await expect(dialog().getByText(key)).toHaveCount(0);

  const client = await connect(address, key);
  const tools = (await client.listTools()).tools.map((tool) => tool.name);
  expect(tools).toEqual(expect.arrayContaining(["outline", "addNode", "runSiteCheck"]));
  const outline = answer(await client.callTool({ name: "outline", arguments: {} }));
  const added = answer(
    await client.callTool({
      name: "addNode",
      arguments: {
        location: { kind: "page", pageId: outline.data?.homePageId },
        type: "Hero",
        values: { title: "Fresh bread every morning" },
        index: 0,
      },
    }),
  );
  expect(added).toMatchObject({ status: "done", label: "AI (Test client): Added Hero" });
  // Connected, as AI apps says; with it closed, the step and the title bar's sign show.
  await expect(dialog().getByText("Connected")).toBeVisible();
  await dialog().getByRole("button", { name: "Close" }).click();
  await expect(canvas().getByText("Fresh bread every morning")).toBeVisible();
  await expect(step("AI (Test client): Added Hero")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connected AI apps: Test client. Open AI apps." }),
  ).toBeVisible();

  // Its change undoes as any other.
  await page.getByRole("banner").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(canvas().getByText("Fresh bread every morning")).toHaveCount(0);

  // Removed, it's cut off: its connection and its key.
  await chooseFromMenu(app, page, "File", "AI apps…");
  await dialog().getByRole("button", { name: "Remove Test client" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
  await expect(dialog().getByText("No AI apps yet.")).toBeVisible();
  await expect(client.callTool({ name: "outline", arguments: {} })).rejects.toThrow();
  await expect(connect(address, key)).rejects.toThrow();
});
