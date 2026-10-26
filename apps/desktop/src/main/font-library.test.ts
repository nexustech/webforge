import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFontLibrary, type FontFetch, registerFontHandlers } from "./font-library.js";

const SOURCES = {
  api: "https://fonts.test/api",
  files: "https://fonts.test/files",
  listings: "https://fonts.test/listings",
};

/** A static font: three weights, upright and italic, Latin only. */
const comic = {
  id: "comic-neue",
  family: "Comic Neue",
  subsets: ["latin"],
  weights: [300, 400, 700],
  styles: ["italic", "normal"],
  variable: false,
  category: "handwriting",
  license: "OFL-1.1",
  unicodeRange: { latin: "U+0000-00FF,U+0131" },
};

/** A variable font, listed by Fontsource as display. */
const grotesk = {
  ...comic,
  id: "big-shoulders",
  family: "Big Shoulders",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weights: [100, 900],
  styles: ["normal"],
  variable: true,
  category: "display",
  unicodeRange: { latin: "U+0000-00FF", "latin-ext": "U+0100-02BA", vietnamese: "U+0102" },
};

/** A file's bytes: different for every name, so a swapped file shows. */
const bytesOf = (name: string) => new TextEncoder().encode(`woff2:${name}`);
const base64 = (data: Uint8Array) => createHash("sha256").update(data).digest("base64");

type Fake = {
  readonly fetch: FontFetch & ReturnType<typeof vi.fn>;
  readonly urls: () => string[];
};

/**
 * Fontsource and jsDelivr, offline: `fonts` by id, each package at 5.3.0 with every file it is
 * asked for. `damage` serves other bytes for that file than its listing says.
 */
function fakeSources({
  fonts = [comic, grotesk],
  list = [
    { ...comic, type: "google" },
    { ...grotesk, type: "google" },
    { ...comic, id: "zero", family: "Zero", license: "CC0-1.0" },
    { ...comic, id: "kana", family: "Kana", subsets: ["japanese"] },
    { ...comic, id: "glyphs", family: "Glyphs", category: "icons" },
    { ...comic, id: "inter", family: "Inter", variable: true, category: "sans-serif" },
    { id: "broken" },
  ],
  damage,
}: {
  fonts?: readonly (typeof comic)[];
  list?: unknown;
  damage?: string;
} = {}): Fake {
  const json = (value: unknown) => Promise.resolve(Response.json(value));
  const fetch = vi.fn(async (url: string) => {
    if (url === `${SOURCES.api}/fonts`) return json(list);
    for (const font of fonts) {
      const name = `${font.variable ? "@fontsource-variable" : "@fontsource"}/${font.id}`;
      if (url === `${SOURCES.api}/fonts/${font.id}`) return json(font);
      if (url === `${SOURCES.api}/variable/${font.id}`) {
        return json({ axes: { wght: { min: "100", max: "900", default: "400" } } });
      }
      if (url === `${SOURCES.listings}/${name}/resolved?specifier=latest`) {
        return json({ type: "npm", name, version: "5.3.0" });
      }
      if (url === `${SOURCES.listings}/${name}@5.3.0?structure=flat`) {
        const files = [300, 400, 700, "wght"].flatMap((weight) =>
          ["latin", "latin-ext"].flatMap((subset) =>
            ["normal", "italic"].map((style) => `${font.id}-${subset}-${weight}-${style}.woff2`),
          ),
        );
        return json({
          files: files.map((file) => ({
            name: `/files/${file}`,
            hash: base64(bytesOf(file)),
            size: bytesOf(file).byteLength,
          })),
        });
      }
      const prefix = `${SOURCES.files}/${name}@5.3.0/files/`;
      if (url.startsWith(prefix)) {
        const file = url.slice(prefix.length);
        return new Response(file === damage ? bytesOf("other") : bytesOf(file));
      }
    }
    return new Response("Not found", { status: 404 });
  });
  return {
    fetch: fetch as Fake["fetch"],
    urls: () => fetch.mock.calls.map(([url]) => url),
  };
}

