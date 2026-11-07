import {
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  renameSync,
  type Stats,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, normalize, sep } from "node:path";
import ssh2, { type Attributes, type SFTPWrapper } from "ssh2";

// ssh2 is CommonJS: its default export holds `Server` and `utils` under Node's ESM loader.
const { Server, utils } = ssh2;
const { OPEN_MODE, STATUS_CODE } = utils.sftp;

const attributesOf = (stats: Stats): Attributes => ({
  mode: stats.mode,
  uid: 0,
  gid: 0,
  size: stats.size,
  atime: Math.floor(stats.atimeMs / 1000),
  mtime: Math.floor(stats.mtimeMs / 1000),
});

/**
 * Serves SFTP requests on `sftp` from the folder `root`, just what Test Connection and a publish
 * use (4.3, 4.5), as `@webforge/publish`'s test server does: like a plain SFTP v3 server, a rename
 * won't replace a file, and no extensions are offered. Nothing above `root` is reached.
 */
function serve(sftp: SFTPWrapper, root: string): void {
  const local = (path: string) => {
    const relative = normalize(path).replace(/^[/\\]+/, "");
    if (relative.split(sep).includes("..")) throw new Error("Outside the server's folder");
    return join(root, relative);
  };
  const files = new Map<number, number>();
  let next = 0;
  const fdOf = (handle: Buffer) => files.get(handle.readUInt32BE(0));
  const run = (reqId: number, action: () => void) => {
    try {
      action();
      sftp.status(reqId, STATUS_CODE.OK);
    } catch (error) {
      const missing = (error as { code?: string }).code === "ENOENT";
      sftp.status(reqId, missing ? STATUS_CODE.NO_SUCH_FILE : STATUS_CODE.FAILURE);
    }
  };
  const stat = (reqId: number, path: string) => {
    try {
      const at = local(path);
      if (existsSync(at)) sftp.attrs(reqId, attributesOf(statSync(at)));
      else sftp.status(reqId, STATUS_CODE.NO_SUCH_FILE);
    } catch {
      sftp.status(reqId, STATUS_CODE.FAILURE);
    }
  };

  sftp
    .on("OPEN", (reqId, filename, flags) => {
      try {
        const path = local(filename);
        if (!(flags & OPEN_MODE.WRITE) && !existsSync(path)) {
          sftp.status(reqId, STATUS_CODE.NO_SUCH_FILE);
          return;
        }
        const handle = Buffer.alloc(4);
        handle.writeUInt32BE(next);
        files.set(next++, openSync(path, flags & OPEN_MODE.WRITE ? "w" : "r"));
        sftp.handle(reqId, handle);
      } catch {
        sftp.status(reqId, STATUS_CODE.FAILURE);
      }
    })
    .on("READ", (reqId, handle, offset, length) => {
      const fd = fdOf(handle);
      if (fd === undefined) return sftp.status(reqId, STATUS_CODE.FAILURE);
      const buffer = Buffer.alloc(length);
      const read = readSync(fd, buffer, 0, length, offset);
      if (read === 0) sftp.status(reqId, STATUS_CODE.EOF);
      else sftp.data(reqId, buffer.subarray(0, read));
    })
    .on("WRITE", (reqId, handle, offset, data) => {
      const fd = fdOf(handle);
      run(reqId, () => {
        if (fd === undefined) throw new Error("No such handle");
        writeSync(fd, data, 0, data.length, offset);
      });
    })
    .on("FSTAT", (reqId, handle) => {
      const fd = fdOf(handle);
      if (fd === undefined) sftp.status(reqId, STATUS_CODE.FAILURE);
      else sftp.attrs(reqId, attributesOf(fstatSync(fd)));
    })
    .on("CLOSE", (reqId, handle) => {
      const id = handle.readUInt32BE(0);
      const fd = files.get(id);
      files.delete(id);
      run(reqId, () => {
        if (fd !== undefined) closeSync(fd);
      });
    })
    .on("STAT", stat)
    .on("LSTAT", stat)
    .on("MKDIR", (reqId, path) => run(reqId, () => mkdirSync(local(path))))
    .on("RENAME", (reqId, from, to) =>
      run(reqId, () => {
        if (existsSync(local(to))) throw new Error("A file is already there");
        renameSync(local(from), local(to));
      }),
    )
    .on("REMOVE", (reqId, path) => run(reqId, () => unlinkSync(local(path))))
    .on("REALPATH", (reqId) =>
      sftp.name(reqId, [{ filename: "/", longname: "/", attrs: {} as Attributes }]),
    )
    .on("EXTENDED", (reqId) => sftp.status(reqId, STATUS_CODE.OP_UNSUPPORTED));
}

/**
 * A local SFTP server for the E2E tests (4.3, 4.5): one user signing in with `password`, under a
 * host key made for the run, its root a temporary folder holding the folder `/site`, which a
 * publish fills. Listens on `127.0.0.1` only (#748). Closed, and its folder deleted, by `stop`.
 */
export async function startSftpServer(options: { user: string; password: string }) {
  const hostKey = utils.generateKeyPairSync("ecdsa", { bits: 256 });
  const root = mkdtempSync(join(tmpdir(), "webforge-e2e-sftp-"));
  mkdirSync(join(root, "site"));
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
          accept().on("sftp", (acceptSftp) => serve(acceptSftp(), root));
        });
      })
      .on("error", () => undefined);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    port: (server.address() as AddressInfo).port,
    /** The site's folder on disk, as the SFTP user sees `/site`. */
    site: join(root, "site"),
    async stop() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    },
  };
}
