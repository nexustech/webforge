import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, test } from "@playwright/test";
import { createSite } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp } from "./launch.js";
import { type RendererWindow, stubFileDialogs } from "./sites.js";

// Rolling backups and damaged-file recovery (F-SITE-6, ADR 0003 §4): a site torn by a sync client
// opens as "corrupt", and Webforge offers its backups instead of failing.

let dir: string;
let userData: string;
let sitePath: string;
let app: ElectronApplication | undefined;

const site = createSite({
  name: "Rosa's Bakery",
  language: "en",
  homeTitle: "Home",
  notFoundTitle: "Page not found",
});

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-recovery-"));
  userData = join(dir, "user-data");
  sitePath = join(dir, "Rosa's Bakery.wforge");
  const store = ProjectStore.create(sitePath, { name: "Rosa's Bakery" });
  store.saveSite(site);
  store.close();
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/** The backups Webforge has taken, across all sites. */
function backupFiles(): string[] {
  const root = join(userData, "backups");
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true, encoding: "utf8" }).filter((name) =>
    name.endsWith(".wforge"),
  );
}

/** Damages the file as a torn sync copy would: the second half is gone. */
function tear(path: string): void {
  const bytes = readFileSync(path);
  writeFileSync(path, bytes.subarray(0, Math.floor(bytes.length / 2)));
}

test.describe("backups and recovery", () => {
  test("restores a damaged site from the backup taken when it was opened", async () => {
    // Opening the site takes a backup.
    app = await launchDesktopApp({ userDataDir: userData, args: [sitePath] });
    await app.firstWindow();
    await expect.poll(backupFiles).toHaveLength(1);
    await app.close();
    app = undefined;

    tear(sitePath);

    app = await launchDesktopApp({ userDataDir: userData });
    const page = await app.firstWindow();
    await stubFileDialogs(app, sitePath);
    // "Restore latest backup", the first button of the recovery message box.
    await app.evaluate(({ dialog }) => {
      const asked: unknown[] = [];
      Object.assign(globalThis, { recoveryAsked: asked });
      Object.assign(dialog, {
        showMessageBox: async (...args: unknown[]) => {
          asked.push(args.at(-1));
          return { response: 0, checkboxChecked: false };
        },
      });
    });

    const result = await page.evaluate(async () => {
      const { project } = (window as unknown as RendererWindow).webforge;
      const opened = await project.open();
      return { opened, read: await project.readSite() };
    });

    expect(result.opened).toMatchObject({ status: "opened", project: { name: "Rosa's Bakery" } });
    expect(result.read).toEqual({ status: "ok", site });
    const asked = await app.evaluate(
      () => (globalThis as unknown as { recoveryAsked: { title: string }[] }).recoveryAsked,
    );
    expect(asked.map((options) => options.title)).toEqual(["Site file damaged"]);
    // The damaged file is kept next to the restored one.
    expect(readdirSync(dir).filter((name) => name.includes("(damaged "))).toHaveLength(1);
  });

  test("reports a damaged site without backups and opens nothing", async () => {
    tear(sitePath);
    app = await launchDesktopApp({ userDataDir: userData });
    const page = await app.firstWindow();
    await stubFileDialogs(app, sitePath);
    await app.evaluate(({ dialog }) => {
      Object.assign(dialog, {
        showMessageBox: async () => ({ response: 0, checkboxChecked: false }),
      });
    });

    const opened = await page.evaluate(() =>
      (window as unknown as RendererWindow).webforge.project.open(),
    );

    expect(opened).toEqual({ status: "failed", reason: "corrupt" });
    expect(readdirSync(dir).filter((name) => name.includes("(damaged "))).toHaveLength(0);
  });
});
