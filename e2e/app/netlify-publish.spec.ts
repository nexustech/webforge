import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp, newUserDataDir } from "./launch.js";
import { type MockNetlify, startMockNetlify } from "./netlify-mock.js";

// Publishing to Netlify (4.2, #70) through 4.5's flow, against a mock of Netlify's API on this
// computer (`netlify-mock.ts`), which only an unpackaged app is pointed at. The destination is
// saved through 4.2's own calls, as 4.4b's form will save it: a pasted token, and the site. Until
// 4.4b gives a Netlify destination its buttons in the Publish dialog, each publish is the call the
// dialog and Version History make (`publish.publish`): main reads, gates and records it, and the
// export worker builds and sends it, as for any destination.

/** What these tests call of `window.webforge`. */
type Webforge = {
  readonly project: { getCurrent(): Promise<{ sessionId: string } | null> };
  readonly netlify: {
    signInWithToken(token: string): Promise<{ status: string; handle?: string }>;
    saveDestination(
      sessionId: string,
      draft: { name: string; site: { id: string; name: string } },
      signIn: { handle: string },
    ): Promise<{ status: string; destination?: { id: string } }>;
    checkAccess(
      sessionId: string,
      account: { saved: string },
      siteId: string,
    ): Promise<{ status: string; protected?: boolean }>;
  };
  readonly versions: {
    list(sessionId: string): Promise<{
      status: string;
      versions?: { id: string; reason: string; createdAt: string }[];
    }>;
  };
  readonly publish: {
    publish(
      sessionId: string,
      destinationId: string,
      operationId: string,
      options: { replaceOtherSite: boolean; versionId?: string },
    ): Promise<{
      status: string;
      restored?: boolean;
      uploaded?: number;
      unchanged?: number;
      removed?: number;
    }>;
  };
};

