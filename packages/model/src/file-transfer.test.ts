import { describe, expect, it } from "vitest";
import {
  fileTransferDestinationSchema,
  fileTransferSignInSchema,
  fileTransferTrustSchema,
  hostKeySchema,
  PRIVATE_KEY_MAX,
} from "./file-transfer.js";

const ftps = {
  protocol: "ftps",
  host: "ftp.rosasbakery.co.uk",
  user: "rosa",
  folder: "/public_html",
} as const;

const sftp = {
  protocol: "sftp",
  host: "sftp.rosasbakery.co.uk",
  port: 2222,
  user: "rosa",
  folder: "/home/rosa/public_html",
  signIn: "key",
  url: "https://www.rosasbakery.co.uk",
} as const;

const HOST_KEY = "SHA256:nThbg6kXUpJWGl7E1IGOCspRomTxdCARLviKw6E5SY8";

const valid = (value: unknown) => fileTransferDestinationSchema.safeParse(value).success;

describe("a file-transfer destination's settings (4.3)", () => {
  it("takes FTPS, plain FTP and SFTP", () => {
    expect(valid(ftps)).toBe(true);
    expect(valid({ ...ftps, protocol: "ftp" })).toBe(true);
    expect(valid(sftp)).toBe(true);
  });

  it("never holds a password or a key, nor what this computer trusts (S2)", () => {
    expect(valid({ ...ftps, password: "test-only-password" })).toBe(false);
    expect(valid({ ...sftp, privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----" })).toBe(false);
    // An edited copy of the site can't bring its own host key, or skip plain FTP's warning.
    expect(valid({ ...sftp, hostKey: HOST_KEY })).toBe(false);
    expect(valid({ ...ftps, protocol: "ftp", plainFtpWarned: true })).toBe(false);
  });

  it("keeps each protocol's own settings to it", () => {
    expect(valid({ ...ftps, signIn: "key" })).toBe(false);
    expect(valid({ ...ftps, protocol: "http" })).toBe(false);
  });

  it("takes a host's name or address, not a web address or a path", () => {
    expect(valid({ ...ftps, host: "192.0.2.10" })).toBe(true);
    expect(valid({ ...ftps, host: "2001:db8::1" })).toBe(true);
    expect(valid({ ...ftps, host: "ftp://ftp.rosasbakery.co.uk" })).toBe(false);
    expect(valid({ ...ftps, host: "rosasbakery.co.uk/public_html" })).toBe(false);
    expect(valid({ ...ftps, host: "" })).toBe(false);
  });

  it("takes a port in range, a folder without control characters and an https address", () => {
    expect(valid({ ...ftps, port: 0 })).toBe(false);
    expect(valid({ ...ftps, port: 65_536 })).toBe(false);
    expect(valid({ ...ftps, port: 21.5 })).toBe(false);
    expect(valid({ ...ftps, folder: "/public_html\r\nDELE index.html" })).toBe(false);
    expect(valid({ ...ftps, folder: "" })).toBe(false);
    expect(valid({ ...sftp, url: "http://www.rosasbakery.co.uk" })).toBe(false);
  });

  it("takes a host key only as OpenSSH shows its fingerprint", () => {
    expect(hostKeySchema.safeParse(HOST_KEY).success).toBe(true);
    expect(
      hostKeySchema.safeParse("MD5:16:27:ac:a5:76:28:2d:36:63:1b:56:4d:eb:df:a6:48").success,
    ).toBe(false);
  });
});

describe("a file-transfer destination's sign-in (4.3)", () => {
  const signIn = (value: unknown) => fileTransferSignInSchema.safeParse(value).success;

  it("is a password, or a private key with or without its passphrase", () => {
    expect(signIn({ password: "test-only-password" })).toBe(true);
    expect(signIn({ privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----" })).toBe(true);
    expect(signIn({ privateKey: "key", passphrase: "test-only-passphrase" })).toBe(true);
  });

  it("refuses an empty secret, both at once, and a file too large to be a key", () => {
    expect(signIn({ password: "" })).toBe(false);
    expect(signIn({ password: "p", privateKey: "k" })).toBe(false);
    expect(signIn({ privateKey: "k".repeat(PRIVATE_KEY_MAX + 1) })).toBe(false);
  });
});

describe("what this computer trusts about a destination (4.3, S2)", () => {
  const trust = (value: unknown) => fileTransferTrustSchema.safeParse(value).success;

  it("is its SFTP host key and that plain FTP's warning was seen, or nothing yet", () => {
    expect(trust({})).toBe(true);
    expect(trust({ hostKey: HOST_KEY })).toBe(true);
    expect(trust({ plainFtpWarned: true })).toBe(true);
    expect(trust({ plainFtpWarned: false })).toBe(false);
    expect(trust({ hostKey: "not a fingerprint" })).toBe(false);
    expect(trust({ password: "test-only-password" })).toBe(false);
  });
});
