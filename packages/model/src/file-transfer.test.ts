import { describe, expect, it } from "vitest";
import {
  fileTransferDestinationSchema,
  fileTransferSignInSchema,
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
  hostKey: "SHA256:nThbg6kXUpJWGl7E1IGOCspRomTxdCARLviKw6E5SY8",
  url: "https://www.rosasbakery.co.uk",
} as const;

const valid = (value: unknown) => fileTransferDestinationSchema.safeParse(value).success;

describe("a file-transfer destination's settings (4.3)", () => {
  it("takes FTPS, plain FTP after its warning, and SFTP with a trusted host key", () => {
    expect(valid(ftps)).toBe(true);
    expect(valid({ ...ftps, protocol: "ftp", plainFtpWarned: true })).toBe(true);
    expect(valid(sftp)).toBe(true);
    // An SFTP host's key is trusted only once tested.
    const { hostKey: _, ...untrusted } = sftp;
    expect(valid(untrusted)).toBe(true);
  });

  it("never holds a password or a key", () => {
    expect(valid({ ...ftps, password: "test-only-password" })).toBe(false);
    expect(valid({ ...sftp, privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----" })).toBe(false);
  });

  it("keeps each protocol's own settings to it", () => {
    expect(valid({ ...ftps, signIn: "key" })).toBe(false);
    expect(valid({ ...sftp, plainFtpWarned: true })).toBe(false);
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
    expect(hostKeySchema.safeParse(sftp.hostKey).success).toBe(true);
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
