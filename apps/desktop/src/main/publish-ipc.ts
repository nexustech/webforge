import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import {
  DEFAULT_PORTS,
  type FileTransferDestination,
  type FileTransferSignIn,
  type FileTransferTrust,
  PRIVATE_KEY_MAX,
} from "@webforge/model";
import {
  describePrivateKey,
  ftpPublisher,
  PublishError,
  readSftpHostKey,
  sftpPublisher,
} from "@webforge/publish";
import type { IpcMain } from "electron";
import type {
  ConnectionResult,
  HostKeyResult,
  KeyFileResult,
  SignInRef,
} from "../shared/ipc/publish.js";
import { registerIpcHandler } from "./ipc.js";

/** How long Test connection, or reading a host key, may take before it counts as unreachable. */
const TIMEOUT_MS = 20_000;

/** How many chosen keys the main process holds at once; the oldest goes first. */
const KEYS_HELD = 16;

/**
 * The private keys the person chose this session, by a random handle (4.3, review): the renderer
 * gets only the handle, never the key's text. 4.4 moves a destination's key to the keychain from
 * here. Kept in memory only, and only the last {@link KEYS_HELD}.
 */
export type KeyFiles = {
  /** Holds `privateKey`, giving its handle. */
  hold(privateKey: string): string;
  /** The key held under `handle`, or undefined if none is (any more). */
  get(handle: string): string | undefined;
};

/** An empty {@link KeyFiles}. */
export function createKeyFiles(): KeyFiles {
  const keys = new Map<string, string>();
  return {
    hold(privateKey) {
      const handle = randomUUID();
      keys.set(handle, privateKey);
      // Maps keep their insertion order: the first is the oldest.
      for (const oldest of keys.keys()) {
        if (keys.size <= KEYS_HELD) break;
        keys.delete(oldest);
      }
      return handle;
    },
    get: (handle) => keys.get(handle),
  };
}

/**
 * How `signIn` signs in: the password, or the key its handle names, with its passphrase.
 * Undefined for a handle no key is held under.
 */
function signInOf(signIn: SignInRef, keys: KeyFiles): FileTransferSignIn | undefined {
  if ("password" in signIn) return { password: signIn.password };
  const privateKey = keys.get(signIn.keyHandle);
  if (privateKey === undefined) return undefined;
  return {
    privateKey,
    ...(signIn.passphrase === undefined ? {} : { passphrase: signIn.passphrase }),
  };
}

/** What the `publish` handlers are made with; fakes in tests. */
export type PublishParts = {
  /** The private key file the person chooses in the system's dialog; undefined if cancelled. */
  chooseKeyFile(): Promise<string | undefined>;
  /** How long a test may take; {@link TIMEOUT_MS} when left out. */
  readonly timeoutMs?: number;
};

/**
 * Test connection (F-PB-1, B5): signs in and opens the destination's folder, never uploading. An
 * SFTP destination whose host key isn't trusted yet doesn't connect at all: the person trusts the
 * key first (ADR 0006 §7). The password comes with each call and is kept nowhere; a key is named
 * by its handle in `keys`, and one no longer held is `bad-key`.
 */
export async function testConnection(
  destination: FileTransferDestination,
  ref: SignInRef,
  trust: FileTransferTrust,
  keys: KeyFiles,
  timeoutMs = TIMEOUT_MS,
): Promise<ConnectionResult> {
  const signIn = signInOf(ref, keys);
  if (signIn === undefined) return { ok: false, code: "bad-key" };
  const { host, user, folder } = destination;
  const port = destination.port ?? DEFAULT_PORTS[destination.protocol];
  if (destination.protocol === "sftp") {
    if (trust.hostKey === undefined) return { ok: false, code: "untrusted-host" };
    const options =
      "password" in signIn
        ? { password: signIn.password, timeoutMs }
        : {
            privateKey: signIn.privateKey,
            ...(signIn.passphrase === undefined ? {} : { passphrase: signIn.passphrase }),
            timeoutMs,
          };
    return sftpPublisher(options).test({
      host,
      port,
      user,
      folder,
      hostKey: trust.hostKey,
    });
  }
  // FTPS and FTP sign in with a password only.
  if (!("password" in signIn)) return { ok: false, code: "unauthorized" };
  return ftpPublisher({ password: signIn.password, timeoutMs }).test({
    protocol: destination.protocol,
    host,
    port,
    user,
    folder,
  });
}

/** The key an SFTP host presents, or why it couldn't be read. Never throws. */
export async function readHostKey(
  host: string,
  port: number = DEFAULT_PORTS.sftp,
  timeoutMs = TIMEOUT_MS,
): Promise<HostKeyResult> {
  try {
    return { status: "read", hostKey: await readSftpHostKey(host, port, timeoutMs) };
  } catch (error) {
    return { status: "failed", code: error instanceof PublishError ? error.code : "failed" };
  }
}

/**
 * The private key file at `path`, read (4.3): at most {@link PRIVATE_KEY_MAX} bytes, and only a
 * private key, held in `keys`. The form gets its name and handle, never its text. Never throws.
 */
export async function readKeyFile(path: string, keys: KeyFiles): Promise<KeyFileResult> {
  try {
    if ((await stat(path)).size > PRIVATE_KEY_MAX) return { status: "failed", reason: "too-large" };
    const privateKey = await readFile(path, "utf8");
    const kind = describePrivateKey(privateKey);
    if (kind === "not-a-key" || kind === "unsupported") return { status: "failed", reason: kind };
    return {
      status: "chosen",
      name: basename(path).slice(0, 255),
      encrypted: kind === "encrypted",
      handle: keys.hold(privateKey),
    };
  } catch {
    return { status: "failed", reason: "unreadable" };
  }
}

/** Registers the `publish` IPC calls (Phase 4): file-transfer destinations' tests (4.3). */
export function registerPublishHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  parts: PublishParts,
  keys: KeyFiles = createKeyFiles(),
): void {
  const timeoutMs = parts.timeoutMs ?? TIMEOUT_MS;
  registerIpcHandler(ipc, "publishTestConnection", isTrustedSender, (destination, signIn, trust) =>
    testConnection(destination, signIn, trust, keys, timeoutMs),
  );
  registerIpcHandler(ipc, "publishReadHostKey", isTrustedSender, (host, port) =>
    readHostKey(host, port, timeoutMs),
  );
  registerIpcHandler(ipc, "publishChooseKeyFile", isTrustedSender, async () => {
    const path = await parts.chooseKeyFile();
    return path === undefined ? { status: "cancelled" } : readKeyFile(path, keys);
  });
}
