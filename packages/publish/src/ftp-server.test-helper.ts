import { execFileSync } from "node:child_process";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { type AddressInfo, createServer, type Server, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import { TLSSocket } from "node:tls";

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

/** One client's session: who signed in, the TLS state and the passive data connection waiting. */
type Session = {
  control: Socket;
  /** The working folder, as the client sees it (`/`, `/site/assets`). */
  cwd: string;
  user: string | undefined;
  signedIn: boolean;
  /** `PROT P`: the data connection is encrypted too. */
  privateData: boolean;
  renaming: string | undefined;
  data: { server: Server; socket: Promise<Socket> } | undefined;
};

/**
 * Serves the FTP commands `basic-ftp` uses for a publish (RFC 959, with RFC 2428's EPSV and RFC
 * 4217's AUTH TLS) from the folder `root`: just enough for the tests, never for real use. Like
 * most servers, a rename replaces the file at the new name.
 */
function serve(session: Session, root: string, options: { user: string; password: string }) {
  const local = (path: string) => join(root, posix.resolve(session.cwd, path));
  const reply = (line: string) => session.control.write(`${line}\r\n`);

  /** Opens a passive data listener, encrypted under `PROT P`, and gives its port. */
  const openData = async (): Promise<number> => {
    session.data?.server.close();
    const server = createServer();
    const socket = new Promise<Socket>((resolve) => {
      server.once("connection", (raw) => {
        server.close();
        resolve(
          session.privateData && TEST_TLS !== undefined
            ? new TLSSocket(raw, { isServer: true, ...TEST_TLS })
            : raw,
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    session.data = { server, socket };
    return (server.address() as AddressInfo).port;
  };

  /** The data connection the client opened for this transfer. */
  const takeData = async (): Promise<Socket | undefined> => {
    const waiting = session.data;
    session.data = undefined;
    return waiting?.socket;
  };

  const commands: Record<string, (argument: string) => void | Promise<void>> = {
    AUTH: (argument) => {
      if (argument.toUpperCase() !== "TLS" || TEST_TLS === undefined)
        return void reply("504 Not here");
      reply("234 Starting TLS");
      // From here the plain socket carries TLS: only the TLS socket reads it.
      session.control.removeAllListeners("data");
      session.control = new TLSSocket(session.control, { isServer: true, ...TEST_TLS });
      listen();
    },
    PBSZ: () => void reply("200 PBSZ=0"),
    PROT: (argument) => {
      session.privateData = argument.toUpperCase() === "P";
      reply("200 Protection set");
    },
    USER: (argument) => {
      session.user = argument;
      reply("331 Password, please");
    },
    PASS: (argument) => {
      session.signedIn = session.user === options.user && argument === options.password;
      reply(session.signedIn ? "230 Signed in" : "530 Wrong user name or password");
    },
    FEAT: () => void reply("211-Features:\r\n EPSV\r\n UTF8\r\n211 End"),
    OPTS: () => void reply("200 OK"),
    TYPE: () => void reply("200 Type set"),
    STRU: () => void reply("200 Structure set"),
    SYST: () => void reply("215 UNIX Type: L8"),
    PWD: () => void reply(`257 "${session.cwd}"`),
    NOOP: () => void reply("200 OK"),
    CWD: (path) => {
      const at = local(path);
      if (!existsSync(at) || !statSync(at).isDirectory()) return void reply("550 No such folder");
      session.cwd = posix.resolve(session.cwd, path);
      reply("250 OK");
    },
    MKD: (path) => {
      try {
        mkdirSync(local(path));
        reply(`257 "${path}" made`);
      } catch {
        reply("550 Can't make it");
      }
    },
    EPSV: async () => {
      reply(`229 Entering Extended Passive Mode (|||${await openData()}|)`);
    },
    PASV: async () => {
      const port = await openData();
      reply(`227 Entering Passive Mode (127,0,0,1,${port >> 8},${port & 255})`);
    },
    STOR: async (path) => {
      const socket = await takeData();
      if (socket === undefined) return void reply("425 No data connection");
      reply("150 Sending");
      const file = createWriteStream(local(path));
      socket.pipe(file);
      file.on("finish", () => reply("226 Stored"));
      file.on("error", () => {
        socket.destroy();
        reply("553 Can't store it");
      });
      socket.on("error", () => file.destroy());
    },
    RETR: async (path) => {
      const at = local(path);
      const socket = await takeData();
      if (socket === undefined) return void reply("425 No data connection");
      if (!existsSync(at) || !statSync(at).isFile()) {
        // The reply first, then a clean close: a reset could reach the client before the 550.
        reply("550 No such file");
        socket.end();
        return;
      }
      reply("150 Sending");
      createReadStream(at)
        .pipe(socket)
        .on("finish", () => reply("226 Sent"));
    },
    RNFR: (path) => {
      session.renaming = existsSync(local(path)) ? path : undefined;
      reply(session.renaming === undefined ? "550 No such file" : "350 Ready");
    },
    RNTO: (path) => {
      const from = session.renaming;
      session.renaming = undefined;
      if (from === undefined) return void reply("503 RNFR first");
      try {
        renameSync(local(from), local(path));
        reply("250 Renamed");
      } catch {
        reply("550 Can't rename");
      }
    },
    DELE: (path) => {
      try {
        unlinkSync(local(path));
        reply("250 Removed");
      } catch {
        reply("550 No such file");
      }
    },
    QUIT: () => {
      reply("221 Bye");
      session.control.end();
    },
  };
  const beforeSignIn = new Set(["AUTH", "PBSZ", "PROT", "USER", "PASS", "FEAT", "OPTS", "QUIT"]);

  // Commands run one at a time, in order, as the client sends them.
  let queue = Promise.resolve();
  let buffered = "";
  function listen() {
    session.control.on("data", (chunk: Buffer) => {
      buffered += chunk.toString("utf8");
      let end = buffered.indexOf("\r\n");
      while (end !== -1) {
        const line = buffered.slice(0, end);
        buffered = buffered.slice(end + 2);
        const space = line.indexOf(" ");
        const name = (space === -1 ? line : line.slice(0, space)).toUpperCase();
        const argument = space === -1 ? "" : line.slice(space + 1);
        queue = queue.then(async () => {
          const command = commands[name];
          if (command === undefined) reply("502 Not here");
          else if (!session.signedIn && !beforeSignIn.has(name)) reply("530 Sign in first");
          else await command(argument);
        });
        end = buffered.indexOf("\r\n");
      }
    });
    session.control.on("error", () => undefined);
  }
  listen();
}

/**
 * A local FTP server (FTPS too, explicit `AUTH TLS` with {@link TEST_TLS}) whose root is a
 * temporary folder with a `site` folder in it, for one user. Closed by `stop`.
 */
export async function startFtpServer(options: { user: string; password: string }) {
  const root = mkdtempSync(join(tmpdir(), "webforge-ftp-"));
  mkdirSync(join(root, "site"));
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    const session: Session = {
      control: socket,
      cwd: "/",
      user: undefined,
      signedIn: false,
      privateData: false,
      renaming: undefined,
      data: undefined,
    };
    socket.write("220 Webforge test server\r\n");
    serve(session, root, options);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    port: (server.address() as AddressInfo).port,
    /** The site's folder on disk, as the FTP user sees `/site`. */
    site: join(root, "site"),
    async stop() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    },
  };
}
