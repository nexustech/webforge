import { describe, expect, it } from "vitest";
import {
  PUBLISH_DESTINATIONS_MAX,
  type PublishDestination,
  publishDestinationSchema,
  publishDestinationsFrom,
  publishDestinationsSchema,
} from "./publish-destinations.js";

const sftp: PublishDestination = {
  id: "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10",
  name: "My host",
  kind: "file-transfer",
  settings: {
    protocol: "sftp",
    host: "ftp.example.com",
    user: "rosa",
    folder: "/public_html",
    url: "https://www.rosas-bakery.example/",
    signIn: "key",
  },
};

const netlify: PublishDestination = {
  id: "0b9a8f6e-3c2d-4e1f-8a7b-6c5d4e3f2a10",
  name: "Netlify",
  kind: "netlify",
  siteId: "4f9a2c1e-7b3d-4a5e-9c8f-1d2e3f4a5b6c",
};

/** A destination like `sftp` with id number `n`. */
const numbered = (n: number): PublishDestination => ({
  ...sftp,
  id: `6f1c1b6e-8a3e-4c1e-9d55-${n.toString(16).padStart(12, "0")}`,
});

describe("publishDestinationSchema (4.4a, ADR 0018 §2)", () => {
  it("accepts a file-transfer and a Netlify destination, its name trimmed", () => {
    expect(publishDestinationSchema.parse(sftp)).toEqual(sftp);
    expect(publishDestinationSchema.parse(netlify)).toEqual(netlify);
    expect(publishDestinationSchema.parse({ ...sftp, name: "  My host " }).name).toBe("My host");
  });

  it.each<[string, unknown]>([
    ["a password", { ...sftp, settings: { ...sftp.settings, password: "hunter2" } }],
    ["a token", { ...netlify, token: "nfp_secret" }],
    [
      "a host key",
      { ...sftp, settings: { ...sftp.settings, hostKey: `SHA256:${"a".repeat(43)}` } },
    ],
    ["no name", { ...sftp, name: "  " }],
    ["an id that isn't a uuid", { ...sftp, id: "live" }],
    ["an unknown kind", { ...sftp, kind: "dropbox" }],
    [
      "a host that is neither a name nor an IP address",
      { ...sftp, settings: { ...sftp.settings, host: "ftp://x" } },
    ],
    ["an address that isn't https", { ...netlify, url: "http://rosa.netlify.app" }],
  ])("refuses %s: secrets and trust never reach the site file", (_name, destination) => {
    expect(publishDestinationSchema.safeParse(destination).success).toBe(false);
  });
});

describe("publishDestinationsSchema", () => {
  it("refuses two destinations with one id, or more than the most a site may have", () => {
    expect(publishDestinationsSchema.safeParse([sftp, netlify]).success).toBe(true);
    expect(publishDestinationsSchema.safeParse([sftp, { ...netlify, id: sftp.id }]).success).toBe(
      false,
    );
    const many = Array.from({ length: PUBLISH_DESTINATIONS_MAX + 1 }, (_, n) => numbered(n));
    expect(publishDestinationsSchema.safeParse(many).success).toBe(false);
    expect(publishDestinationsSchema.safeParse(many.slice(1)).success).toBe(true);
  });
});

describe("publishDestinationsFrom", () => {
  it("leaves out a damaged entry, or a second with the same id, keeping the others", () => {
    const stored = [
      sftp,
      { ...netlify, kind: "dropbox" },
      { ...netlify, name: "Second", id: sftp.id },
      netlify,
    ];
    expect(publishDestinationsFrom(stored)).toEqual([sftp, netlify]);
  });

  it("reads anything that isn't a list as none, and at most the most a site may have", () => {
    for (const stored of [undefined, null, "[]", { 0: sftp }]) {
      expect(publishDestinationsFrom(stored)).toEqual([]);
    }
    const many = Array.from({ length: PUBLISH_DESTINATIONS_MAX + 5 }, (_, n) => numbered(n));
    expect(publishDestinationsFrom(many)).toEqual(many.slice(0, PUBLISH_DESTINATIONS_MAX));
  });
});
