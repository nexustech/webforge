import { createHash } from "node:crypto";
import { posix } from "node:path";
import { Client, type SFTPWrapper } from "ssh2";
import { fileTransferError } from "./file-transfer-errors.js";
import {
  type BuildOutput,
  PublishError,
  type PublishErrorCode,
  type Publisher,
  type TestResult,
} from "./publisher.js";
import { publishToFolder, type RemoteFolder, uploadPathFor } from "./remote-folder.js";

/** An SFTP destination, as the `.wforge` file stores it: no password. */
export type SftpDestination = {
  readonly host: string;
  /** 22 when not set. */
  readonly port?: number;
  readonly user: string;
  /** The site's folder on the host: `/home/rosie/public_html`, or relative to the login's home. */
  readonly folder: string;
  /**
   * The server's host key the person trusted, as OpenSSH shows it (`SHA256:…`), from
   * {@link readSftpHostKey} the first time. Any other key is refused before the password is sent.
   */
  readonly hostKey: string;
  /** The address the site is visited at, for the published event. */
  readonly url?: string;
};

export type SftpOptions = {
  readonly password: string;
  /** How long connecting and signing in may take. */
  readonly timeoutMs?: number;
};

/** A host key's fingerprint as OpenSSH shows it: `SHA256:` and the unpadded base64 digest. */
export function hostKeyFingerprint(key: Buffer): string {
  return `SHA256:${createHash("sha256").update(key).digest("base64").replace(/=+$/, "")}`;
}

/** SFTP status codes (draft-ietf-secsh-filexfer-02) the publisher tells apart. */
const NO_SUCH_FILE = 2;
const PERMISSION_DENIED = 3;

const statusOf = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error ? error.code : undefined;

/** The kind of an SSH or SFTP failure; `undefined` for a socket one. */
export function sftpErrorCode(error: unknown): PublishErrorCode | undefined {
  const level =
    typeof error === "object" && error !== null && "level" in error ? error.level : undefined;
  if (level === "client-authentication") return "unauthorized";
  if (level === "client-timeout") return "network";
  const status = statusOf(error);
  if (status === NO_SUCH_FILE) return "not-found";
  if (status === PERMISSION_DENIED) return "rejected";
  return undefined;
}

/** A connection and its SFTP session; `end` closes both. */
type Session = { readonly sftp: SFTPWrapper; end(): void };

/**
 * Connects and signs in, refusing any host key but the trusted one before the password goes.
 * `onClient` gets the connection at once, so a cancel can end it while it connects.
 */
function connect(
  dest: SftpDestination,
  options: SftpOptions,
  onClient: (client: Client) => void = () => undefined,
): Promise<Session> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    onClient(client);
    let untrusted = false;
    client
      .on("ready", () => {
        client.sftp((error, sftp) => {
          if (error) {
            client.end();
            reject(error);
          } else {
            resolve({ sftp, end: () => client.end() });
          }
        });
      })
      .on("error", (error) => {
        reject(
          untrusted
            ? new PublishError("untrusted-host", "The host's key is not the trusted one")
            : error,
        );
      })
      .on("close", () => reject(new PublishError("network", "The connection closed")))
      .connect({
        host: dest.host,
        port: dest.port ?? 22,
        username: dest.user,
        password: options.password,
        readyTimeout: options.timeoutMs ?? 30_000,
        hostVerifier: (key: Buffer) => {
          untrusted = hostKeyFingerprint(key) !== dest.hostKey;
          return !untrusted;
        },
      });
  });
}

/** `operation` on the SFTP session, as a promise. */
function call<T = void>(
  operation: (done: (error: Error | null | undefined, value?: T) => void) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    operation((error, value) => (error ? reject(error) : resolve(value as T)));
  });
}

/** The destination's folder over `sftp`. */
function remoteFolder(sftp: SFTPWrapper, root: string): RemoteFolder {
  const at = (path: string) => posix.join(root, path);
  const exists = (path: string) =>
    call<unknown>((done) => sftp.stat(path, done)).then(
      () => true,
      (error: unknown) => {
        if (statusOf(error) === NO_SUCH_FILE) return false;
        throw error;
      },
    );
  /** Folders known to be there, so each is looked up once a publish. */
  const made = new Set<string>([".", "/"]);
  /** Makes `folder` and the folders above it that are missing. */
  const makeFolders = async (folder: string): Promise<void> => {
    if (made.has(folder)) return;
    if (!(await exists(folder))) {
      await makeFolders(posix.dirname(folder));
      await call((done) => sftp.mkdir(folder, done));
    }
    made.add(folder);
  };
  const unlink = (path: string) =>
    call((done) => sftp.unlink(path, done)).catch((error: unknown) => {
      if (statusOf(error) !== NO_SUCH_FILE) throw error;
    });
  return {
    async read(path) {
      try {
        return new Uint8Array(await call<Buffer>((done) => sftp.readFile(at(path), done)));
      } catch (error) {
        if (statusOf(error) === NO_SUCH_FILE) return undefined;
        throw error;
      }
    },
    async write(path, data) {
      const target = at(path);
      const upload = at(uploadPathFor(path));
      await makeFolders(posix.dirname(target));
      await call((done) => sftp.writeFile(upload, Buffer.from(data), done));
      try {
        // OpenSSH's posix-rename replaces the file in one step.
        await call((done) => sftp.ext_openssh_rename(upload, target, done));
      } catch {
        // A server without it: plain SFTP rename won't replace a file, so remove it first.
        await unlink(target);
        await call((done) => sftp.rename(upload, target, done));
      }
    },
    remove: (path) => unlink(at(path)),
  };
}

/**
 * The host key `host` presents, as OpenSSH shows it (`SHA256:…`), for the person to compare and
 * trust before the first publish. It doesn't sign in: the connection ends at the key.
 */
export function readSftpHostKey(host: string, port = 22, timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let fingerprint: string | undefined;
    client
      .on("error", (error) => {
        if (fingerprint !== undefined) resolve(fingerprint);
        else reject(fileTransferError(error, undefined, sftpErrorCode));
      })
      .connect({
        host,
        port,
        // ssh2 wants one, though the handshake ends at the key, before anyone signs in.
        username: "webforge",
        readyTimeout: timeoutMs,
        hostVerifier: (key: Buffer) => {
          fingerprint = hostKeyFingerprint(key);
          return false;
        },
      });
  });
}

/**
 * Publishes to a host over SFTP (08): only what changed, by the manifest it keeps there, assets
 * first and `index.html` last. The password is given here, never through the destination, and
 * only to the host whose key was trusted. Cancelling ends the connection: a file being sent goes
 * to its hidden upload file, so the live one stays whole.
 */
export function sftpPublisher(options: SftpOptions): Publisher<SftpDestination> {
  return {
    async test(dest, signal): Promise<TestResult> {
      let session: Session | undefined;
      try {
        session = await connect(dest, options);
        const { sftp } = session;
        await call<unknown>((done) => sftp.stat(dest.folder, done));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: fileTransferError(error, signal, sftpErrorCode).code };
      } finally {
        session?.end();
      }
    },

    async *publish(build: BuildOutput, dest, signal) {
      let client: Client | undefined;
      const close = () => client?.end();
      signal.addEventListener("abort", close, { once: true });
      try {
        const { sftp } = await connect(dest, options, (connecting) => {
          client = connecting;
        });
        yield* publishToFolder(remoteFolder(sftp, dest.folder), build, signal, dest.url ?? "");
      } catch (error) {
        throw fileTransferError(error, signal, sftpErrorCode);
      } finally {
        signal.removeEventListener("abort", close);
        close();
      }
    },
  };
}
