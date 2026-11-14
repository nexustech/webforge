import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { utils } from "ssh2";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BuildOutput, PublishEvent } from "./publisher.js";
import { describePublisherContract } from "./publisher-contract.test-helper.js";
import {
  describePrivateKey,
  readPrivateKey,
  readSftpHostKey,
  type SftpDestination,
  sftpPublisher,
} from "./sftp.js";
import { readableKeyPair, startSftpServer } from "./sftp-server.test-helper.js";

const bytes = (text: string) => new TextEncoder().encode(text);
const build = (files: Record<string, string>): BuildOutput => ({
  files: new Map(Object.entries(files).map(([path, content]) => [path, bytes(content)])),
});

let server: Awaited<ReturnType<typeof startSftpServer>>;
beforeAll(async () => {
  server = await startSftpServer({ user: "baker", password: "test-only-password" });
});
afterAll(async () => {
  await server?.stop();
});

const destination = (): SftpDestination => ({
  host: "127.0.0.1",
  port: server.port,
  user: "baker",
  folder: "/site",
  hostKey: server.hostKey,
  url: "https://bakery.example/",
  site: { projectId: "rosas-bakery", destinationId: "live" },
});
const options = { password: "test-only-password", timeoutMs: 10_000 };

async function _publish(files: Record<string, string>, dest = destination()) {
  const events: PublishEvent[] = [];
  for await (const event of sftpPublisher(options).publish(
    build(files),
    dest,
    AbortSignal.timeout(30_000),
  )) {
    events.push(event);
  }
  return events;
}

/** Runs a publish to its end, giving the error it stopped with. */
async function failure(publishing: AsyncIterable<PublishEvent>) {
  try {
    for await (const _event of publishing) {
      // To the end.
    }
  } catch (error) {
    return error;
  }
  return undefined;
}

const _onHost = (path: string) => readFileSync(join(server.site, path), "utf8");

const site = {
  "index.html": "<p>Home</p>",
  "about.html": "<p>About</p>",
  "assets/css/site.css": "body {}",
};

describePublisherContract("sftpPublisher", () => ({
  publisher: (password) => sftpPublisher({ ...options, password }),
  destination,
  siteFolder: () => server.site,
  password: "test-only-password",
}));

