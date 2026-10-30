import type { AddressInfo } from "node:net";
import { type Attributes, Server, utils } from "ssh2";

/** SFTP status codes the server answers with (draft-ietf-secsh-filexfer-02). */
const NO_SUCH_FILE = 2;
const OP_UNSUPPORTED = 8;

/** A folder's attributes: what `stat` of the site's folder answers. */
const FOLDER: Attributes = { mode: 0o40755, uid: 0, gid: 0, size: 0, atime: 0, mtime: 0 };

/**
 * A local SFTP server for the packaged app's check (4.3): one user signing in with `password`,
 * under a host key made for the run, holding only the folder `/site`. Test connection signs in
 * and looks the folder up; nothing else is served. Closed by `stop`.
 */
export async function startSftpServer(options: { user: string; password: string }) {
  const hostKey = utils.generateKeyPairSync("ecdsa", { bits: 256 });
  const server = new Server({ hostKeys: [hostKey.private] }, (client) => {
    client
      .on("authentication", (context) => {
        const ok =
          context.method === "password" &&
          context.username === options.user &&
          context.password === options.password;
        if (ok) context.accept();
        else context.reject(["password"]);
      })
      .on("ready", () => {
        client.on("session", (accept) => {
          accept().on("sftp", (acceptSftp) => {
            const sftp = acceptSftp();
            const stat = (reqId: number, path: string) => {
              if (path === "/site" || path === "/site/") sftp.attrs(reqId, FOLDER);
              else sftp.status(reqId, NO_SUCH_FILE);
            };
            sftp
              .on("STAT", stat)
              .on("LSTAT", stat)
              .on("REALPATH", (reqId) =>
                sftp.name(reqId, [{ filename: "/", longname: "/", attrs: FOLDER }]),
              )
              .on("OPEN", (reqId) => sftp.status(reqId, OP_UNSUPPORTED));
          });
        });
      })
      .on("error", () => undefined);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    port: (server.address() as AddressInfo).port,
    async stop() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
