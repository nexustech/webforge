import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { WebforgeError } from "@webforge/errors";
import { z } from "zod";

// Publish credentials (Netlify tokens, FTP passwords): never in the `.wforge` file, which may be
// shared (research 08, architecture §9). Each secret is encrypted with Electron's safeStorage,
// whose key the OS keeps (Windows DPAPI, macOS Keychain), and the encrypted bytes are kept in
// one file in the app's user-data folder, keyed by project and publish profile.

/** The part of Electron's `safeStorage` the store uses; injectable for tests. */
export type SecretCipher = {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
};

/** Why a secret could not be saved. */
type CredentialErrorCode = "encryption-unavailable" | "read-failed" | "write-failed";

/** Saving a secret failed; nothing was stored in plain text. */
export class CredentialError extends WebforgeError<CredentialErrorCode> {
  override readonly name = "CredentialError";

  constructor(code: CredentialErrorCode, message: string, options?: ErrorOptions) {
    super(code, "errors.credentials", message, options);
  }
}

/** Secrets by key, encrypted. */
export type CredentialStore = {
  /** The secret, or `null` if there is none or it can't be read or decrypted. */
  get(key: string): Promise<string | null>;
  /** Encrypts and saves `secret`; throws {@link CredentialError} rather than store it unencrypted. */
  set(key: string, secret: string): Promise<void>;
  delete(key: string): Promise<void>;
};

/** The key of a publish profile's secret in a project. */
export function credentialKey(projectId: string, profileId: string): string {
  return `${encodeURIComponent(projectId)}/${encodeURIComponent(profileId)}`;
}

const fileSchema = z.object({
  version: z.literal(1),
  /** Key → base64 of the safeStorage-encrypted secret. */
  secrets: z.record(z.string(), z.string()),
});

type Secrets = Record<string, string>;

/** A credential store kept in `file` (e.g. `<userData>/credentials.json`). */
export function createCredentialStore(file: string, cipher: SecretCipher): CredentialStore {
  // One read-modify-write at a time, so two saves can't lose each other's changes.
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  }

  /**
   * The stored secrets. A missing file is empty, and so is a damaged one (the user signs in
   * again). Any other read error throws: saving over a file we couldn't read (locked by another
   * program, no permission) would lose every other profile's secrets.
   */
  async function load(): Promise<Secrets> {
    let text: string;
    try {
      text = await readFile(file, "utf8");
    } catch (error) {
      // No file, or a parent that is a file (Linux reports ENOTDIR where Windows says ENOENT).
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") return {};
      throw new CredentialError("read-failed", "The credentials file could not be read", {
        cause: error,
      });
    }
    try {
      return fileSchema.parse(JSON.parse(text)).secrets;
    } catch {
      return {};
    }
  }

  async function save(secrets: Secrets): Promise<void> {
    const temp = `${file}.tmp`;
    try {
      await mkdir(dirname(file), { recursive: true });
      // Owner-only where the OS supports it; the content is encrypted either way.
      await writeFile(temp, `${JSON.stringify({ version: 1, secrets }, null, 2)}\n`, {
        mode: 0o600,
      });
      await rename(temp, file);
    } catch (error) {
      throw new CredentialError("write-failed", "The credentials file could not be saved", {
        cause: error,
      });
    }
  }

  return {
    get: (key) =>
      serial(async () => {
        const secrets = await load().catch(() => ({}) as Secrets);
        if (!Object.hasOwn(secrets, key)) return null;
        try {
          return cipher.decryptString(Buffer.from(secrets[key] ?? "", "base64"));
        } catch {
          // Encrypted by another OS user or machine, or the OS key changed.
          return null;
        }
      }),
    set: (key, secret) =>
      serial(async () => {
        if (!cipher.isEncryptionAvailable()) {
          throw new CredentialError(
            "encryption-unavailable",
            "The operating system can't encrypt the secret, so it was not saved",
          );
        }
        const secrets = await load();
        secrets[key] = cipher.encryptString(secret).toString("base64");
        await save(secrets);
      }),
    delete: (key) =>
      serial(async () => {
        const secrets = await load();
        if (!Object.hasOwn(secrets, key)) return;
        delete secrets[key];
        await save(secrets);
      }),
  };
}