// Each test talks to a real SSH server over the network stack, several publishes in some: more
// than a unit test's time, on a loaded CI runner especially.
describe("sftpPublisher (0.3)", { timeout: 30_000 }, () => {
  it("shows the host key to trust, without signing in", async () => {
    await expect(readSftpHostKey("127.0.0.1", server.port)).resolves.toBe(server.hostKey);
  });

  it("refuses a host whose key isn't the trusted one, before the password is sent", async () => {
    const impostor = {
      ...destination(),
      hostKey: "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    };

    expect(await sftpPublisher(options).test(impostor)).toEqual({
      ok: false,
      code: "untrusted-host",
    });
    expect(
      await failure(
        sftpPublisher(options).publish(build(site), impostor, AbortSignal.timeout(30_000)),
      ),
    ).toMatchObject({
      code: "untrusted-host",
    });
  });
});

describe("signing in to SFTP with a private key (4.3)", { timeout: 30_000 }, () => {
  // A key the tests make, with a passphrase, as a host's control panel would have the person make.
  const key = readableKeyPair({ passphrase: "test-only-passphrase" });
  const other = readableKeyPair();
  let keyed: Awaited<ReturnType<typeof startSftpServer>>;
  beforeAll(async () => {
    keyed = await startSftpServer({
      user: "baker",
      password: "test-only-password",
      publicKey: key.public,
    });
  });
  afterAll(async () => {
    await keyed?.stop();
  });
  const dest = (): SftpDestination => ({
    ...destination(),
    port: keyed.port,
    hostKey: keyed.hostKey,
  });
  const signIn = { privateKey: key.private, passphrase: "test-only-passphrase", timeoutMs: 10_000 };

  it("tests and publishes with the key and its passphrase", async () => {
    expect(await sftpPublisher(signIn).test(dest())).toEqual({ ok: true });
    const events: PublishEvent[] = [];
    for await (const event of sftpPublisher(signIn).publish(
      build({ "index.html": "<p>Keyed</p>" }),
      dest(),
      AbortSignal.timeout(30_000),
    )) {
      events.push(event);
    }
    expect(events.at(-1)).toMatchObject({ type: "published" });
    expect(readFileSync(join(keyed.site, "index.html"), "utf8")).toBe("<p>Keyed</p>");
  });

  it("tells a key it can't open from one the host refuses", async () => {
    // Without its passphrase, or with a wrong one, or not a key: nothing is sent to the host.
    for (const passphrase of [undefined, "wrong"]) {
      expect(
        await sftpPublisher({
          privateKey: key.private,
          ...(passphrase === undefined ? {} : { passphrase }),
          timeoutMs: 10_000,
        }).test(dest()),
      ).toEqual({ ok: false, code: "bad-key" });
    }
    expect(readPrivateKey("not a key")).toEqual({ ok: false, code: "bad-key" });
    expect(readPrivateKey(key.public)).toEqual({ ok: false, code: "bad-key" });
    expect(readPrivateKey(key.private, "test-only-passphrase")).toEqual({ ok: true });
    expect(describePrivateKey(key.public)).toBe("not-a-key");
    expect(describePrivateKey("not a key")).toBe("not-a-key");
    // A key the host doesn't have for this user.
    expect(
      await sftpPublisher({ privateKey: other.private, timeoutMs: 10_000 }).test(dest()),
    ).toEqual({
      ok: false,
      code: "unauthorized",
    });
  });

  it("never puts the key or its passphrase in an error", async () => {
    const caught = await failure(
      sftpPublisher({
        privateKey: key.private,
        passphrase: "wrong-passphrase",
        timeoutMs: 10_000,
      }).publish(build(site), dest(), AbortSignal.timeout(30_000)),
    );

    expect(caught).toMatchObject({ code: "bad-key" });
    expect(String((caught as Error).message)).not.toContain("wrong-passphrase");
    expect(String((caught as Error).message)).not.toContain("PRIVATE KEY");
  });
});

describe("what a key file holds, by its format's own marker (4.3, review)", () => {
  /** An RSA or EC key in PEM, as OpenSSL writes it, encrypted when given a passphrase. */
  const locking = (passphrase?: string) =>
    passphrase === undefined ? {} : { cipher: "aes-256-cbc", passphrase };
  const pem = (type: "rsa" | "ec", format: "pkcs1" | "sec1" | "pkcs8", passphrase?: string) =>
    type === "rsa"
      ? generateKeyPairSync("rsa", {
          modulusLength: 2048,
          publicKeyEncoding: { type: "spki", format: "pem" },
          privateKeyEncoding: {
            type: format === "pkcs8" ? "pkcs8" : "pkcs1",
            format: "pem",
            ...locking(passphrase),
          },
        }).privateKey
      : generateKeyPairSync("ec", {
          namedCurve: "prime256v1",
          publicKeyEncoding: { type: "spki", format: "pem" },
          privateKeyEncoding: { type: "sec1", format: "pem", ...locking(passphrase) },
        }).privateKey;

  it("reads an OpenSSH key's cipher, encrypted or not", () => {
    const locked = utils.generateKeyPairSync("ed25519", {
      passphrase: "test-only-passphrase",
      cipher: "aes256-ctr",
      rounds: 1,
    });
    expect(describePrivateKey(locked.private)).toBe("encrypted");
    expect(describePrivateKey(utils.generateKeyPairSync("ed25519").private)).toBe("key");
  });

  it("reads a PEM key's Proc-Type header, encrypted or not", () => {
    expect(describePrivateKey(pem("rsa", "pkcs1", "test-only-passphrase"))).toBe("encrypted");
    expect(describePrivateKey(pem("rsa", "pkcs1"))).toBe("key");
    expect(describePrivateKey(pem("ec", "sec1", "test-only-passphrase"))).toBe("encrypted");
    expect(describePrivateKey(pem("ec", "sec1"))).toBe("key");
  });

  it("reads a PuTTY key's Encryption line", () => {
    const putty = "PuTTY-User-Key-File-3: ssh-ed25519\nEncryption: aes256-cbc\nComment: rosa\n";
    expect(describePrivateKey(putty)).toBe("encrypted");
  });

  it("says a PKCS#8 key, which SFTP sign-in can't read, is in a format it can't use", () => {
    expect(describePrivateKey(pem("rsa", "pkcs8"))).toBe("unsupported");
    expect(describePrivateKey(pem("rsa", "pkcs8", "test-only-passphrase"))).toBe("unsupported");
  });
});

describe("the tests' key pairs (#588, #901)", () => {
  const passphrase = "test-only-passphrase";
  const good = readableKeyPair({ passphrase });

  /** The pair `readableKeyPair` gives when the first one made is `first`, and how many it made. */
  const made = (first: { private: string; public: string }) => {
    let calls = 0;
    const keys = readableKeyPair({
      passphrase,
      generate: () => {
        calls += 1;
        return calls === 1 ? first : good;
      },
    });
    return { keys, calls };
  };

  it("makes another when ssh2 can't read the public half it made", () => {
    const { keys, calls } = made({ ...good, public: "ssh-ed25519 AAAA" });
    expect(keys.private).toBe(good.private);
    expect(calls).toBe(2);
  });

  it("makes another when ssh2 can't read the private half with its passphrase", () => {
    const { keys, calls } = made({
      ...good,
      private: readableKeyPair({ passphrase: "other" }).private,
    });
    expect(keys.private).toBe(good.private);
    expect(calls).toBe(2);
  });

  it("makes a pair ssh2 reads, locked with the passphrase or not locked", () => {
    expect(readPrivateKey(good.private, passphrase)).toEqual({ ok: true });
    expect(readPrivateKey(good.private)).toEqual({ ok: false, code: "bad-key" });
    expect(readPrivateKey(readableKeyPair().private)).toEqual({ ok: true });
  });

  it("gives up after a few tries, with ssh2's reason", () => {
    const unlocked = readableKeyPair();
    const unreadable = () => ({ ...unlocked, public: "ssh-ed25519 AAAA" });
    expect(() => readableKeyPair({ generate: unreadable })).toThrow(/Malformed OpenSSH public key/);
  });
});
