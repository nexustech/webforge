import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { diffManifest, type Manifest, manifestOf, manifestSchema, sha1 } from "./manifest.js";

const bytes = (text: string) => new TextEncoder().encode(text);
const site = (files: Record<string, string>) =>
  new Map(Object.entries(files).map(([path, text]) => [path, bytes(text)]));

describe("sha1", () => {
  it("returns the hex SHA-1 digest Netlify expects", () => {
    expect(sha1(bytes("hello"))).toBe("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d");
  });
});

describe("manifestOf", () => {
  it("lists every file with its digest", () => {
    expect(manifestOf(site({ "index.html": "hello" }))).toEqual({
      version: 1,
      files: { "index.html": "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d" },
    });
  });
});

describe("manifestSchema", () => {
  const digest = "a".repeat(40);

  it("accepts relative site paths", () => {
    const manifest = { version: 1, files: { "index.html": digest, "assets/a b.css": digest } };
    expect(manifestSchema.parse(manifest)).toEqual(manifest);
  });

  it.each([
    "../outside.html",
    "assets/../../outside.html",
    "/etc/passwd",
    "assets//a.css",
    "./index.html",
    "C:/Windows/win.ini",
    String.raw`assets\a.css`,
    "a\u0000.html",
    "",
  ])("rejects %j, which could point outside the site folder", (path) => {
    expect(manifestSchema.safeParse({ version: 1, files: { [path]: digest } }).success).toBe(false);
  });

  it("rejects digests that are not SHA-1 hex and unknown versions", () => {
    expect(manifestSchema.safeParse({ version: 1, files: { "a.html": "xyz" } }).success).toBe(
      false,
    );
    expect(manifestSchema.safeParse({ version: 2, files: {} }).success).toBe(false);
  });
});

describe("diffManifest", () => {
  const previous = manifestOf(
    site({ "index.html": "home", "about.html": "about", "assets/old.css": "old" }),
  );

  it("uploads everything in order on a first publish", () => {
    const next = manifestOf(site({ "index.html": "home", "assets/site.css": "css" }));

    expect(diffManifest(null, next)).toEqual({
      upload: ["assets/site.css", "index.html"],
      unchanged: [],
      remove: [],
    });
  });

  it("uploads only new and changed files and removes what the site no longer has", () => {
    const next = manifestOf(
      site({ "index.html": "home", "about.html": "about, edited", "assets/new.css": "new" }),
    );

    expect(diffManifest(previous, next)).toEqual({
      upload: ["assets/new.css", "about.html"],
      unchanged: ["index.html"],
      remove: ["assets/old.css"],
    });
  });

  it("removes pages before the assets they use", () => {
    const next = manifestOf(site({ "index.html": "home" }));

    expect(diffManifest(previous, next).remove).toEqual(["about.html", "assets/old.css"]);
  });

  it("does not mistake object built-ins for published files", () => {
    const next = manifestOf(site({ constructor: "x", "index.html": "home" }));

    expect(diffManifest(previous, next).upload).toEqual(["constructor"]);
  });
});

const pathArb = fc
  .array(fc.constantFrom("index.html", "about.html", "a.css", "b.webp", "blog/post.html", "x.js"), {
    minLength: 0,
    maxLength: 6,
  })
  .map((paths) => [...new Set(paths)]);
const manifestArb = fc
  .tuple(pathArb, fc.array(fc.constantFrom("0", "1", "2"), { minLength: 6, maxLength: 6 }))
  .map(
    ([paths, contents]): Manifest =>
      manifestOf(site(Object.fromEntries(paths.map((p, i) => [p, contents[i] ?? "0"])))),
  );

describe("diffManifest properties", () => {
  it("uploads exactly the new and changed files, home page last, and removes only old files", () => {
    fc.assert(
      fc.property(fc.option(manifestArb, { nil: null }), manifestArb, (previous, next) => {
        const diff = diffManifest(previous, next);
        const before = previous?.files ?? {};
        const nextPaths = Object.keys(next.files);

        // Every file of the next site is either uploaded or already there, never both.
        expect([...diff.upload, ...diff.unchanged].sort()).toEqual([...nextPaths].sort());
        for (const path of diff.unchanged) expect(before[path]).toBe(next.files[path]);
        for (const path of diff.upload) expect(before[path]).not.toBe(next.files[path]);
        // Only files the previous publish listed are removed, and none the site still has.
        for (const path of diff.remove) {
          expect(Object.hasOwn(before, path) && !Object.hasOwn(next.files, path)).toBe(true);
        }
        if (diff.upload.includes("index.html")) expect(diff.upload.at(-1)).toBe("index.html");
      }),
    );
  });
});
