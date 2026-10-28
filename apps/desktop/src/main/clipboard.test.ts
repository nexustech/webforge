import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CopiedElements, ImageMeta, MediaId, MediaMeta, NodeDoc } from "@webforge/model";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ClipboardContent,
  type ClipboardMediaImport,
  type ClipboardSite,
  createElementClipboard,
  filePaths,
  type SystemClipboard,
  systemClipboard,
  webAddress,
} from "./clipboard.js";
import type { ImportFile } from "./media-import.js";

const bytes = new Uint8Array([0xff, 0xd8, 0xff, 7]);
const photo: ImageMeta = {
  id: "photo" as MediaId,
  hash: createHash("sha256").update(bytes).digest("hex"),
  name: "shop",
  fileName: "shop.jpg",
  kind: "image",
  mimeType: "image/jpeg",
  width: 10,
  height: 10,
  alt: "",
};
const hero: NodeDoc = { type: "Hero", props: { id: "hero", image: { mediaId: "photo" } } };

let dir: string;
let held: string | undefined;
/** What else the clipboard holds, when it holds no elements. */
let notElements: ClipboardContent = { kind: "none" };
const system: SystemClipboard = {
  writeElements: async (json) => {
    held = json;
  },
  read: async (maxBytes) => {
    if (held === undefined) return notElements;
    return held.length <= maxBytes.elements ? { kind: "elements", json: held } : { kind: "none" };
  },
  holdsElements: async () => held !== undefined,
};

/** Imports as the main process would, recording what it was given. */
const imported: (readonly string[] | ImportFile)[] = [];
const importMedia: ClipboardMediaImport = {
  files: async (paths) => {
    imported.push(paths);
    return { status: "imported", items: [photo], rejected: [] };
  },
  image: async (file) => {
    imported.push(file);
    return { status: "imported", items: [photo], rejected: [] };
  },
};

/** The element clipboard with the test's system clipboard and import, for `site`. */
const elementClipboard = (site: ClipboardSite, clipboard = system, media = importMedia) => {
  const made = createElementClipboard(clipboard, dir);
  return {
    write: (elements: CopiedElements) => made.write(site, elements),
    read: () => made.read(site, media),
    forgetKept: made.forgetKept,
    forgetIfReplaced: made.forgetIfReplaced,
  };
};

/** An open site that has `photo`'s bytes, and records what a paste stores. */
function fakeSite(has = true) {
  const stored: { item: MediaMeta; data: Uint8Array | undefined }[] = [];
  const site: ClipboardSite = {
    current: () => ({
      sessionId: "9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d",
      name: "Site",
      fileName: "Site.wforge",
      formatVersion: 1,
      syncService: null,
    }),
    readMedia: async (hash) =>
      has && hash === photo.hash ? { mime: "image/jpeg", data: bytes } : undefined,
    storeCopiedMedia: async (item, read) => {
      const data = read();
      stored.push({ item, data });
      return data === undefined ? { status: "missing" } : { status: "stored", hash: item.hash };
    },
  };
  return { site, stored };
}

beforeEach(() => {
  dir = join(mkdtempSync(join(tmpdir(), "webforge-clipboard-")), "clipboard");
  held = undefined;
  notElements = { kind: "none" };
  imported.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(join(dir, ".."), { recursive: true, force: true });
});