const dirs: string[] = [];
const newDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "webforge-fonts-"));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("createFontLibrary: downloads (2.2, PH2-8)", () => {
  it("downloads a font's Latin files, each checked, and keeps it for the next start", async () => {
    const dir = newDir();
    const sources = fakeSources();
    const library = createFontLibrary({ dir, fetch: sources.fetch, sources: SOURCES });

    const result = await library.download("comic-neue");

    expect(result).toEqual({
      status: "downloaded",
      font: {
        id: "comic-neue",
        family: "Comic Neue",
        fallback: "serif",
        category: "handwriting",
        variable: false,
        source: "downloaded",
        // What the font picker previews it with (2.3c): its Latin regular.
        preview: "comic-neue-latin-400-normal.woff2",
      },
    });
    // The bundled fonts' rules: 300–700 upright, italics at 400 and 700.
    const [family] = await library.downloaded();
    expect(family?.files.map((file) => file.file)).toEqual([
      "comic-neue-latin-400-italic.woff2",
      "comic-neue-latin-700-italic.woff2",
      "comic-neue-latin-300-normal.woff2",
      "comic-neue-latin-400-normal.woff2",
      "comic-neue-latin-700-normal.woff2",
    ]);
    const file = family?.files[0];
    if (file === undefined) throw new Error("No file");
    expect(file).toMatchObject({
      bytes: bytesOf(file.file).byteLength,
      sha256: createHash("sha256").update(bytesOf(file.file)).digest("hex"),
    });
    expect(library.file(file.file)).toEqual(file);
    expect(library.reader.read(file)).toEqual(bytesOf(file.file));
    expect((await library.list()).at(-1)).toMatchObject({ id: "comic-neue", source: "downloaded" });

    const restarted = createFontLibrary({ dir, fetch: fakeSources().fetch, sources: SOURCES });
    expect((await restarted.downloaded()).map((each) => each.id)).toEqual(["comic-neue"]);
  });

  it("takes a variable font's weight axis, its Latin subsets and a fallback for display", async () => {
    const library = createFontLibrary({
      dir: newDir(),
      fetch: fakeSources().fetch,
      sources: SOURCES,
    });

    const result = await library.download("big-shoulders");

    expect(result).toMatchObject({ status: "downloaded", font: { fallback: "sans-serif" } });
    const [family] = await library.downloaded();
    expect(family).toMatchObject({ package: "@fontsource-variable/big-shoulders", variable: true });
    expect(family?.files.map((file) => [file.file, file.weight])).toEqual([
      ["big-shoulders-latin-wght-normal.woff2", [100, 900]],
      ["big-shoulders-latin-ext-wght-normal.woff2", [100, 900]],
    ]);
  });

  it("keeps nothing of a font with a file that isn't what its package lists", async () => {
    const dir = newDir();
    const sources = fakeSources({ damage: "comic-neue-latin-700-normal.woff2" });
    const library = createFontLibrary({ dir, fetch: sources.fetch, sources: SOURCES });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await library.download("comic-neue")).toEqual({ status: "failed", reason: "damaged" });
    expect(await library.downloaded()).toEqual([]);
    expect(existsSync(join(dir, "comic-neue-latin-400-normal.woff2"))).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      "Webforge could not download a font (reason=damaged)",
    );
  });

  it("refuses a licence C1 doesn't allow, and a font without Latin, before fetching any file", async () => {
    const fonts = [
      { ...comic, license: "CC0-1.0" },
      { ...grotesk, id: "kana", subsets: ["japanese"] },
    ];
    const sources = fakeSources({ fonts });
    const library = createFontLibrary({ dir: newDir(), fetch: sources.fetch, sources: SOURCES });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await library.download("comic-neue")).toEqual({
      status: "failed",
      reason: "not-allowed",
    });
    expect(await library.download("kana")).toEqual({ status: "failed", reason: "not-allowed" });
    expect(sources.urls().some((url) => url.startsWith(SOURCES.files))).toBe(false);
  });

  it("says when Fontsource can't be reached, and when a font isn't there", async () => {
    const offline = vi.fn(() => Promise.reject(new TypeError("fetch failed")));
    const library = createFontLibrary({ dir: newDir(), fetch: offline, sources: SOURCES });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await library.download("comic-neue")).toEqual({ status: "failed", reason: "offline" });
    const missing = createFontLibrary({
      dir: newDir(),
      fetch: fakeSources().fetch,
      sources: SOURCES,
    });
    expect(await missing.download("nothing-here")).toEqual({ status: "failed", reason: "unknown" });
  });

  it("answers a bundled font, or one downloaded before, without fetching", async () => {
    const sources = fakeSources();
    const library = createFontLibrary({ dir: newDir(), fetch: sources.fetch, sources: SOURCES });

    expect(await library.download("inter")).toMatchObject({
      status: "downloaded",
      font: { family: "Inter", source: "bundled" },
    });
    expect(sources.urls()).toEqual([]);

    // Asked twice at once: one download.
    const [first, second] = await Promise.all([
      library.download("comic-neue"),
      library.download("comic-neue"),
    ]);
    expect(second).toEqual(first);
    const fetched = sources.urls().length;
    await library.download("comic-neue");
    expect(sources.urls()).toHaveLength(fetched);
    expect(sources.urls().filter((url) => url.endsWith("/fonts/comic-neue"))).toHaveLength(1);
  });

  it("refuses a kept file that changed, and downloads it again", async () => {
    const dir = newDir();
    const sources = fakeSources();
    const library = createFontLibrary({ dir, fetch: sources.fetch, sources: SOURCES });
    await library.download("comic-neue");
    const [family] = await library.downloaded();
    const file = family?.files[0];
    if (file === undefined) throw new Error("No file");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    writeFileSync(join(dir, file.file), "swapped");

    const restarted = createFontLibrary({ dir, fetch: sources.fetch, sources: SOURCES });
    await restarted.downloaded();
    expect(restarted.reader.read(file)).toBeUndefined();
    expect(await restarted.download("comic-neue")).toMatchObject({ status: "downloaded" });
    expect(restarted.reader.read(file)).toEqual(bytesOf(file.file));
  });

  it("keeps every family two downloads at once add", async () => {
    const dir = newDir();
    const library = createFontLibrary({ dir, fetch: fakeSources().fetch, sources: SOURCES });

    await Promise.all([library.download("comic-neue"), library.download("big-shoulders")]);

    const manifest = JSON.parse(readFileSync(join(dir, "downloaded.json"), "utf8")) as {
      families: { id: string }[];
    };
    expect(manifest.families.map((family) => family.id).sort()).toEqual([
      "big-shoulders",
      "comic-neue",
    ]);
  });

  it("ignores a list of downloaded fonts it can't read", async () => {
    const dir = newDir();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    writeFileSync(join(dir, "downloaded.json"), "{ not json");
    const library = createFontLibrary({ dir, fetch: fakeSources().fetch, sources: SOURCES });

    expect(await library.downloaded()).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      "Webforge ignored an unreadable list of downloaded fonts (code=SyntaxError)",
    );
  });
});

