import { rm } from "node:fs/promises";
import { type ElectronApplication, expect, test } from "@playwright/test";
import { launchDesktopApp, newUserDataDir } from "./launch.js";

// Publish passwords and tokens are encrypted with Electron's safeStorage, whose key the OS keeps
// (ADR 0006: Windows DPAPI, macOS Keychain), and the credential store keeps the encrypted bytes in
// the user data. This checks the OS half on the release platforms (0.3): what one run encrypts,
// the next run, a new process, decrypts. The store's own file handling is unit-tested.

let app: ElectronApplication | undefined;
let userData: string;

test.beforeEach(() => {
  userData = newUserDataDir();
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  await rm(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test("a secret encrypted by one run decrypts in the next (safeStorage, 0.3)", async () => {
  test.skip(
    process.platform !== "win32" && process.platform !== "darwin",
    "Windows and macOS are the release platforms",
  );
  // A made-up value: the test never touches a real credential.
  const secret = "test-only-ftp-password-ü";

  app = await launchDesktopApp({ userDataDir: userData, site: false });
  const sealed = await app.evaluate(({ safeStorage }, value) => {
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.encryptString(value).toString("base64");
  }, secret);
  await app.close();

  expect(sealed, "the OS can encrypt").not.toBeNull();
  expect(Buffer.from(sealed ?? "", "base64").toString("latin1")).not.toContain("test-only");

  app = await launchDesktopApp({ userDataDir: userData, site: false });
  const opened = await app.evaluate(
    ({ safeStorage }, base64) => safeStorage.decryptString(Buffer.from(base64, "base64")),
    sealed ?? "",
  );

  expect(opened).toBe(secret);
});
