import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FtpSrv } from "ftp-srv";

/**
 * A self-signed certificate for `127.0.0.1`, made with openssl when the tests load, for the
 * FTPS server and the client that trusts it; `undefined` where openssl isn't installed, and the
 * FTPS tests skip. Made fresh rather than kept in the repository, which keeps no keys (`*.pem`).
 */
export const TEST_TLS: { readonly key: string; readonly cert: string } | undefined = (() => {
  const dir = mkdtempSync(join(tmpdir(), "webforge-ftps-"));
  try {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "ec",
        "-pkeyopt",
        "ec_paramgen_curve:prime256v1",
        "-nodes",
        "-days",
        "1",
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=IP:127.0.0.1,DNS:localhost",
        "-keyout",
        join(dir, "key.pem"),
        "-out",
        join(dir, "cert.pem"),
      ],
      // Git for Windows' openssl would otherwise take "/CN=…" for a path.
      { stdio: "ignore", env: { ...process.env, MSYS_NO_PATHCONV: "1", MSYS2_ARG_CONV_EXCL: "*" } },
    );
    return {
      key: readFileSync(join(dir, "key.pem"), "utf8"),
      cert: readFileSync(join(dir, "cert.pem"), "utf8"),
    };
  } catch {
    return undefined;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
})();

/** ftp-srv logs through bunyan; the tests keep quiet. */
const quiet = {
  child: () => quiet,
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
};

/**
 * A local FTP server (FTPS too, explicit `AUTH TLS` with {@link TEST_TLS}) whose root is a
 * temporary folder with a `site` folder in it, for one user. Closed by `stop`.
 */
export async function startFtpServer(options: { user: string; password: string }) {
  const root = mkdtempSync(join(tmpdir(), "webforge-ftp-"));
  mkdirSync(join(root, "site"));
  const server = new FtpSrv({
    url: "ftp://127.0.0.1:0",
    pasv_url: "127.0.0.1",
    pasv_min: 40_000,
    pasv_max: 49_999,
    tls: TEST_TLS ?? false,
    greeting: "Webforge test server",
    log: quiet,
  });
  server.on("login", ({ username, password }, resolve, reject) => {
    if (username === options.user && password === options.password) {
      resolve({ root });
    } else {
      reject(new Error("Wrong user name or password"));
    }
  });
  await server.listen();
  const { port } = (server as unknown as { server: { address(): AddressInfo } }).server.address();
  return {
    port,
    /** The site's folder on disk, as the FTP user sees `/site`. */
    site: join(root, "site"),
    async stop() {
      await server.close();
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    },
  };
}
