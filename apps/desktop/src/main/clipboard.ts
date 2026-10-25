import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { t } from "@webforge/i18n";
import {
  type CopiedElements,
  copiedElementsSchema,
  type MediaMeta,
  webUrlSchema,
} from "@webforge/model";
import {
  type ClipboardReadResult,
  type ClipboardWriteResult,
  MAX_ADDRESS_BYTES,
} from "../shared/ipc/clipboard.js";
import { MAX_MEDIA_BYTES } from "../shared/ipc/media.js";
import type { MediaImportResult } from "../shared/ipc-contract.js";
import { logFailure } from "./log.js";
import type { ImportFile } from "./media-import.js";
import type { ProjectSession } from "./project-session.js";

/**
 * Webforge's own format on the system clipboard: copied elements, as JSON. Electron's clipboard
 * keeps a custom format only as a web custom format ("web " and a MIME type).
 */
const ELEMENTS_FORMAT = "web application/x-webforge-elements";

/** The most bytes of copied elements read back, so a huge clipboard can't hold the app up. */
const MAX_ELEMENTS_BYTES = 10 * 1024 * 1024;

/** The most bytes of a list of copied files read: thousands of paths, far more than are taken. */
const MAX_FILE_LIST_BYTES = 1024 * 1024;

/** A file the clipboard keeps aside: an image's bytes, named by their SHA-256 hash. */
const KEPT_FILE = /^[0-9a-f]{64}$/;

/** What the system clipboard holds that Webforge can paste, most specific first. */
export type ClipboardContent =
  /** Webforge's copied elements, as JSON. */
  | { readonly kind: "elements"; readonly json: string }
  /** Files copied in the file manager, as paths. */
  | { readonly kind: "files"; readonly paths: readonly string[] }
  /** A copied image (a screenshot) as PNG bytes; none when it is over the size limit. */
  | { readonly kind: "image"; readonly png: Uint8Array | undefined }
  /** Copied text that is one web address and nothing else (a video's, F-ED-16). */
  | { readonly kind: "address"; readonly address: string }
  | { readonly kind: "none" };

/** The system clipboard, as the element clipboard uses it. */
export type SystemClipboard = {
  /** Replaces the clipboard's content with copied elements. */
  writeElements(json: string): Promise<void>;
  /**
   * What the clipboard holds; elements, a file list, an image or text over the limits aren't
   * read.
   */
  read(maxBytes: {
    readonly elements: number;
    readonly files: number;
    readonly image: number;
    readonly address: number;
  }): Promise<ClipboardContent>;
  /** Whether the clipboard still holds copied elements, without reading them. */
  holdsElements(): Promise<boolean>;
};

/**
 * The file paths in a `text/uri-list`: its `file:` URLs on this computer, without comments. A URL
 * naming another computer (`file://server/share/…`) is left out, so a paste never opens a network
 * share, which would send the user's credentials to it.
 */
export function filePaths(uriList: string): string[] {
  return uriList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .flatMap((line) => {
      try {
        const url = new URL(line);
        const local = url.protocol === "file:" && (url.host === "" || url.host === "localhost");
        return local ? [fileURLToPath(url)] : [];
      } catch {
        return [];
      }
    });
}

/**
 * The web address copied `text` is, trimmed: one line, an http(s) address of a domain, and nothing
 * else. `undefined` for any other text, which a paste leaves alone.
 */
export function webAddress(text: string): string | undefined {
  const address = text.trim();
  if (/\s/.test(address)) return undefined;
  return webUrlSchema.safeParse(address).success ? address : undefined;
}

