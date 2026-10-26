import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FtpSrv } from "ftp-srv";

const FIXTURES = join(import.meta.dirname, "../test/fixtures");

/**
 * The test-only certificate for `127.0.0.1` the FTPS tests trust (self-signed, made with
 * openssl for these tests; its key protects nothing).
 */
export const TEST_CERTIFICATE = readFileSync(join(FIXTURES, "ftps-test-cert.pem"), "utf8");

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
 * A local FTP server (FTPS too: explicit `AUTH TLS` with the test certificate) whose root is a
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
    tls: {
      key: readFileSync(join(FIXTURES, "ftps-test-key.pem"), "utf8"),
      cert: TEST_CERTIFICATE,
    },
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
