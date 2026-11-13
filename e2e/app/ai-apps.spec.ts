import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { chromium, type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { heroPhoto } from "@webforge/test-utils";
import { unzipSync } from "fflate";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";
import { openPreview, stubFileDialogs } from "./sites.js";

// AI apps (F-AI-1, 4.9): off until the person lets them connect; an app paired in AI apps…
// reaches the open site through the MCP server on this computer, with the key it was given, and
// its changes are undo steps named after it. Removing it cuts it off. Claude Desktop connects
// through the extension AI apps… writes for it (ADR 0021), with the key pasted into its settings.

let app: ElectronApplication;
let page: Page;
/** Folders a test made, deleted once the app has closed and let go of the sites in them. */
const folders: string[] = [];

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
  for (const folder of folders.splice(0)) {
    await rm(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const dialog = () => page.getByRole("dialog", { name: "AI apps" });
const step = (label: string) =>
  page.getByRole("list", { name: "Undo History" }).getByRole("button", { name: label });

test("Settings › App opens AI apps over Settings, which stays open under it (#752)", async () => {
  // Its shortcut: on a Mac, Settings… is in the app's menu, not File.
  await page.keyboard.press("ControlOrMeta+,");
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await settings.getByRole("tab", { name: "AI apps" }).click();
  const open = settings.getByRole("button", { name: "Open AI apps…" });
  await open.focus();
  await page.keyboard.press("Enter");

  // On top, and usable: its controls take clicks and keys, not Settings'.
  await expect(dialog()).toBeVisible();
  const allow = dialog().getByRole("checkbox", { name: "Let AI apps connect" });
  await allow.click();
  await expect(allow).toBeChecked();
  await allow.click();
  await expect(allow).not.toBeChecked();

  // Escape closes AI apps only; Settings is still there, on its AI apps section.
  await page.keyboard.press("Escape");
  await expect(dialog()).toBeHidden();
  await expect(settings).toBeVisible();
  await expect(open).toBeVisible();
});

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
  const [address, key] = await shown.locator("dd code").allTextContents();
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
  // Shown once the key is in the keychain, which can take a moment.
  await expect(shown.locator("dd code").first()).toBeVisible();
  const [key] = await shown.locator("dd code").allTextContents();
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
    // What Claude Desktop runs: the manifest's command, with the folder and the key filled in.
    const { mcp_config: config } = (
      JSON.parse(text) as {
        server: { mcp_config: { args: string[]; env: Record<string, string> } };
      }
    ).server;
    const fill = (value: string) =>
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the manifest's placeholders, filled in as Claude Desktop does.
      value.replaceAll("${__dirname}", installed).replaceAll("${user_config.key}", key);
    const client = new Client({ name: "claude-ai", version: "1" });
    await client.connect(
      new StdioClientTransport({
        // Claude Desktop's own Node.js; here, the one running the tests.
        command: process.execPath,
        args: config.args.map(fill),
        env: Object.fromEntries(
          Object.entries(config.env).map(([name, value]) => [name, fill(value)]),
        ),
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

/** Adds "Another app" called `name` in AI apps…, turned on: its address and key. */
/** Adds the app chosen in *Which app?* by `choice`, under the name offered, and shows its key. */
async function addFromChoice(choice: string, name: string) {
  await chooseFromMenu(app, page, "File", "AI apps…");
  const allow = dialog().getByRole("checkbox", { name: "Let AI apps connect" });
  if (!(await allow.isChecked())) await allow.click();
  await dialog().getByRole("button", { name: "Add AI app" }).click();
  await dialog().getByRole("radio", { name: choice }).click();
  await expect(dialog().getByRole("textbox", { name: "Name" })).toHaveValue(name);
  await dialog().getByRole("button", { name: "Add", exact: true }).click();
  const shown = dialog().getByRole("region", { name: `${name} is added` });
  await expect(shown.getByText(/You won't see it again/)).toBeVisible();
  return shown;
}

test("VS Code installs through its link, which has no key: the key VS Code asks for connects it (5.13)", async () => {
  test.skip(
    process.platform !== "win32" && process.platform !== "darwin",
    "an app's key is kept in the OS keychain, Windows' and macOS's (ADR 0006 §5, ADR 0021)",
  );
  // What Install in VS Code opens, instead of opening it: VS Code is this test.
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    Object.assign(globalThis, { opened });
    Object.assign(shell, {
      openExternal: async (url: string) => {
        opened.push(url);
      },
    });
  });
  const shown = await addFromChoice("VS Code (GitHub Copilot)", "VS Code");
  const [key] = await shown.locator("dd code").allTextContents();
  if (key === undefined) throw new Error("no key shown");
  await shown.getByRole("button", { name: "Install in VS Code" }).click();
  await expect(shown.getByText(/VS Code is opening/)).toBeVisible();

  const opened = await app.evaluate(() => (globalThis as { opened?: string[] }).opened ?? []);
  expect(opened).toHaveLength(1);
  const [link = ""] = opened;
  expect(link).toMatch(/^vscode:mcp\/install\?/);
  expect(link).not.toContain(key);
  const server = JSON.parse(decodeURIComponent(link.slice(link.indexOf("?") + 1))) as {
    url: string;
    headers: Record<string, string>;
    inputs: { id: string; password: boolean }[];
  };
  expect(server.inputs).toEqual([expect.objectContaining({ password: true })]);
  // As VS Code fills its input with what the person pastes.
  const header = server.headers.Authorization?.replace(`\${input:${server.inputs[0]?.id}}`, key);
  expect(header).toBe(`Bearer ${key}`);
  const client = await connect(server.url, key);
  expect((await client.listTools()).tools.length).toBeGreaterThan(0);
  await expect(dialog().getByText("Connected")).toBeVisible();
  await client.close();
});

test("Claude Code's command has no key: with the key in its variable, it connects (5.13)", async () => {
  test.skip(
    process.platform !== "win32" && process.platform !== "darwin",
    "an app's key is kept in the OS keychain, Windows' and macOS's (ADR 0006 §5, ADR 0021)",
  );
  const shown = await addFromChoice("Claude Code", "Claude Code");
  const [command = "", key] = await shown.locator("dd code").allTextContents();
  if (key === undefined) throw new Error("no key shown");
  expect(command).not.toContain(key);
  const [, url, header] =
    /^claude mcp add --transport http --scope user webforge (\S+) --header '([^']+)'$/.exec(
      command,
    ) ?? [];
  // As Claude Code expands WEBFORGE_KEY when it connects.
  expect(header?.replace(`\${WEBFORGE_KEY}`, key)).toBe(`Authorization: Bearer ${key}`);
  const client = await connect(url ?? "", key);
  expect((await client.listTools()).tools.length).toBeGreaterThan(0);
  await expect(dialog().getByText("Connected")).toBeVisible();
  await client.close();
});

async function pairAnotherApp(name: string): Promise<{ address: string; key: string }> {
  await chooseFromMenu(app, page, "File", "AI apps…");
  const allow = dialog().getByRole("checkbox", { name: "Let AI apps connect" });
  if (!(await allow.isChecked())) await allow.click();
  await dialog().getByRole("button", { name: "Add AI app" }).click();
  await dialog().getByRole("radio", { name: "Another app" }).click();
  await dialog().getByRole("textbox", { name: "Name" }).fill(name);
  await dialog().getByRole("button", { name: "Add", exact: true }).click();
  const shown = dialog().getByRole("region", { name: `${name} is added` });
  // Shown once the key is in the keychain, which can take a moment (macOS's especially).
  await expect(shown.getByText(/You won't see it again/)).toBeVisible();
  const [address, key] = await shown.locator("dd code").allTextContents();
  if (address === undefined || key === undefined) throw new Error("no address or key shown");
  await shown.getByRole("button", { name: "Done" }).click();
  await dialog().getByRole("button", { name: "Close" }).click();
  return { address, key };
}

test("an AI app's brief opens the quick start filled in; Create makes the site, closing it nothing (4.12a)", async () => {
  test.skip(
    process.platform !== "win32" && process.platform !== "darwin",
    "an app's key is kept in the OS keychain, Windows' and macOS's (ADR 0006 §5, ADR 0021)",
  );
  const { address, key } = await pairAnotherApp("Test client");
  const client = await connect(address, key);
  const dir = mkdtempSync(join(tmpdir(), "webforge-e2e-brief-"));
  folders.push(dir);
  try {
    await stubFileDialogs(app, join(dir, "Rapidfix.wforge"));
    const brief = {
      businessType: "trades",
      businessKind: "AutoRepair",
      name: "Rapidfix Vehicle Repair",
      whatYouDo: "Servicing, MOTs and repairs",
      colours: { colour: "#c62828" },
    };
    // What the brief offers to choose from needs no site.
    const choices = answer(
      await client.callTool({ name: "siteChoices", arguments: {} }),
    ) as unknown as {
      data: { businessTypes: { type: string; kinds: { kind: string }[] }[] };
    };
    expect(
      choices.data.businessTypes
        .find(({ type }) => type === "trades")
        ?.kinds.map(({ kind }) => kind),
    ).toContain("AutoRepair");

    // Nothing is made until the person clicks Create site, on the quick start the brief filled in.
    const created = client.callTool({ name: "createSiteFromBrief", arguments: brief }, undefined, {
      timeout: 120_000,
    });
    const quickStart = page.getByRole("dialog", { name: "Start a site" });
    await expect(quickStart.getByRole("button", { name: "Create site" })).toBeVisible();
    await quickStart.getByRole("button", { name: "Create site" }).click();
    expect(answer(await created)).toEqual({
      status: "done",
      data: { created: true, name: "Rapidfix Vehicle Repair" },
    });
    await waitForCanvas(page);
    const settings = (await page.evaluate(() =>
      (
        window as unknown as {
          webforge: { project: { readSite(): Promise<{ site: { settings: unknown } }> } };
        }
      ).webforge.project.readSite(),
    )) as { site: { settings: { general: Record<string, unknown> } } };
    expect(settings.site.settings.general).toMatchObject({
      name: "Rapidfix Vehicle Repair",
      businessType: "trades",
      businessKind: "AutoRepair",
    });

    // Another, closed: declined, and nothing made.
    const declined = client.callTool(
      { name: "createSiteFromBrief", arguments: { ...brief, name: "Elsewhere" } },
      undefined,
      { timeout: 120_000 },
    );
    await expect(quickStart.getByRole("button", { name: "Cancel" })).toBeVisible();
    await quickStart.getByRole("button", { name: "Cancel" }).click();
    expect(answer(await declined)).toMatchObject({ status: "declined" });
    await expect(quickStart).toHaveCount(0);
  } finally {
    await client.close();
  }
});

test("an AI app asks for pictures with its reason; the person chooses them in Add files (4.12b)", async () => {
  test.skip(
    process.platform !== "win32" && process.platform !== "darwin",
    "an app's key is kept in the OS keychain, Windows' and macOS's (ADR 0006 §5, ADR 0021)",
  );
  const { address, key } = await pairAnotherApp("Test client");
  const client = await connect(address, key);
  const dir = mkdtempSync(join(tmpdir(), "webforge-e2e-media-"));
  folders.push(dir);
  try {
    const photo = join(dir, "Workshop.jpg");
    writeFileSync(photo, heroPhoto());
    await stubFileDialogs(app, photo);
    const asked = page.getByRole("alertdialog", {
      name: "Test client asks you to add pictures or files",
    });

    // Add Files…: the file the person chooses, by its id, and Media lists it.
    const request = client.callTool({
      name: "requestMedia",
      arguments: { reason: "Photos of your workshop" },
    });
    await expect(asked.getByText('Its reason: "Photos of your workshop"')).toBeVisible();
    await asked.getByRole("button", { name: "Add Files…" }).click();
    const added = answer(await request) as unknown as {
      status: string;
      data: { added: { id: string; fileName: string; kind: string }[] };
    };
    expect(added).toMatchObject({
      status: "done",
      data: { added: [{ fileName: "Workshop.jpg", kind: "image" }] },
    });
    const media = answer(await client.callTool({ name: "media", arguments: {} })) as unknown as {
      data: { id: string; fileName: string; width: number }[];
    };
    expect(media.data).toEqual([
      expect.objectContaining({ id: added.data.added[0]?.id, fileName: "Workshop.jpg" }),
    ]);
    // The person's own step: it undoes as any other.
    await expect(step("Added image 'Workshop.jpg'")).toBeVisible();

    // Not now: nothing more is added, and the app is told; as after any decline, it waits.
    const notNow = client.callTool({
      name: "requestMedia",
      arguments: { reason: "Photos of your team" },
    });
    await expect(asked.getByText('Its reason: "Photos of your team"')).toBeVisible();
    await asked.getByRole("button", { name: "Not Now" }).click();
    expect(answer(await notNow)).toMatchObject({ status: "declined" });
    expect(
      answer(await client.callTool({ name: "requestMedia", arguments: { reason: "Photos" } })),
    ).toMatchObject({ status: "busy" });
    expect(answer(await client.callTool({ name: "media", arguments: {} }))).toMatchObject({
      data: [expect.objectContaining({ fileName: "Workshop.jpg" })],
    });
  } finally {
    await client.close();
  }
});

/** What the garage's owner asks for in product/16's prompt, as its brief. */
const RAPIDFIX = {
  businessType: "trades",
  businessKind: "AutoRepair",
  name: "Rapidfix Vehicle Repair",
  whatYouDo: "MOTs, car repair and a bodyshop",
  colours: { colour: "#c62828" },
  phone: "0113 496 0123",
  email: "hello@rapidfix.example",
  address: "12 Station Road, Leeds LS11 5AB",
};

/** The colour `css` is drawn in, as red, green and blue from 0 to 255. */
const drawn = (site: Page, css: string) =>
  site.evaluate((colour) => {
    const context = document.createElement("canvas").getContext("2d");
    if (context === null) throw new Error("no canvas");
    const probe = document.createElement("div");
    probe.style.color = colour;
    document.body.append(probe);
    context.fillStyle = getComputedStyle(probe).color;
    probe.remove();
    context.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;
    return { r, g, b };
  }, css);

test("Rapidfix: an AI app builds a garage's site from a brief and one plan, with its refusals (4.12b, AIB-9)", async () => {
  test.skip(
    process.platform !== "win32" && process.platform !== "darwin",
    "an app's key is kept in the OS keychain, Windows' and macOS's (ADR 0006 §5, ADR 0021)",
  );
  test.setTimeout(300_000);
  const { address, key } = await pairAnotherApp("Test client");
  const client = await connect(address, key);
  const dir = mkdtempSync(join(tmpdir(), "webforge-e2e-rapidfix-"));
  folders.push(dir);
  // The preview opens in the test's browser, not the person's.
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    Object.assign(globalThis, { opened });
    Object.assign(shell, {
      openExternal: async (url: string) => {
        opened.push(url);
      },
    });
  });
  const browser = await chromium.launch();
  try {
    await stubFileDialogs(app, join(dir, "Rapidfix.wforge"));

    // The prompt the person starts from, with their description.
    const prompt = await client.getPrompt({
      name: "build-site-from-description",
      arguments: {
        description: "A site for my garage, Rapidfix Vehicle Repair, in red and white.",
      },
    });
    expect(JSON.stringify(prompt.messages)).toContain("createSiteFromBrief");

    // 1. The brief: the person checks it and clicks Create site.
    const created = client.callTool(
      { name: "createSiteFromBrief", arguments: RAPIDFIX },
      undefined,
      { timeout: 120_000 },
    );
    const quickStart = page.getByRole("dialog", { name: "Start a site" });
    await quickStart.getByRole("button", { name: "Create site" }).click();
    expect(answer(await created)).toMatchObject({ status: "done" });
    await waitForCanvas(page);
    await page
      .getByRole("region", { name: "Left panels" })
      .getByRole("tab", { name: "Undo History" })
      .click();

    // 2. What it has: the pages, by title.
    const outline = answer(
      await client.callTool({ name: "outline", arguments: {} }),
    ) as unknown as {
      data: { pages: { id: string; title: string }[] };
    };
    const pageId = (title: string) => {
      const found = outline.data.pages.find((each) => each.title === title);
      if (found === undefined) throw new Error(`no ${title} page`);
      return found.id;
    };
    const services = { kind: "page", pageId: pageId("Services") };
    const contact = { kind: "page", pageId: pageId("Contact") };

    // A plan with one command that can't be done changes nothing, and asks nothing.
    const bad = answer(
      await client.callTool({
        name: "plan",
        arguments: {
          title: "Build it",
          commands: [
            { name: "addPage", input: { title: "MOTs" } },
            { name: "addNode", input: { location: contact, type: "Carousel3000" } },
          ],
        },
      }),
    ) as unknown as { status: string; message: string };
    expect(bad.status).toBe("invalid");
    expect(bad.message).toMatch(/^Command 2 \(addNode\): .* Nothing changed\.$/);

    // 3. The build, as one plan: three services, and the map.
    const title = (nodeId: string, text: string) => ({
      name: "editText",
      input: { location: services, nodeId, field: "title", text },
    });
    const build = client.callTool(
      {
        name: "plan",
        arguments: {
          title: "Build the Rapidfix site",
          commands: [
            title("service-0", "MOTs"),
            title("service-1", "Car repair"),
            title("service-2", "Bodyshop"),
            ...["service-3", "service-4", "service-5"].map((nodeId) => ({
              name: "removeNode",
              input: { location: services, nodeId },
            })),
            {
              name: "addNode",
              input: {
                location: contact,
                type: "Map",
                values: { title: "Find the garage", address: RAPIDFIX.address },
                index: 1,
              },
            },
          ],
        },
      },
      undefined,
      { timeout: 120_000 },
    );
    const allow = page.getByRole("alertdialog", {
      name: "Allow Test client to make these changes: Build the Rapidfix site?",
    });
    await expect(allow).toContainText(
      "Sections and elements: 1 added, 3 changed, 0 moved, 3 removed.",
    );
    await allow.getByRole("button", { name: "Allow" }).click();
    expect(answer(await build)).toEqual({
      status: "done",
      label: "AI (Test client): Build the Rapidfix site",
    });
    await expect(step("AI (Test client): Build the Rapidfix site")).toHaveCount(1);

    // 4. Site Check: the template's pictures are still there, for the app to ask about.
    const check = answer(
      await client.callTool({ name: "runSiteCheck", arguments: {} }),
    ) as unknown as { data: { found: { rule: string }[] } };
    expect(check.data.found.map(({ rule }) => rule)).toContain("templateImages");

    // 5. The preview: the site as visitors will see it.
    expect(answer(await client.callTool({ name: "openPreview", arguments: {} }))).toMatchObject({
      data: { opened: true },
    });
    const opened = () =>
      app.evaluate(() => (globalThis as unknown as { opened: string[] }).opened.slice());
    await expect.poll(opened).toHaveLength(1);
    const [home = ""] = await opened();
    const site = await browser.newPage();
    await openPreview(site, home);
    // The name everywhere: the Header, and the page's title.
    await expect(site.getByRole("banner")).toContainText(RAPIDFIX.name);
    await expect(site).toHaveTitle(new RegExp(RAPIDFIX.name));
    // Red buttons, from the brief's brand colour.
    const brand = await drawn(site, "var(--color-primary)");
    expect(brand.r).toBeGreaterThan(150);
    expect(brand.g).toBeLessThan(90);
    expect(brand.b).toBeLessThan(90);

    await openPreview(site, home.replace(/index\.html$/, "services.html"));
    // The page's first section, the services: the prices below it have headings of their own.
    const offered = site.getByRole("main").locator("section").first();
    await expect(offered.getByRole("heading", { level: 3 })).toHaveText([
      "MOTs",
      "Car repair",
      "Bodyshop",
    ]);

    await openPreview(site, home.replace(/index\.html$/, "contact.html"));
    const main = site.getByRole("main");
    await expect(main).toContainText("Find the garage");
    await expect(main).toContainText(RAPIDFIX.address);
    await expect(main).toContainText(RAPIDFIX.phone);
    await expect(main).toContainText(RAPIDFIX.email);

    // One Undo takes the whole build back.
    await page.getByRole("banner").getByRole("button", { name: "Undo", exact: true }).click();
    const tree = answer(
      await client.callTool({ name: "pageTree", arguments: { location: services } }),
    ) as unknown as { data: { slots?: { items?: unknown[] } }[] };
    expect(tree.data[0]?.slots?.items).toHaveLength(6);
    const contactTree = answer(
      await client.callTool({ name: "pageTree", arguments: { location: contact } }),
    ) as unknown as { data: { type: string }[] };
    expect(contactTree.data.map(({ type }) => type)).not.toContain("Map");

    // Content mode: a plan holding a new section is refused whole.
    await page.getByRole("radio", { name: "Content" }).click();
    expect(
      answer(
        await client.callTool({
          name: "plan",
          arguments: {
            title: "More",
            commands: [
              title("service-0", "MOT testing"),
              { name: "addNode", input: { location: contact, type: "Map" } },
            ],
          },
        }),
      ),
    ).toMatchObject({ status: "refused" });
    await expect(step("AI (Test client): More")).toHaveCount(0);
    await page.getByRole("radio", { name: "Design" }).click();

    // A brief the person closes makes no site: the garage's stays open.
    const declined = client.callTool(
      { name: "createSiteFromBrief", arguments: { ...RAPIDFIX, name: "Rapidfix Two" } },
      undefined,
      { timeout: 120_000 },
    );
    await quickStart.getByRole("button", { name: "Cancel" }).click();
    expect(answer(await declined)).toMatchObject({ status: "declined" });
    expect(answer(await client.callTool({ name: "outline", arguments: {} }))).toMatchObject({
      data: { name: RAPIDFIX.name },
    });
  } finally {
    await browser.close();
    await client.close();
  }
});
