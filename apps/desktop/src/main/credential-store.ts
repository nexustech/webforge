import { WebforgeError } from "@webforge/errors";
import { z } from "zod";
import { createJsonStore } from "./json-store.js";

// Publish credentials (Netlify tokens, FTP passwords): never in the `.wforge` file, which may be
// shared (research 08, architecture §9). Each secret is encrypted with Electron's safeStorage,
// whose key the OS keeps (Windows DPAPI, macOS Keychain), and the encrypted bytes are kept in
// one file in the app's user-data folder, keyed by what the secret is for (`publish/…`, `mcp/…`).

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

/**
 * The key of a publish destination's secret in a project (#666):
 * `publish/<projectId>/<destinationId>`. Namespaced, so the AI apps' keys
 * ({@link mcpCredentialKey}) can never meet a destination's.
 */
export function publishCredentialKey(projectId: string, destinationId: string): string {
  return `publish/${encodeURIComponent(projectId)}/${encodeURIComponent(destinationId)}`;
}

/** The key of an AI app's secret (F-AI-1, #666): `mcp/<appId>`. */
export function mcpCredentialKey(appId: string): string {
  return `mcp/${encodeURIComponent(appId)}`;
}

const fileSchema = z.object({
  version: z.literal(1),
  /** Key → base64 of the safeStorage-encrypted secret. */
  secrets: z.record(z.string(), z.string()),
});

type CredentialsFile = z.infer<typeof fileSchema>;

/**
 * A credential store kept in `file` (e.g. `<userData>/credentials.json`), through
 * {@link createJsonStore}: one read-modify-write at a time, so two saves can't lose each other's
 * changes. A file that won't parse is moved aside before a save, never written over, so a damaged
 * file costs no one their other secrets (#666). One that can't be opened now (locked by another
 * program, no permission) fails the save instead, for the same reason.
 */
export function createCredentialStore(file: string, cipher: SecretCipher): CredentialStore {
  const store = createJsonStore<CredentialsFile>(file, fileSchema, {
    empty: { version: 1, secrets: {} },
    onDamaged: "move-aside",
    // Owner-only where the OS supports it; the content is encrypted either way.
    mode: 0o600,
  });

  /** Applies `change` to the secrets, as a {@link CredentialError} when the file fails. */
  async function update(change: (secrets: Record<string, string>) => boolean): Promise<void> {
    let read = false;
    try {
      await store.update((current) => {
        read = true;
        const secrets = { ...current.secrets };
        return change(secrets) ? { version: 1, secrets } : undefined;
      });
    } catch (error) {
      throw read
        ? new CredentialError("write-failed", "The credentials file could not be saved", {
            cause: error,
          })
        : new CredentialError("read-failed", "The credentials file could not be read", {
            cause: error,
          });
    }
  }

  return {
    async get(key) {
      const secrets = await store.read().then(
        (current) => current.secrets,
        () => ({}) as Record<string, string>,
      );
      if (!Object.hasOwn(secrets, key)) return null;
      try {
        return cipher.decryptString(Buffer.from(secrets[key] ?? "", "base64"));
      } catch {
        // Encrypted by another OS user or machine, or the OS key changed.
        return null;
      }
    },
    async set(key, secret) {
      if (!cipher.isEncryptionAvailable()) {
        throw new CredentialError(
          "encryption-unavailable",
          "The operating system can't encrypt the secret, so it was not saved",
        );
      }
      const encrypted = cipher.encryptString(secret).toString("base64");
      await update((secrets) => {
        secrets[key] = encrypted;
        return true;
      });
    },
    delete: (key) =>
      update((secrets) => {
        if (!Object.hasOwn(secrets, key)) return false;
        delete secrets[key];
        return true;
      }),
  };
}