/** Electron's clipboard as a {@link SystemClipboard}. */
export function systemClipboard(
  electron: Pick<typeof import("electron"), "clipboard" | "ClipboardItem">,
): SystemClipboard {
  const { clipboard, ClipboardItem } = electron;
  return {
    writeElements: (json) =>
      clipboard.write([
        new ClipboardItem({ [ELEMENTS_FORMAT]: new Blob([json], { type: ELEMENTS_FORMAT }) }),
      ]),
    async read(maxBytes) {
      const items = await clipboard.read();
      const blobOf = async (type: string): Promise<Blob | undefined> => {
        const item = items.find((candidate) => candidate.types.includes(type));
        const blob = item === undefined ? undefined : await item.getType(type);
        return blob instanceof Blob ? blob : undefined;
      };
      const elements = await blobOf(ELEMENTS_FORMAT);
      if (elements !== undefined) {
        return elements.size > maxBytes.elements
          ? { kind: "none" }
          : { kind: "elements", json: await elements.text() };
      }
      // Files copied in Explorer or Finder come as a list of file: URLs.
      const uris = await blobOf("text/uri-list");
      const paths =
        uris === undefined || uris.size > maxBytes.files ? [] : filePaths(await uris.text());
      if (paths.length > 0) {
        return { kind: "files", paths };
      }
      const image = await blobOf("image/png");
      if (image !== undefined) {
        return {
          kind: "image",
          png: image.size > maxBytes.image ? undefined : new Uint8Array(await image.arrayBuffer()),
        };
      }
      // Text last: an image copied from a browser comes with its address as text too.
      const text = await blobOf("text/plain");
      const address =
        text === undefined || text.size > maxBytes.address
          ? undefined
          : webAddress(await text.text());
      return address === undefined ? { kind: "none" } : { kind: "address", address };
    },
    // Only the items' types are listed: no content is read.
    holdsElements: async () =>
      (await clipboard.read()).some((item) => item.types.includes(ELEMENTS_FORMAT)),
  };
}

/** Imports what the clipboard holds that isn't elements: copied files, or a copied image. */
export type ClipboardMediaImport = {
  files(paths: readonly string[]): Promise<MediaImportResult>;
  image(file: ImportFile): Promise<MediaImportResult>;
};

/** The open site, as the clipboard reads and fills its Media. */
export type ClipboardSite = Pick<ProjectSession, "current" | "readMedia" | "storeCopiedMedia">;

const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

/** Logs that `action` (a fixed phrase: "copy the elements") failed, with the error's code only. */
function failed(action: string, error: unknown): void {
  logFailure(`Webforge could not ${action}`, error);
}

/**
 * Copies and pastes elements (1.25, F-ED-16). The elements go on the system clipboard in Webforge's
 * own format, so copying anything else replaces them. Only one site is open at a time, so the bytes
 * of the images they show are kept in `dir` until the next copy: a site opened later can paste
 * them with their images. Nothing but those bytes is written there, and only while the clipboard
 * holds the elements: they go once something else is copied, and when Webforge quits (R13d), so a
 * site's images don't stay on disk outside it. Without elements, a paste imports copied image files
 * or a copied image (a screenshot) into Media, or passes on a copied web address (never logged),
 * which the renderer places if it is a video's.
 */
