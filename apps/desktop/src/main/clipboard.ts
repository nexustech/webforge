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
import { type CopiedElements, copiedElementsSchema, type MediaMeta } from "@webforge/model";
import type { ClipboardReadResult, ClipboardWriteResult } from "../shared/ipc/clipboard.js";
import { MAX_MEDIA_BYTES } from "../shared/ipc/media.js";
import type { MediaImportResult } from "../shared/ipc-contract.js";
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
  | { readonly kind: "none" };

/** The system clipboard, as the element clipboard uses it. */
export type SystemClipboard = {
  /** Replaces the clipboard's content with copied elements. */
  writeElements(json: string): Promise<void>;
  /** What the clipboard holds; elements, a file list or an image over the limits aren't read. */
  read(maxBytes: {
    readonly elements: number;
    readonly files: number;
    readonly image: number;
  }): Promise<ClipboardContent>;
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
      return { kind: "none" };
    },
  };
}

/** Imports what the clipboard holds that isn't elements: copied files, or a copied image. */
export type ClipboardMediaImport = {
  files(paths: readonly string[]): Promise<MediaImportResult>;
  image(file: ImportFile): MediaImportResult;
};

/** The open site, as the clipboard reads and fills its Media. */
export type ClipboardSite = Pick<ProjectSession, "current" | "readMedia" | "storeCopiedMedia">;

const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

function logFailure(action: string, error: unknown): void {
  const code = error instanceof Error && "code" in error ? String(error.code) : "no code";
  console.error(`Webforge could not ${action} (${code})`);
}

/**
 * Copies and pastes elements (1.25, F-ED-16). The elements go on the system clipboard in Webforge's
 * own format, so copying anything else replaces them. Only one site is open at a time, so the bytes
 * of the images they show are kept in `dir` until the next copy: a site opened later can paste
 * them with their images. Nothing but those bytes is written there. Without elements, a paste
 * imports copied image files or a copied image (a screenshot) into Media.
 */
export function createElementClipboard(
  system: SystemClipboard,
  dir: string,
  site: ClipboardSite,
  importMedia: ClipboardMediaImport,
) {
  /** The kept bytes of `item`, if they are still there and unchanged. */
  const readKept = (item: MediaMeta): Uint8Array | undefined => {
    const path = join(dir, item.hash);
    if (!KEPT_FILE.test(item.hash) || !existsSync(path)) return undefined;
    const data = readFileSync(path);
    return sha256(data) === item.hash ? data : undefined;
  };

  /** Imports copied files or a copied image into the open site, for the renderer to place. */
  const pasteMedia = async (
    content: Extract<ClipboardContent, { kind: "files" | "image" }>,
  ): Promise<ClipboardReadResult> => {
    if (site.current() === null) {
      return { status: "failed", reason: "no-site" };
    }
    const result =
      content.kind === "files"
        ? await importMedia.files(content.paths)
        : importMedia.image({ fileName: `${t("site.media.pastedImage")}.png`, data: content.png });
    if (result.status === "failed") return result;
    if (result.status === "canceled") return { status: "empty" };
    return { status: "media", items: result.items, rejected: result.rejected };
  };

  return {
    async write(elements: CopiedElements): Promise<ClipboardWriteResult> {
      if (site.current() === null) {
        return { status: "failed", reason: "no-site" };
      }
      try {
        mkdirSync(dir, { recursive: true });
        const media = elements.media.filter((item) => {
          if (!KEPT_FILE.test(item.hash)) return false;
          const path = join(dir, item.hash);
          if (existsSync(path)) return true;
          const blob = site.readMedia(item.hash);
          if (blob === undefined) return false;
          const temporary = join(dir, `.${item.hash}.${randomUUID()}.tmp`);
          writeFileSync(temporary, blob.data);
          renameSync(temporary, path);
          return true;
        });
        // The last copy's images go: the clipboard holds one copy at a time.
        const kept = new Set(media.map((item) => item.hash));
        for (const name of readdirSync(dir)) {
          if (!kept.has(name)) rmSync(join(dir, name), { force: true });
        }
        await system.writeElements(JSON.stringify({ nodes: elements.nodes, media }));
        return { status: "copied" };
      } catch (error) {
        logFailure("copy elements", error);
        return { status: "failed", reason: "unknown" };
      }
    },

    async read(): Promise<ClipboardReadResult> {
      let content: ClipboardContent;
      try {
        content = await system.read({
          elements: MAX_ELEMENTS_BYTES,
          files: MAX_FILE_LIST_BYTES,
          image: MAX_MEDIA_BYTES,
        });
      } catch {
        // Unreadable: nothing Webforge can paste.
        return { status: "empty" };
      }
      if (content.kind === "none") {
        return { status: "empty" };
      }
      if (content.kind !== "elements") {
        return pasteMedia(content);
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
          const stored = site.storeCopiedMedia(item, () => readKept(item));
          if (stored.status === "failed") return stored;
          if (stored.status === "stored") media.push(item);
        }
        return { status: "elements", elements: { nodes: copied.data.nodes, media } };
      } catch (error) {
        logFailure("paste elements", error);
        return { status: "failed", reason: "unknown" };
      }
    },
  };
}

/** The element clipboard. */
export type ElementClipboard = ReturnType<typeof createElementClipboard>;