let app: ElectronApplication | undefined;
let netlify: MockNetlify | undefined;
let dir: string;
let userData: string;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-netlify-"));
  userData = newUserDataDir();
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  await netlify?.close();
  netlify = undefined;
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  await rm(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/** A site with a contact form sending through Netlify Forms, saved at a new path. */
function siteWithNetlifyForms(): string {
  const path = join(dir, "Rosa's Bakery.wforge");
  const created = ProjectStore.create(path, { name: "Rosa's Bakery" });
  const site = createSite({
    name: "Rosa's Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  site.settings.address.url = "https://rosas-bakery.netlify.app";
  site.settings.forms.service = { kind: "netlify" };
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content.push({ type: "ContactForm", props: { id: "write", title: "Write to us" } });
  created.saveSite(site);
  created.close();
  return path;
}

/** Saves the mock's site `siteId` as destination "Netlify", signed in with its token. */
async function addNetlify(page: Page, mock: MockNetlify, siteId: string) {
  return page.evaluate(
    async ({ token, siteId: id }) => {
      const { project, netlify: calls } = (window as unknown as { webforge: Webforge }).webforge;
      const sessionId = (await project.getCurrent())?.sessionId ?? "";
      const signedIn = await calls.signInWithToken(token);
      if (signedIn.handle === undefined) throw new Error(`not signed in: ${signedIn.status}`);
      const saved = await calls.saveDestination(
        sessionId,
        { name: "Netlify", site: { id, name: "rosas-bakery" } },
        { handle: signedIn.handle },
      );
      if (saved.destination === undefined) throw new Error(`not saved: ${saved.status}`);
      return { sessionId, destinationId: saved.destination.id };
    },
    { token: mock.token, siteId },
  );
}

/**
 * Publishes the open site to destination `destinationId`, as it is or as saved version
 * `versionId` is: Publish's own call, which the dialog and Version History make.
 */
function publish(page: Page, sessionId: string, destinationId: string, versionId?: string) {
  return page.evaluate(
    ({ session, destination, version }) =>
      (window as unknown as { webforge: Webforge }).webforge.publish.publish(
        session,
        destination,
        crypto.randomUUID(),
        version === undefined
          ? { replaceOtherSite: false }
          : { replaceOtherSite: false, versionId: version },
      ),
    { session: sessionId, destination: destinationId, version: versionId },
  );
}

test("publishes to Netlify sending only what changed, with its forms named, and republishes by restoring a deploy it keeps (4.2)", async () => {
  test.skip(
    process.platform !== "win32" && process.platform !== "darwin",
    "the sign-in is kept in the OS keychain, Windows' and macOS's (ADR 0006 §5)",
  );
  netlify = await startMockNetlify();
  const siteId = await netlify.addSite("rosas-bakery");
  const path = siteWithNetlifyForms();
  app = await launchDesktopApp({
    userDataDir: userData,
    args: [path],
    env: { WEBFORGE_E2E_NETLIFY_API: netlify.apiBase },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("button", { name: "Publish…", exact: true })).toBeEnabled();
  const { sessionId, destinationId } = await addNetlify(page, netlify, siteId);

  // The first publish sends every file, and Netlify finds the contact form by its name.
  const first = await publish(page, sessionId, destinationId);
  const sentFirst = netlify.uploads();
  expect(first).toEqual({
    status: "published",
    url: netlify.addressOf("rosas-bakery"),
    check: "live",
    uploaded: sentFirst.length,
    unchanged: 0,
    removed: 0,
    versionSaved: true,
  });
  expect(sentFirst).toContain("index.html");
  expect(sentFirst).toContain("thank-you.html");
  const firstDeploy = await netlify.live(siteId);
  expect(netlify.file(siteId, "index.html")).toContain('data-netlify="true"');
  expect((await netlify.forms(siteId)).map(({ name }) => name)).toEqual(["Contact form"]);

  // A change to the home page alone, its description: only what it changed goes up again.
  await page
    .getByRole("region", { name: "Right panels" })
    .getByRole("tab", { name: "Site" })
    .click();
  await page
    .getByRole("list", { name: "Pages" })
    .getByRole("button", { name: "Actions for Home" })
    .click();
  await page.getByRole("menuitem", { name: "Page Settings…" }).click();
  const settings = page.getByRole("dialog", { name: "Settings for 'Home'" });
  await settings.getByRole("textbox", { name: "Description" }).fill("Fresh bread every morning");
  await settings.getByRole("button", { name: "Save" }).click();
  await expect(settings).toHaveCount(0);
  const second = await publish(page, sessionId, destinationId);
  expect(second).toMatchObject({ status: "published", check: "live" });
  const sentSecond = netlify.uploads().slice(sentFirst.length);
  expect(sentSecond).toContain("index.html");
  expect(sentSecond).not.toContain("thank-you.html");
  expect(sentSecond.length).toBeLessThan(sentFirst.length);
  expect(second).toMatchObject({ status: "published", check: "live", uploaded: sentSecond.length });
  expect(second.unchanged).toBeGreaterThan(0);
  const secondDeploy = await netlify.live(siteId);
  expect(secondDeploy).not.toBe(firstDeploy);
  expect(netlify.file(siteId, "index.html")).toContain("Fresh bread every morning");

  // Each publish kept its version. Republishing the first: Netlify still has its deploy, so it
  // goes live again as it was, nothing built or sent.
  const [firstVersion, secondVersion] = await page.evaluate(async (id) => {
    const { versions } = (window as unknown as { webforge: Webforge }).webforge;
    const listed = await versions.list(id);
    return (listed.versions ?? [])
      .filter(({ reason }) => reason === "on-publish")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(({ id: versionId }) => versionId);
  }, sessionId);
  if (firstVersion === undefined || secondVersion === undefined) {
    throw new Error("no version for each publish");
  }
  const republish = (versionId: string) => publish(page, sessionId, destinationId, versionId);
  const sentBefore = netlify.uploads().length;
  expect(await republish(firstVersion)).toMatchObject({ status: "published", restored: true });
  expect(await netlify.live(siteId)).toBe(firstDeploy);
  expect(netlify.uploads()).toHaveLength(sentBefore);
  expect(netlify.file(siteId, "index.html")).not.toContain("Fresh bread every morning");

  // Once Netlify no longer keeps a version's deploy, republishing it builds and sends it.
  netlify.dropDeploy(secondDeploy ?? "");
  const rebuilt = await republish(secondVersion);
  expect(rebuilt).toMatchObject({ status: "published" });
  expect(rebuilt).not.toHaveProperty("restored");
  const rebuiltDeploy = await netlify.live(siteId);
  expect([firstDeploy, secondDeploy]).not.toContain(rebuiltDeploy);
  expect(netlify.file(siteId, "index.html")).toContain("Fresh bread every morning");
});

test("says whether visitors reach the Netlify site or Netlify's login (4.4b's warning, #723)", async () => {
  test.skip(
    process.platform !== "win32" && process.platform !== "darwin",
    "the sign-in is kept in the OS keychain, Windows' and macOS's (ADR 0006 §5)",
  );
  netlify = await startMockNetlify();
  const siteId = await netlify.addSite("rosas-bakery");
  app = await launchDesktopApp({
    userDataDir: userData,
    args: [siteWithNetlifyForms()],
    env: { WEBFORGE_E2E_NETLIFY_API: netlify.apiBase },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("button", { name: "Publish…", exact: true })).toBeEnabled();
  const { sessionId, destinationId } = await addNetlify(page, netlify, siteId);
  const check = () =>
    page.evaluate(
      ({ session, destination, site }) =>
        (window as unknown as { webforge: Webforge }).webforge.netlify.checkAccess(
          session,
          { saved: destination },
          site,
        ),
      { session: sessionId, destination: destinationId, site: siteId },
    );

  expect(await check()).toEqual({ status: "checked", protected: false });
  netlify.protect(siteId);
  expect(await check()).toEqual({ status: "checked", protected: true });
});
