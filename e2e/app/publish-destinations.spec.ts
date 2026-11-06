import { mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { ProjectStore } from "@webforge/storage";
import { startSftpServer } from "../packaged/sftp-server.js";
import { launchDesktopApp, newUserDataDir } from "./launch.js";

// A made-up password: the test never touches a real credential.
const PASSWORD = "test-only-sftp-password";

let app: ElectronApplication | undefined;
let server: Awaited<ReturnType<typeof startSftpServer>> | undefined;
let dir: string;
let userData: string;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-publish-"));
  userData = newUserDataDir();
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  await server?.stop();
  server = undefined;
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  await rm(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/** The site at `path` open in the app, with the Publish dialog showing its destinations. */
async function openPublish(path: string): Promise<Page> {
  app = await launchDesktopApp({ userDataDir: userData, args: [path] });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("button", { name: "Publish…", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Publish" })).toBeVisible();
  return page;
}

test("adds an SFTP destination and keeps its password in the keychain, never the site file (4.4a)", async () => {
  test.skip(
    process.platform !== "win32" && process.platform !== "darwin",
    "the OS keychain is Windows' and macOS's (ADR 0006 §5)",
  );
  server = await startSftpServer({ user: "baker", password: PASSWORD });
  const path = join(dir, "Rosa's Bakery.wforge");
  ProjectStore.create(path, { name: "Rosa's Bakery" }).close();

  const page = await openPublish(path);
  const publish = page.getByRole("dialog", { name: "Publish" });
  await expect(publish.getByText(/No destinations yet/)).toBeVisible();
  await publish.getByRole("button", { name: "Add Destination" }).click();

  const form = page.getByRole("dialog", { name: "Publish to your web host" });
  await form.getByLabel("Name", { exact: true }).fill("Test host");
  await form.getByLabel("Connection", { exact: true }).selectOption("sftp");
  await form.getByLabel("Host", { exact: true }).fill("127.0.0.1");
  await form.getByLabel("Port", { exact: true }).fill(String(server.port));
  await form.getByLabel("User name", { exact: true }).fill("baker");
  await form.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await form.getByLabel("Folder", { exact: true }).fill("/site");
  await form.getByLabel("Web address", { exact: true }).fill("https://www.rosas-bakery.example");
  // The host's key is trusted the first time, then the sign-in tested.
  await form.getByRole("button", { name: "Test Connection" }).click();
  await form.getByRole("button", { name: "Trust This Host" }).click();
  await expect(form.getByText(/Connected/)).toBeVisible();
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form).toBeHidden();

  // Listed, and tested from the list with the password main keeps.
  await expect(publish.getByText("127.0.0.1 · /site")).toBeVisible();
  await publish.getByRole("button", { name: "Test the connection to Test host" }).click();
  await expect(publish.getByText(/Connected/)).toBeVisible();
  await app?.close();
  app = undefined;

  // Neither the password nor the host's key is in the site's file; its web address is filled in.
  const file = readFileSync(path);
  expect(file.includes(PASSWORD)).toBe(false);
  expect(file.includes("SHA256:")).toBe(false);
  const store = ProjectStore.open(path, { readOnly: true });
  try {
    expect(store.readPublishDestinations()).toEqual([
      expect.objectContaining({ name: "Test host", kind: "file-transfer" }),
    ]);
    expect(store.readSite().settings.address.url).toBe("https://www.rosas-bakery.example");
  } finally {
    store.close();
  }

  // The next run reads the password back from the keychain (DPAPI, Keychain).
  const again = await openPublish(path);
  const reopened = again.getByRole("dialog", { name: "Publish" });
  await reopened.getByRole("button", { name: "Test the connection to Test host" }).click();
  await expect(reopened.getByText(/Connected/)).toBeVisible();
});
