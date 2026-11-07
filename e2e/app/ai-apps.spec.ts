import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { getMcpConfigForManifest, type McpbManifestAny } from "@anthropic-ai/mcpb";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { unzipSync } from "fflate";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// AI apps (F-AI-1, 4.9): off until the person lets them connect; an app paired in AI apps…
// reaches the open site through the MCP server on this computer, with the key it was given, and
// its changes are undo steps named after it. Removing it cuts it off. Claude Desktop connects
// through the extension AI apps… writes for it (ADR 0021), with the key pasted into its settings.

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
  test.skip(
    process.platform !== "win32" && process.platform !== "darwin",
    "an app's key is kept in the OS keychain, Windows' and macOS's (ADR 0006 §5, ADR 0021)",
  );
  await chooseFromMenu(app, page, "File", "AI apps…");
  const allow = dialog().getByRole("checkbox", { name: "Let AI apps connect" });
  // Off by default: nothing listens, and nothing can be added.
  await expect(allow).not.toBeChecked();
  await expect(dialog().getByRole("button", { name: "Add AI app" })).toBeDisabled();

  await allow.click();
  await dialog().getByRole("button", { name: "Add AI app" }).click();
  await dialog().getByRole("radio", { name: "Another app" }).click();
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

test("Claude Desktop connects through the extension AI apps… writes, with its key pasted in", async () => {
  test.skip(
    process.platform !== "win32" && process.platform !== "darwin",
    "an app's key is kept in the OS keychain, Windows' and macOS's (ADR 0006 §5, ADR 0021)",
  );
  // What Install in Claude Desktop opens, instead of opening it: Claude Desktop is this test.
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    Object.assign(globalThis, { opened });
    Object.assign(shell, {
      openPath: async (path: string) => {
        opened.push(path);
        return "";
      },
    });
  });
  await chooseFromMenu(app, page, "File", "AI apps…");
  await dialog().getByRole("checkbox", { name: "Let AI apps connect" }).click();
  await dialog().getByRole("button", { name: "Add AI app" }).click();
  // Claude Desktop is the first choice, named so.
  await expect(dialog().getByRole("textbox", { name: "Name" })).toHaveValue("Claude Desktop");
  await dialog().getByRole("button", { name: "Add", exact: true }).click();
  const shown = dialog().getByRole("region", { name: "Claude Desktop is added" });
  const [key] = await shown.locator("dd").allTextContents();
  if (key === undefined) throw new Error("no key shown");
  await shown.getByRole("button", { name: "Install in Claude Desktop" }).click();
  await expect(shown.getByText(/Claude Desktop is opening the extension/)).toBeVisible();
  const [file] = await app.evaluate(() =>
    (globalThis as unknown as { opened: string[] }).opened.slice(),
  );
  if (file === undefined) throw new Error("no extension opened");
  expect(file).toMatch(/\.mcpb$/);

  // Installed as Claude Desktop installs it: unpacked, and run with the key pasted in.
  const installed = mkdtempSync(join(tmpdir(), "webforge-e2e-extension-"));
  try {
    for (const [name, bytes] of Object.entries(unzipSync(readFileSync(file)))) {
      mkdirSync(dirname(join(installed, name)), { recursive: true });
      writeFileSync(join(installed, name), bytes);
    }
    const text = readFileSync(join(installed, "manifest.json"), "utf8");
    // The key is the person's to paste: never in the file.
    expect(text).not.toContain(key);
    const config = await getMcpConfigForManifest({
      manifest: JSON.parse(text) as McpbManifestAny,
      extensionPath: installed,
      systemDirs: {},
      userConfig: { key },
      pathSeparator: sep,
    });
    if (config === undefined) throw new Error("no MCP config");
    const client = new Client({ name: "claude-ai", version: "1" });
    await client.connect(
      new StdioClientTransport({
        // Claude Desktop's own Node.js; here, the one running the tests.
        command: process.execPath,
        args: config.args ?? [],
        env: config.env ?? {},
      }),
    );
    try {
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
      expect(added).toMatchObject({ status: "done", label: "AI (Claude Desktop): Added Hero" });
      await expect(dialog().getByText("Connected")).toBeVisible();
    } finally {
      await client.close();
    }
  } finally {
    rmSync(installed, { recursive: true, force: true });
  }

  // Removed, its extension goes with it.
  await shown.getByRole("button", { name: "Done" }).click();
  await dialog().getByRole("button", { name: "Remove Claude Desktop" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
  await expect(dialog().getByText("No AI apps yet.")).toBeVisible();
  expect(existsSync(file)).toBe(false);
});
