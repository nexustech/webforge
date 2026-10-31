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
import type { ConnectionResult, HostKeyResult, KeyFileResult } from "../shared/ipc/publish.js";
import { registerIpcHandler } from "./ipc.js";

/** How long Test connection, or reading a host key, may take before it counts as unreachable. */
const TIMEOUT_MS = 20_000;

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
 * key first (ADR 0006 §7). The secrets come with each call and are kept nowhere.
 */
export async function testConnection(
  destination: FileTransferDestination,
  signIn: FileTransferSignIn,
  trust: FileTransferTrust,
  timeoutMs = TIMEOUT_MS,
): Promise<ConnectionResult> {
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
 * private key, whose text goes back to the form to test with. Never throws.
 */
export async function readKeyFile(path: string): Promise<KeyFileResult> {
  try {
    if ((await stat(path)).size > PRIVATE_KEY_MAX) return { status: "failed", reason: "too-large" };
    const privateKey = await readFile(path, "utf8");
    const kind = describePrivateKey(privateKey);
    if (kind === "not-a-key") return { status: "failed", reason: "not-a-key" };
    return {
      status: "chosen",
      name: basename(path).slice(0, 255),
      privateKey,
      encrypted: kind === "encrypted",
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
): void {
  const timeoutMs = parts.timeoutMs ?? TIMEOUT_MS;
  registerIpcHandler(ipc, "publishTestConnection", isTrustedSender, (destination, signIn, trust) =>
    testConnection(destination, signIn, trust, timeoutMs),
  );
  registerIpcHandler(ipc, "publishReadHostKey", isTrustedSender, (host, port) =>
    readHostKey(host, port, timeoutMs),
  );
  registerIpcHandler(ipc, "publishChooseKeyFile", isTrustedSender, async () => {
    const path = await parts.chooseKeyFile();
    return path === undefined ? { status: "cancelled" } : readKeyFile(path);
  });
}
