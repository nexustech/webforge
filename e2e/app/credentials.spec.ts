import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { launchDesktopApp, newUserDataDir, type WebforgeApp } from "./launch.js";

// Publish passwords and tokens are encrypted with Electron's safeStorage, whose key the OS keeps
// (ADR 0006: Windows DPAPI, macOS Keychain), and the credential store keeps the encrypted bytes in
// the user data. This checks the OS half on the release platforms (0.3): what one run encrypts,
// the next run, a new process, decrypts, with safeStorage's asynchronous calls, which the store
// uses (#843). That includes what Electron 44 and earlier saved with the synchronous ones, which
// Electron 46 removes. The store's own file handling is unit-tested.

let userData: string;
/** The apps each test has launched, closed in its teardown. */
const launched: WebforgeApp[] = [];

/** Webforge with the test's user data, closed in the teardown. */
async function launch(): Promise<WebforgeApp> {
  const app = await launchDesktopApp({ userDataDir: userData, site: false });
  launched.push(app);
  return app;
}

/**
 * How long the teardown waits for each app's process to end before removing the user data. Once
 * the app had closed, Electron's process held its `DIPS` database for up to half a minute more
 * while it ended, on a computer busy with other tests (#1112).
 */
const GONE_TIMEOUT_MS = 30_000;

/**
 * Whether Windows' safeStorage key is on disk, in the profile's `Local State` (DPAPI-encrypted, as
 * `os_crypt.encrypted_key`). Electron makes the key when the profile first starts and writes it
 * there about 10 s later, or when the app quits; a run that ends sooner can leave the next one
 * without it, and that one makes a new key (#678: a first run that lived 0.6 s on CI).
 */
function keyWritten(userDataDir: string): boolean {
  try {
    const state = JSON.parse(readFileSync(join(userDataDir, "Local State"), "utf8")) as {
      os_crypt?: { encrypted_key?: unknown };
    };
    return typeof state.os_crypt?.encrypted_key === "string";
  } catch {
    // Not written yet.
    return false;
  }
}

test.beforeEach(() => {
  userData = newUserDataDir();
});

test.afterEach(async () => {
  // Time for that wait, on top of the test's own.
  test.info().setTimeout(test.info().timeout + GONE_TIMEOUT_MS);
  const apps = launched.splice(0);
  for (const app of apps) await app.close();
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.all(apps.map((app) => app.gone)),
    new Promise((resolve) => {
      timer = setTimeout(resolve, GONE_TIMEOUT_MS);
    }),
  ]);
  clearTimeout(timer);
  await rm(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

test("a secret encrypted by one run decrypts in the next, saved as before or now (safeStorage, 0.3, #843)", async () => {
  test.skip(
    process.platform !== "win32" && process.platform !== "darwin",
    "Windows and macOS are the release platforms",
  );
  // A made-up value: the test never touches a real credential.
  const secret = "test-only-ftp-password-ü";

  const app = await launch();
  const sealed = await app.evaluate(async ({ safeStorage }, value) => {
    if (!(await safeStorage.isAsyncEncryptionAvailable())) return null;
    return {
      now: (await safeStorage.encryptStringAsync(value)).toString("base64"),
      // As Electron 44 and earlier saved it: the synchronous call, still there until Electron 46.
      before: safeStorage.encryptString(value).toString("base64"),
    };
  }, secret);
  // The key on disk first, as it is long before a person saves a password (#678); macOS keeps its
  // key in the Keychain instead.
  if (process.platform === "win32") {
    await expect
      .poll(() => keyWritten(userData), {
        message: "the safeStorage key is in Local State",
        timeout: 30_000,
      })
      .toBe(true);
  }
  await app.close();

  if (sealed === null) throw new Error("the OS can't encrypt");
  for (const base64 of [sealed.now, sealed.before]) {
    expect(Buffer.from(base64, "base64").toString("latin1")).not.toContain("test-only");
  }

  const reopened = await launch();
  const opened = await reopened.evaluate(
    async ({ safeStorage }, saved) =>
      Promise.all(
        [saved.now, saved.before].map(
          async (base64) =>
            (await safeStorage.decryptStringAsync(Buffer.from(base64, "base64"))).result,
        ),
      ),
    sealed,
  );

  expect(opened).toEqual([secret, secret]);
});