describe("createFontLibrary: browsing (S4)", () => {
  const DAY = 24 * 60 * 60 * 1000;

  it("lists Fontsource's fonts the app may use, marking the ones the computer has", async () => {
    const library = createFontLibrary({
      dir: newDir(),
      fetch: fakeSources().fetch,
      sources: SOURCES,
    });
    await library.download("comic-neue");

    const result = await library.browse();

    // Not CC0, nor Japanese only, nor icons, nor an entry it can't read.
    expect(result).toEqual({
      status: "listed",
      fonts: [
        {
          id: "comic-neue",
          family: "Comic Neue",
          category: "handwriting",
          variable: false,
          installed: true,
        },
        {
          id: "big-shoulders",
          family: "Big Shoulders",
          category: "display",
          variable: true,
          installed: false,
        },
        { id: "inter", family: "Inter", category: "sans-serif", variable: true, installed: true },
      ],
    });
  });

  it("keeps the list for a week, and serves the last one offline", async () => {
    const dir = newDir();
    let now = 1_000 * DAY;
    const sources = fakeSources();
    const library = createFontLibrary({
      dir,
      fetch: sources.fetch,
      sources: SOURCES,
      now: () => now,
    });
    await library.browse();
    const listed = () => sources.urls().filter((url) => url === `${SOURCES.api}/fonts`).length;

    now += 6 * DAY;
    await library.browse();
    expect(listed()).toBe(1);

    now += 2 * DAY;
    await library.browse();
    expect(listed()).toBe(2);

    // A new start, offline, and long after: the kept list.
    const offline = vi.fn(() => Promise.reject(new TypeError("fetch failed")));
    const later = createFontLibrary({
      dir,
      fetch: offline,
      sources: SOURCES,
      now: () => now + 30 * DAY,
    });
    expect(await later.browse()).toMatchObject({ status: "listed", fonts: expect.any(Array) });
  });

  it("says when it was never listed and can't be now", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const offline = vi.fn(() => Promise.reject(new TypeError("fetch failed")));
    const library = createFontLibrary({ dir: newDir(), fetch: offline, sources: SOURCES });
    const broken = createFontLibrary({
      dir: newDir(),
      fetch: fakeSources({ list: { not: "a list" } }).fetch,
      sources: SOURCES,
    });

    expect(await library.browse()).toEqual({ status: "failed", reason: "offline" });
    expect(await broken.browse()).toEqual({ status: "failed", reason: "unknown" });
  });
});

describe("registerFontHandlers (2.2)", () => {
  type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

  it("downloads by Fontsource id only, refusing anything else", async () => {
    const registered = new Map<string, Handler>();
    const ipc = {
      handle: (channel: string, handler: Handler) => registered.set(channel, handler),
    } as unknown as Pick<IpcMain, "handle">;
    const library = createFontLibrary({
      dir: newDir(),
      fetch: fakeSources().fetch,
      sources: SOURCES,
    });
    registerFontHandlers(ipc, () => true, library);
    const invoke = (channel: string, ...args: unknown[]) =>
      registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await invoke("fonts:download", "comic-neue")).toMatchObject({ status: "downloaded" });
    for (const bad of ["../comic-neue", "Comic Neue", "", 42, "a".repeat(101)]) {
      await expect(invoke("fonts:download", bad)).rejects.toThrow("ipc-failed");
    }
    expect(await invoke("fonts:list")).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "comic-neue", source: "downloaded" })]),
    );
    expect(await invoke("fonts:browse")).toMatchObject({ status: "listed" });
  });
});