describe("element clipboard (1.25)", () => {
  it("copies elements with their images' bytes, for another site to paste", async () => {
    const copying = elementClipboard(fakeSite().site);
    expect(await copying.write({ nodes: [hero], media: [photo] })).toEqual({ status: "copied" });
    expect(readdirSync(dir)).toEqual([photo.hash]);

    // Another site, opened later, without the image.
    const other = fakeSite(false);
    const result = await elementClipboard(other.site).read();

    expect(result).toEqual({
      status: "elements",
      elements: { nodes: [hero], media: [photo] },
      missingImages: 0,
    });
    expect(other.stored.map(({ item, data }) => [item, [...(data ?? [])]])).toEqual([
      [photo, [...bytes]],
    ]);
  });

  it("keeps only the last copy's images, and leaves out an image whose bytes are gone", async () => {
    const clipboard = elementClipboard(fakeSite().site);
    writeFileSync(join(dir, "..", "x"), "");
    await clipboard.write({ nodes: [hero], media: [photo] });
    await clipboard.write({ nodes: [hero], media: [] });
    expect(readdirSync(dir)).toEqual([]);

    await clipboard.write({ nodes: [hero], media: [photo] });
    // Changed on disk: not the copied image any more.
    writeFileSync(join(dir, photo.hash), "changed");
    const read = await elementClipboard(fakeSite(false).site).read();
    // Counted, for the paste to say so (#459).
    expect(read).toEqual({
      status: "elements",
      elements: { nodes: [hero], media: [] },
      missingImages: 1,
    });
  });

  it("copies an element without the image the site no longer has", async () => {
    const clipboard = elementClipboard(fakeSite(false).site);
    await clipboard.write({ nodes: [hero], media: [photo] });
    expect(existsSync(join(dir, photo.hash))).toBe(false);
    expect(JSON.parse(held ?? "")).toEqual({ nodes: [hero], media: [] });
  });

  it("forgets the copied images once the clipboard holds something else, and on quitting (R13d)", async () => {
    const clipboard = elementClipboard(fakeSite().site);
    await clipboard.write({ nodes: [hero], media: [photo] });

    // The window is focused while the elements are still on the clipboard: the images stay.
    await clipboard.forgetIfReplaced();
    expect(readdirSync(dir)).toEqual([photo.hash]);

    // Text copied in another app: gone when the window is next focused.
    held = undefined;
    await clipboard.forgetIfReplaced();
    expect(existsSync(dir)).toBe(false);

    // Or before a paste of something else.
    held = undefined;
    await clipboard.write({ nodes: [hero], media: [photo] });
    held = undefined;
    notElements = { kind: "address", address: "https://vimeo.com/76979871" };
    await clipboard.read();
    expect(existsSync(dir)).toBe(false);

    // And when Webforge quits, whatever the clipboard holds.
    await clipboard.write({ nodes: [hero], media: [photo] });
    clipboard.forgetKept();
    expect(existsSync(dir)).toBe(false);
  });

  it("keeps the images of a copy made while it looked at the clipboard", async () => {
    let answer: (holds: boolean) => void = () => undefined;
    const made = createElementClipboard(
      {
        ...system,
        holdsElements: () =>
          new Promise((resolve) => {
            answer = resolve;
          }),
      },
      dir,
    );

    // The window is focused, then the person copies at once, before the look has answered.
    const looking = made.forgetIfReplaced();
    await made.write(fakeSite().site, { nodes: [hero], media: [photo] });
    answer(false);
    await looking;

    expect(readdirSync(dir)).toEqual([photo.hash]);
  });

  it("doesn't ask the clipboard when no copied images are kept", async () => {
    const holdsElements = vi.fn(async () => false);
    const made = createElementClipboard({ ...system, holdsElements }, dir);

    await made.forgetIfReplaced();

    expect(holdsElements).not.toHaveBeenCalled();
  });

  it("keeps the copied images when it can't tell what the clipboard holds", async () => {
    const made = createElementClipboard(
      { ...system, holdsElements: () => Promise.reject(new Error("busy")) },
      dir,
    );
    await made.write(fakeSite().site, { nodes: [hero], media: [photo] });

    await made.forgetIfReplaced();

    expect(readdirSync(dir)).toEqual([photo.hash]);
  });

  it("finds nothing to paste in other content, or in content that isn't valid elements", async () => {
    const clipboard = elementClipboard(fakeSite().site);
    expect(await clipboard.read()).toEqual({ status: "empty" });
    for (const content of [
      "not json",
      '{"nodes":[]}',
      JSON.stringify({ nodes: [{}], media: [] }),
    ]) {
      held = content;
      expect(await clipboard.read()).toEqual({ status: "empty" });
    }
    held = "x".repeat(11 * 1024 * 1024);
    expect(await clipboard.read()).toEqual({ status: "empty" });
  });

  it("needs an open site, and reports a site that can't take the images", async () => {
    const { site } = fakeSite();
    const closed = elementClipboard({ ...site, current: () => null });
    expect(await closed.write({ nodes: [hero], media: [] })).toEqual({
      status: "failed",
      reason: "no-site",
    });
    await elementClipboard(site).write({ nodes: [hero], media: [photo] });
    expect(await closed.read()).toEqual({ status: "failed", reason: "no-site" });

    const readOnly = elementClipboard({
      ...site,
      storeCopiedMedia: async () => ({ status: "failed", reason: "read-only" }),
    });
    expect(await readOnly.read()).toEqual({ status: "failed", reason: "read-only" });
  });

  it("reports a copy it couldn't write", async () => {
    const broken = elementClipboard(fakeSite().site, {
      ...system,
      writeElements: () => Promise.reject(new Error("busy")),
    });
    expect(await broken.write({ nodes: [hero], media: [] })).toEqual({
      status: "failed",
      reason: "unknown",
    });
  });

  describe("without elements (image files, a copied image)", () => {
    it("imports files copied in the file manager", async () => {
      notElements = { kind: "files", paths: ["C:\\Photos\\shop.jpg"] };

      expect(await elementClipboard(fakeSite().site).read()).toEqual({
        status: "media",
        items: [photo],
        rejected: [],
      });
      expect(imported).toEqual([["C:\\Photos\\shop.jpg"]]);
    });

    it("imports a copied image as a PNG, or rejects one over the size limit", async () => {
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      notElements = { kind: "image", png };
      await elementClipboard(fakeSite().site).read();
      notElements = { kind: "image", png: undefined };
      await elementClipboard(fakeSite().site).read();

      expect(imported).toEqual([
        { fileName: "Pasted image.png", data: png },
        { fileName: "Pasted image.png", data: undefined },
      ]);
    });

    it("prefers copied elements, needs an open site, and passes on a failed import", async () => {
      notElements = { kind: "files", paths: ["a.jpg"] };
      held = JSON.stringify({ nodes: [hero], media: [] });
      expect((await elementClipboard(fakeSite().site).read()).status).toBe("elements");
      held = undefined;

      const { site } = fakeSite();
      expect(await elementClipboard({ ...site, current: () => null }).read()).toEqual({
        status: "failed",
        reason: "no-site",
      });
      const readOnly: ClipboardMediaImport = {
        ...importMedia,
        files: async () => ({ status: "failed", reason: "read-only" }),
      };
      expect(await elementClipboard(site, system, readOnly).read()).toEqual({
        status: "failed",
        reason: "read-only",
      });
    });

    it("passes on a copied web address, without an open site or anything stored (F-ED-16)", async () => {
      const address = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      notElements = { kind: "address", address };
      const { site, stored } = fakeSite();

      expect(await elementClipboard({ ...site, current: () => null }).read()).toEqual({
        status: "address",
        address,
      });
      expect(stored).toEqual([]);
      expect(imported).toEqual([]);
    });

    it("finds nothing when the system clipboard can't be read", async () => {
      const broken: SystemClipboard = { ...system, read: () => Promise.reject(new Error("busy")) };
      expect(await elementClipboard(fakeSite().site, broken).read()).toEqual({ status: "empty" });
    });
  });
});

