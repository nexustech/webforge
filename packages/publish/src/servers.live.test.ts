import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ftpPublisher } from "./ftp.js";
import type { BuildOutput, PublishEvent, Publisher } from "./publisher.js";
import { readSftpHostKey, type SftpDestination, sftpPublisher } from "./sftp.js";

// Publishing to real FTP and SFTP servers, in containers (4.3): pure-ftpd over FTPS, with the
// certificate it made trusted, and OpenSSH's SFTP (atmoz/sftp) with a password and with a private
// key and its passphrase. CI's "File transfer servers" job starts them and sets the variables;
// without them the tests skip. To run them here (Docker):
//
//   docker run -d --name webforge-sftp -p 2222:22 \
//     -v "$PWD/id.pub:/home/baker/.ssh/keys/id.pub:ro" atmoz/sftp:alpine baker:test-only-password:::site
//   docker run -d --name webforge-ftps -p 2121:21 -p 30000-30009:30000-30009 \
//     -e PUBLICHOST=localhost -e FTP_USER_NAME=baker -e FTP_USER_PASS=test-only-password \
//     -e FTP_USER_HOME=/home/baker -e "ADDED_FLAGS=--tls=2" -e TLS_CN=localhost \
//     -e TLS_ORG=Webforge -e TLS_C=GB stilliard/pure-ftpd
//   docker exec webforge-ftps sh -c "mkdir -p /home/baker/site && chown -R ftpuser:ftpgroup /home/baker"
//   docker cp webforge-ftps:/etc/ssl/private/pure-ftpd.pem ftps.pem
//   WEBFORGE_SFTP_PORT=2222 WEBFORGE_SFTP_KEY=id WEBFORGE_FTPS_PORT=2121 WEBFORGE_FTPS_CA=ftps.pem \
//     pnpm vitest run packages/publish/src/servers.live.test.ts
//
// The passwords and the key are the tests' own, made for these containers.

const env = process.env;
const PASSWORD = "test-only-password";
const PASSPHRASE = "test-only-passphrase";

const bytes = (text: string) => new TextEncoder().encode(text);
const build = (files: Record<string, string>): BuildOutput => ({
  files: new Map(Object.entries(files).map(([path, text]) => [path, bytes(text)])),
});

/** Publishes `files` to `dest`, giving the event it ends with. */
async function publish<D>(publisher: Publisher<D>, dest: D, files: Record<string, string>) {
  let last: PublishEvent | undefined;
  for await (const event of publisher.publish(build(files), dest, AbortSignal.timeout(60_000))) {
    last = event;
  }
  return last;
}

const site = {
  "index.html": "<p>Home</p>",
  "about.html": "<p>About</p>",
  "assets/css/site.css": "body {}",
};

/** A first publish, then one that sends only the changed page and removes the dropped one. */
async function publishTwice<D>(publisher: Publisher<D>, dest: D) {
  expect(await publisher.test(dest)).toEqual({ ok: true });
  const first = await publish(publisher, dest, site);
  const { "about.html": _dropped, ...rest } = site;
  const second = await publish(publisher, dest, { ...rest, "index.html": "<p>Home, again</p>" });
  return { first, second };
}

const sftpPort = Number(env.WEBFORGE_SFTP_PORT ?? 0);

describe.skipIf(sftpPort === 0)(
  "publishing over SFTP to OpenSSH (4.3)",
  { timeout: 120_000 },
  () => {
    const dest = async (): Promise<SftpDestination> => ({
      host: "127.0.0.1",
      port: sftpPort,
      user: "baker",
      folder: "site",
      hostKey: await readSftpHostKey("127.0.0.1", sftpPort),
      site: { projectId: "webforge-ci", destinationId: "sftp" },
    });

    it("publishes with a password: only what changed the second time", async () => {
      const { first, second } = await publishTwice(
        sftpPublisher({ password: PASSWORD }),
        await dest(),
      );

      // Earlier runs may have left the site there: the first publish sends whatever differs.
      expect(first).toMatchObject({ type: "published" });
      expect(second).toMatchObject({ type: "published", uploaded: 1, removed: 1 });
    });

    it.skipIf(env.WEBFORGE_SFTP_KEY === undefined)(
      "publishes with a private key and its passphrase, and refuses a wrong passphrase",
      async () => {
        const privateKey = readFileSync(env.WEBFORGE_SFTP_KEY ?? "", "utf8");
        const keyed = sftpPublisher({ privateKey, passphrase: PASSPHRASE });

        await publishTwice(keyed, await dest());
        expect(await sftpPublisher({ privateKey, passphrase: "wrong" }).test(await dest())).toEqual(
          {
            ok: false,
            code: "bad-key",
          },
        );
      },
    );

    it("refuses the host once its key isn't the trusted one", async () => {
      const other = { ...(await dest()), hostKey: `SHA256:${"A".repeat(43)}` };

      expect(await sftpPublisher({ password: PASSWORD }).test(other)).toEqual({
        ok: false,
        code: "untrusted-host",
      });
    });
  },
);

const ftpsPort = Number(env.WEBFORGE_FTPS_PORT ?? 0);

describe.skipIf(ftpsPort === 0)(
  "publishing over FTPS to pure-ftpd (4.3)",
  { timeout: 120_000 },
  () => {
    const dest = {
      protocol: "ftps",
      host: "localhost",
      port: ftpsPort,
      user: "baker",
      folder: "/site",
      site: { projectId: "webforge-ci", destinationId: "ftps" },
    } as const;
    // The server's certificate, from the file pure-ftpd keeps it in with its key.
    const ca =
      env.WEBFORGE_FTPS_CA === undefined
        ? undefined
        : /-----BEGIN CERTIFICATE-----[^-]+-----END CERTIFICATE-----/.exec(
            readFileSync(env.WEBFORGE_FTPS_CA, "utf8"),
          )?.[0];

    it("publishes, trusting the server's certificate: only what changed the second time", async () => {
      const { first, second } = await publishTwice(
        ftpPublisher({ password: PASSWORD, tls: { ca: ca ?? "" } }),
        dest,
      );

      expect(first).toMatchObject({ type: "published" });
      expect(second).toMatchObject({ type: "published", uploaded: 1, removed: 1 });
    });

    it("refuses a certificate the computer doesn't trust, and a wrong password", async () => {
      expect(await ftpPublisher({ password: PASSWORD }).test(dest)).toEqual({
        ok: false,
        code: "untrusted-host",
      });
      expect(await ftpPublisher({ password: "wrong", tls: { ca: ca ?? "" } }).test(dest)).toEqual({
        ok: false,
        code: "unauthorized",
      });
    });
  },
);
