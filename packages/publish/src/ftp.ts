import { posix } from "node:path";
import { Readable, Writable } from "node:stream";
import type { ConnectionOptions } from "node:tls";
import { Client, FTPError } from "basic-ftp";
import { fileTransferError } from "./file-transfer-errors.js";
import type { BuildOutput, PublishErrorCode, Publisher, TestResult } from "./publisher.js";
import { publishToFolder, type RemoteFolder, uploadPathFor } from "./remote-folder.js";

/** An FTP or FTPS destination, as the `.wforge` file stores it: no password. */
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

/** Signs in to the destination; the caller closes the client. */
async function connect(dest: FtpDestination, options: FtpOptions): Promise<Client> {
  const client = new Client(options.timeoutMs ?? 30_000);
  await client.access({
    host: dest.host,
    port: dest.port ?? 21,
    user: dest.user,
    password: options.password,
    secure: dest.protocol === "ftps",
    ...(options.tls === undefined ? {} : { secureOptions: options.tls }),
  });
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
      try {
        client = await connect(dest, options);
        await client.cd(dest.folder);
        return { ok: true };
      } catch (error) {
        const failure = fileTransferError(error, signal, ftpErrorCode);
        return { ok: false, code: failure.code === "rejected" ? "not-found" : failure.code };
      } finally {
        client?.close();
      }
    },

    async *publish(build: BuildOutput, dest, signal) {
      let client: Client | undefined;
      const close = () => client?.close();
      signal.addEventListener("abort", close, { once: true });
      try {
        client = await connect(dest, options);
        yield* publishToFolder(remoteFolder(client, dest.folder), build, signal, dest.url ?? "");
      } catch (error) {
        throw fileTransferError(error, signal, ftpErrorCode);
      } finally {
        signal.removeEventListener("abort", close);
        close();
      }
    },
  };
}