describe("filePaths", () => {
  it("takes the file: URLs of a uri-list, leaving out comments and other URLs", () => {
    const list =
      "# copied\r\nfile:///C:/Photos/shop%20front.jpg\r\nhttps://example.com/a.jpg\n" +
      "file://server.example/share/b.jpg\nfile://localhost/C:/c.jpg\n";
    // Never another computer's share; localhost is this one.
    expect(filePaths(list)).toEqual(
      process.platform === "win32"
        ? ["C:\\Photos\\shop front.jpg", "C:\\c.jpg"]
        : ["/C:/Photos/shop front.jpg", "/C:/c.jpg"],
    );
  });
});

describe("webAddress", () => {
  it("takes one http(s) address of a domain, trimmed, and nothing else", () => {
    expect(webAddress(" https://youtu.be/dQw4w9WgXcQ \r\n")).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(webAddress("http://example.com/a?b=1")).toBe("http://example.com/a?b=1");
    for (const text of [
      "",
      "hello",
      "javascript:alert(1)",
      "file:///C:/shop.jpg",
      "https://localhost/a",
      "https://example.com/a b",
      "https://example.com\nhttps://example.org",
    ]) {
      expect(webAddress(text)).toBeUndefined();
    }
  });
});

describe("systemClipboard", () => {
  const limits = { elements: 100, files: 50, image: 100, address: 60 };
  /** Electron's clipboard holding one item with these types and contents. */
  const holding = (contents: Record<string, string | Uint8Array>) => {
    const item = {
      types: Object.keys(contents),
      getType: async (type: string) => new Blob([contents[type] ?? ""], { type }),
    };
    return systemClipboard({
      clipboard: { read: async () => [item] },
      ClipboardItem: class {},
    } as never);
  };
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const uri = "file:///C:/shop.jpg";

  it("tells whether it holds elements by asking for their format alone, reading nothing", async () => {
    const read = vi.fn(async () => []);
    const clipboard = (types: string[]) =>
      systemClipboard({
        clipboard: { read, has: async (type: string) => types.includes(type) },
        ClipboardItem: class {},
      } as never);

    expect(await clipboard(["web application/x-webforge-elements"]).holdsElements()).toBe(true);
    expect(await clipboard(["text/plain", "image/png"]).holdsElements()).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });

  it("reads elements first, then copied files, then an image", async () => {
    const all = {
      "web application/x-webforge-elements": "{}",
      "text/uri-list": uri,
      "image/png": png,
    };
    expect(await holding(all).read(limits)).toEqual({ kind: "elements", json: "{}" });
    expect((await holding({ "text/uri-list": uri, "image/png": png }).read(limits)).kind).toBe(
      "files",
    );
    expect(await holding({ "image/png": png }).read(limits)).toEqual({ kind: "image", png });
    expect(await holding({ "text/plain": "hello" }).read(limits)).toEqual({ kind: "none" });
  });

  it("reads text last, as a web address, after an image that comes with one (F-ED-16)", async () => {
    const video = "https://vimeo.com/76979871";
    expect(await holding({ "text/plain": `  ${video}\n` }).read(limits)).toEqual({
      kind: "address",
      address: video,
    });
    // A browser's copied image comes with its address: the image is what's pasted.
    expect(await holding({ "image/png": png, "text/plain": video }).read(limits)).toEqual({
      kind: "image",
      png,
    });
    expect(await holding({ "text/uri-list": uri, "text/plain": video }).read(limits)).toEqual({
      kind: "files",
      paths: filePaths(uri),
    });
  });

  it("doesn't read text over its limit, nor take text with more in it than an address", async () => {
    const long = `https://example.com/${"a".repeat(60)}`;
    expect(await holding({ "text/plain": long }).read(limits)).toEqual({ kind: "none" });
    for (const text of ["https://vimeo.com/1\nhttps://vimeo.com/2", "Watch https://vimeo.com/1"]) {
      expect(await holding({ "text/plain": text }).read(limits)).toEqual({ kind: "none" });
    }
  });

  it("doesn't read a file list or an image over its limit", async () => {
    const long = `${uri}\n${"#".repeat(60)}`;
    expect(await holding({ "text/uri-list": long }).read(limits)).toEqual({ kind: "none" });
    expect(await holding({ "image/png": new Uint8Array(101) }).read(limits)).toEqual({
      kind: "image",
      png: undefined,
    });
  });
});
