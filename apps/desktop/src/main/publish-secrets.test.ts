import { join } from "node:path";
import type { PublishDestination } from "@webforge/model";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { describe, expect, it } from "vitest";
import {
  type CredentialStore,
  createCredentialStore,
  publishCredentialKey,
  type SecretCipher,
} from "./credential-store.js";
import { createPublishSecrets, destinationFingerprint } from "./publish-secrets.js";

// A stand-in for safeStorage: reversible, and visibly not plain text.
const cipher: SecretCipher = {
  isEncryptionAvailable: () => true,
  encryptString: (text) => Buffer.from(`enc:${[...text].reverse().join("")}`),
  decryptString: (data) => [...data.toString().slice(4)].reverse().join(""),
};

const PROJECT = "7d2b0c1e-1111-4222-8333-444455556666";
const HOST_KEY = `SHA256:${"a".repeat(43)}`;

const sftp: PublishDestination = {
  id: "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10",
  name: "My host",
  kind: "file-transfer",
  settings: {
    protocol: "sftp",
    host: "ftp.example.com",
    user: "rosa",
    folder: "/www",
    signIn: "password",
  },
};

/** `sftp` with `change` to its settings. */
const edited = (change: Record<string, unknown>) =>
  ({ ...sftp, settings: { ...sftp.settings, ...change } }) as PublishDestination;

describe("createPublishSecrets (4.4a, security review S2)", () => {
  const tempDir = tempDirFactory();
  const secretsIn = () => {
    const store = createCredentialStore(join(tempDir(), "credentials.json"), cipher);
    return { store, secrets: createPublishSecrets(store) };
  };

  it("gives a destination's sign-in and trust back, for it as it was saved", async () => {
    const { secrets } = secretsIn();
    expect(await secrets.state(PROJECT, sftp)).toEqual({ signIn: "none", trust: {} });

    await secrets.save(PROJECT, sftp, { password: "hunter2" }, { hostKey: HOST_KEY });

    expect(await secrets.state(PROJECT, sftp)).toEqual({
      signIn: "saved",
      trust: { hostKey: HOST_KEY },
    });
    expect(await secrets.signInFor(PROJECT, sftp)).toEqual({
      signIn: { password: "hunter2" },
      trust: { hostKey: HOST_KEY },
    });
    // The same place written another way: a host name's case, the protocol's usual port.
    for (const same of [
      edited({ host: "FTP.Example.com" }),
      edited({ port: 22 }),
      edited({ folder: "/x" }),
    ]) {
      expect(await secrets.signInFor(PROJECT, same)).toBeDefined();
    }
  });

  it.each<[string, PublishDestination]>([
    ["another host", edited({ host: "evil.example" })],
    ["another port", edited({ port: 2222 })],
    ["another user", edited({ user: "mallory" })],
    [
      "another protocol",
      {
        ...sftp,
        settings: { protocol: "ftps", host: "ftp.example.com", user: "rosa", folder: "/www" },
      },
    ],
  ])("gives nothing to %s, and says it changed (S2)", async (_name, destination) => {
    const { secrets } = secretsIn();
    await secrets.save(PROJECT, sftp, { password: "hunter2" }, { hostKey: HOST_KEY });

    expect(await secrets.signInFor(PROJECT, destination)).toBeUndefined();
    expect(await secrets.state(PROJECT, destination)).toEqual({ signIn: "changed", trust: {} });
  });

  it("gives nothing for a host key other than the one trusted when it was typed", async () => {
    const { secrets } = secretsIn();
    await secrets.save(PROJECT, sftp, { password: "hunter2" }, { hostKey: HOST_KEY });

    const otherKey = { hostKey: `SHA256:${"b".repeat(43)}` };
    expect(await secrets.signInFor(PROJECT, sftp, otherKey)).toBeUndefined();
    expect(await secrets.signInFor(PROJECT, sftp, { hostKey: HOST_KEY })).toBeDefined();
  });

  it("keeps each project's and destination's apart, and forgets one removed", async () => {
    const { secrets } = secretsIn();
    await secrets.save(PROJECT, sftp, { password: "one" }, {});
    const other = { ...sftp, id: "0b9a8f6e-3c2d-4e1f-8a7b-6c5d4e3f2a10" };
    await secrets.save(PROJECT, other, { password: "two" }, {});

    expect(await secrets.signInFor("another-project", sftp)).toBeUndefined();
    await secrets.remove(PROJECT, sftp.id);
    expect(await secrets.signInFor(PROJECT, sftp)).toBeUndefined();
    expect((await secrets.signInFor(PROJECT, other))?.signIn).toEqual({ password: "two" });
  });

  it("reads a record it can't use as none saved", async () => {
    const { store, secrets } = secretsIn();
    const key = publishCredentialKey(PROJECT, sftp.id);
    for (const text of ["not json", '{"version":2}', JSON.stringify({ version: 1, signIn: {} })]) {
      await (store as CredentialStore).set(key, text);
      expect(await secrets.state(PROJECT, sftp), text).toEqual({ signIn: "none", trust: {} });
      expect(await secrets.signInFor(PROJECT, sftp)).toBeUndefined();
    }
  });
});

describe("destinationFingerprint", () => {
  it("names where a secret goes, never the host itself", () => {
    const fingerprint = destinationFingerprint(sftp, { hostKey: HOST_KEY });
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint).not.toContain("example");
    // A host key counts for SFTP only.
    const ftps = edited({ protocol: "ftps", signIn: undefined });
    expect(destinationFingerprint(ftps, { hostKey: HOST_KEY })).toBe(
      destinationFingerprint(ftps, {}),
    );
  });
});