export function createElementClipboard(system: SystemClipboard, dir: string) {
  /** Removes the kept bytes; a failure is logged, and the next copy or quit tries again. */
  const forgetKept = (): void => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch (error) {
      failed("clear the copied images", error);
    }
  };

  /** The kept bytes of `item`, if they are still there and unchanged. */
  const readKept = (item: MediaMeta): Uint8Array | undefined => {
    const path = join(dir, item.hash);
    if (!KEPT_FILE.test(item.hash) || !existsSync(path)) return undefined;
    const data = readFileSync(path);
    return sha256(data) === item.hash ? data : undefined;
  };

  /** Imports copied files or a copied image into the open site, for the renderer to place. */
  const pasteMedia = async (
    site: ClipboardSite,
    importMedia: ClipboardMediaImport,
    content: Extract<ClipboardContent, { kind: "files" | "image" }>,
  ): Promise<ClipboardReadResult> => {
    if (site.current() === null) {
      return { status: "failed", reason: "no-site" };
    }
    const result =
      content.kind === "files"
        ? await importMedia.files(content.paths)
        : await importMedia.image({
            fileName: `${t("site.media.pastedImage")}.png`,
            data: content.png,
          });
    if (result.status === "failed") return result;
    if (result.status === "canceled") return { status: "empty" };
    return { status: "media", items: result.items, rejected: result.rejected };
  };

  return {
    /** Copies `elements` from `site`, the open site as the caller's session sees it. */
    async write(site: ClipboardSite, elements: CopiedElements): Promise<ClipboardWriteResult> {
      if (site.current() === null) {
        return { status: "failed", reason: "no-site" };
      }
      try {
        mkdirSync(dir, { recursive: true });
        const media: MediaMeta[] = [];
        for (const item of elements.media) {
          if (!KEPT_FILE.test(item.hash)) continue;
          const path = join(dir, item.hash);
          if (!existsSync(path)) {
            const blob = await site.readMedia(item.hash);
            if (blob === undefined) continue;
            const temporary = join(dir, `.${item.hash}.${randomUUID()}.tmp`);
            writeFileSync(temporary, blob.data);
            renameSync(temporary, path);
          }
          media.push(item);
        }
        // The last copy's images go: the clipboard holds one copy at a time.
        const kept = new Set(media.map((item) => item.hash));
        for (const name of readdirSync(dir)) {
          if (!kept.has(name)) rmSync(join(dir, name), { force: true });
        }
        const { nodes, sharedSectionId } = elements;
        await system.writeElements(JSON.stringify({ nodes, media, sharedSectionId }));
        return { status: "copied" };
      } catch (error) {
        failed("copy elements", error);
        return { status: "failed", reason: "unknown" };
      }
    },

    /**
     * Reads what the clipboard holds for a paste into `site`, the open site as the caller's
     * session sees it (R6): what it stores, it stores through `site` and `importMedia`.
     */
    async read(
      site: ClipboardSite,
      importMedia: ClipboardMediaImport,
    ): Promise<ClipboardReadResult> {
      let content: ClipboardContent;
      try {
        content = await system.read({
          elements: MAX_ELEMENTS_BYTES,
          files: MAX_FILE_LIST_BYTES,
          image: MAX_MEDIA_BYTES,
          address: MAX_ADDRESS_BYTES,
        });
      } catch {
        // Unreadable: nothing Webforge can paste.
        return { status: "empty" };
      }
      if (content.kind !== "elements") {
        // Something else was copied since: the kept images are no longer the clipboard's.
        forgetKept();
      }
      if (content.kind === "none") {
        return { status: "empty" };
      }
      // For the renderer to place, if it is a video's: nothing to store.
      if (content.kind === "address") {
        return { status: "address", address: content.address };
      }
      if (content.kind !== "elements") {
        return pasteMedia(site, importMedia, content);
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(content.json);
      } catch {
        return { status: "empty" };
      }
      const copied = copiedElementsSchema.safeParse(parsed);
      if (!copied.success) {
        return { status: "empty" };
      }
      if (site.current() === null) {
        return { status: "failed", reason: "no-site" };
      }
      try {
        const media: MediaMeta[] = [];
        for (const item of copied.data.media) {
          const stored = await site.storeCopiedMedia(item, () => readKept(item));
          if (stored.status === "failed") return stored;
          if (stored.status === "stored") media.push(item);
        }
        const { nodes, sharedSectionId } = copied.data;
        const shared = sharedSectionId === undefined ? {} : { sharedSectionId };
        return { status: "elements", elements: { nodes, media, ...shared } };
      } catch (error) {
        failed("paste elements", error);
        return { status: "failed", reason: "unknown" };
      }
    },

    /** Removes the kept images: Webforge is quitting. */
    forgetKept,

    /**
     * Removes the kept images if the clipboard no longer holds the elements they belong to (the
     * window was focused, after something was copied elsewhere). An unreadable clipboard keeps
     * them: the next paste or quit decides.
     */
    async forgetIfReplaced(): Promise<void> {
      let holds: boolean;
      try {
        holds = await system.holdsElements();
      } catch {
        return;
      }
      if (!holds) forgetKept();
    },
  };
}

/** The element clipboard. */
export type ElementClipboard = ReturnType<typeof createElementClipboard>;
