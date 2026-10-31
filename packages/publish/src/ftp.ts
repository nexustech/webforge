import { posix } from "node:path";
import { Readable, Writable } from "node:stream";
import type { ConnectionOptions } from "node:tls";
import { Client, FTPError } from "basic-ftp";
import { fileTransferError } from "./file-transfer-errors.js";
import type { PublishedSite } from "./manifest.js";
import {
  type BuildOutput,
  PublishError,
  type PublishErrorCode,
  type Publisher,
  type TestResult,
} from "./publisher.js";
import { publishToFolder, type RemoteFolder, uploadPathFor } from "./remote-folder.js";

/**
 * An FTP or FTPS destination, as the app puts it together from the site's settings (no password)
 * and the site publishing.
 */
export type FtpDestination = {
  /**
   * `ftps`: explicit TLS (`AUTH TLS`) on the usual port, tried first (B5). `ftp`: plain FTP, which
   * sends the password and the files unencrypted; the app warns before it is used.
   */
  readonly protocol: "ftps" | "ftp";
  readonly host: string;
  /** 21 when not set. */
  readonly port?: number;
  readonly user: string;
  /** The site's folder on the host, from the FTP root: `/public_html`, `/www/shop`. */
  readonly folder: string;
  /** The address the site is visited at, for the published event. */
  readonly url?: string;
  /** The site publishing, which the folder's manifest records (A8, 4.3). */
  readonly site: PublishedSite;
  /** The person agreed to replace another site published to the folder, for this publish (4.5). */
  readonly replaceOtherSite?: boolean;
};

export type FtpOptions = {
  readonly password: string;
  /** TLS options for FTPS, such as a test server's certificate authority (`ca`). */
  readonly tls?: ConnectionOptions;
  /** How long a request may take before the connection counts as lost. */
  readonly timeoutMs?: number;
};

/** FTP reply codes that mean the sign-in was refused, or the folder or file is missing. */
const NOT_LOGGED_IN = 530;
const UNAVAILABLE = 550;

/** The kind of an FTP failure, from its reply code; `undefined` for a socket or TLS one. */
export function ftpErrorCode(error: unknown): PublishErrorCode | undefined {
  if (error instanceof FTPError) {
    if (error.code === NOT_LOGGED_IN) return "unauthorized";
    if (error.code === UNAVAILABLE) return "rejected";
    // 421 and 4xx data-connection failures: the host closed or couldn't open the connection.
    return error.code >= 400 && error.code < 500 ? "network" : "rejected";
  }
  if (error instanceof Error && /^Timeout/.test(error.message)) return "network";
  return undefined;
}

/**
 * The replies servers give for a file that isn't there: 550 mostly, 450 or 551 on some. A read
 * takes them as "none", which for the manifest only means a full upload that removes nothing.
 */
const MISSING = new Set([450, UNAVAILABLE, 551]);
const isMissing = (error: unknown) => error instanceof FTPError && MISSING.has(error.code);

/**
 * Signs in to the destination, as `basic-ftp`'s `access` does, but telling a host that refuses
 * `AUTH TLS` apart: that is `no-encryption`, before the password is sent (B5, 4.3). The caller
 * closes the client, also when this throws.
 */
async function connect(
  dest: Omit<FtpDestination, "site">,
  options: FtpOptions,
  onClient: (client: Client) => void = () => undefined,
): Promise<Client> {
  const client = new Client(options.timeoutMs ?? 30_000);
  onClient(client);
  await client.connect(dest.host, dest.port ?? 21);
  if (dest.protocol === "ftps") {
    try {
      // The host for later data connections too (basic-ftp #166), as `access` sets it.
      // biome-ignore lint/correctness/useHookAtTopLevel: basic-ftp's method, not a React hook.
      await client.useTLS({ ...options.tls, host: options.tls?.host ?? dest.host });
    } catch (error) {
      // A refusal (500, 502, 504, 534…) means no FTPS; a 4xx reply (421) is the host being busy.
      if (error instanceof FTPError && error.code >= 500) {
        throw new PublishError("no-encryption", "The host doesn't offer encrypted FTP", {
          cause: error,
        });
      }
      throw error;
    }
  }
  // UTF-8 before signing in, for a user name or password that isn't ASCII; some hosts refuse it.
  await client.sendIgnoringError("OPTS UTF8 ON");
  await client.login(dest.user, options.password);
  // biome-ignore lint/correctness/useHookAtTopLevel: basic-ftp's method, not a React hook.
  await client.useDefaultSettings();
  return client;
}

/** The destination's folder over `client`, by absolute paths: `ensureDir` moves the cwd. */
function remoteFolder(client: Client, root: string): RemoteFolder {
  const at = (path: string) => posix.join(root, path);
  /** Folders known to be there: `ensureDir` walks the path a folder at a time, every call. */
  const made = new Set<string>();
  return {
    async read(path) {
      const chunks: Buffer[] = [];
      const sink = new Writable({
        write(chunk: Buffer, _encoding, done) {
          chunks.push(chunk);
          done();
        },
      });
      try {
        await client.downloadTo(sink, at(path));
      } catch (error) {
        if (isMissing(error)) return undefined;
        throw error;
      }
      return new Uint8Array(Buffer.concat(chunks));
    },
    async write(path, data) {
      const target = at(path);
      const upload = at(uploadPathFor(path));
      const folder = posix.dirname(target);
      if (!made.has(folder)) {
        await client.ensureDir(folder);
        made.add(folder);
      }
      await client.uploadFrom(Readable.from([Buffer.from(data)]), upload);
      try {
        await client.rename(upload, target);
      } catch (error) {
        // Some servers won't rename over a file: replace it in two steps.
        if (!(error instanceof FTPError)) throw error;
        await client.remove(target, true);
        await client.rename(upload, target);
      }
    },
    async remove(path) {
      await client.remove(at(path), true);
    },
  };
}

/**
 * Publishes to a host over FTPS or FTP (08, B5): only what changed, by the manifest it keeps
 * there, assets first and `index.html` last. The password is given here, never through the
 * destination. Cancelling closes the connection: a file being sent goes to its hidden upload
 * file, so the live one stays whole.
 */
export function ftpPublisher(options: FtpOptions): Publisher<FtpDestination> {
  return {
    async test(dest, signal): Promise<TestResult> {
      let client: Client | undefined;
      // Closed however far it got: connecting, encrypting or signing in.
      const close = () => client?.close();
      try {
        const signedIn = await connect(dest, options, (connecting) => {
          client = connecting;
        });
        await signedIn.cd(dest.folder);
        return { ok: true };
      } catch (error) {
        const failure = fileTransferError(error, signal, ftpErrorCode);
        return { ok: false, code: failure.code === "rejected" ? "not-found" : failure.code };
      } finally {
        close();
      }
    },

    async *publish(build: BuildOutput, dest, signal) {
      let client: Client | undefined;
      const close = () => client?.close();
      signal.addEventListener("abort", close, { once: true });
      try {
        const signedIn = await connect(dest, options, (connecting) => {
          client = connecting;
        });
        yield* publishToFolder(remoteFolder(signedIn, dest.folder), build, signal, {
          site: dest.site,
          url: dest.url ?? "",
          ...(dest.replaceOtherSite === undefined
            ? {}
            : { replaceOtherSite: dest.replaceOtherSite }),
        });
      } catch (error) {
        throw fileTransferError(error, signal, ftpErrorCode);
      } finally {
        signal.removeEventListener("abort", close);
        close();
      }
    },
  };
}
