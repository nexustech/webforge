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
import { type CopiedElements, copiedElementsSchema, type MediaMeta } from "@webforge/model";
import type { ClipboardReadResult, ClipboardWriteResult } from "../shared/ipc/clipboard.js";
import type { ProjectSession } from "./project-session.js";

/**
 * Webforge's own format on the system clipboard: copied elements, as JSON. Electron's clipboard
 * keeps a custom format only as a web custom format ("web " and a MIME type).
 */
const ELEMENTS_FORMAT = "web application/x-webforge-elements";

/** The most bytes of copied elements read back, so a huge clipboard can't hold the app up. */
const MAX_ELEMENTS_BYTES = 10 * 1024 * 1024;

/** A file the clipboard keeps aside: an image's bytes, named by their SHA-256 hash. */
const KEPT_FILE = /^[0-9a-f]{64}$/;

/** The system clipboard, as the element clipboard uses it: copied elements in Webforge's format. */
export type SystemClipboard = {
  /** Replaces the clipboard's content with copied elements. */
  writeElements(json: string): Promise<void>;
  /** The copied elements on the clipboard, or `undefined` if it holds none (or too many bytes). */
  readElements(maxBytes: number): Promise<string | undefined>;
};

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
    async readElements(maxBytes) {
      for (const item of await clipboard.read()) {
        if (!item.types.includes(ELEMENTS_FORMAT)) continue;
        const blob = await item.getType(ELEMENTS_FORMAT);
        if (!(blob instanceof Blob) || blob.size > maxBytes) return undefined;
        return blob.text();
      }
      return undefined;
    },
  };
}

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
 * them with their images. Nothing but those bytes is written there.
 */
export function createElementClipboard(system: SystemClipboard, dir: string, site: ClipboardSite) {
  /** The kept bytes of `item`, if they are still there and unchanged. */
  const readKept = (item: MediaMeta): Uint8Array | undefined => {
    const path = join(dir, item.hash);
    if (!KEPT_FILE.test(item.hash) || !existsSync(path)) return undefined;
    const data = readFileSync(path);
    return sha256(data) === item.hash ? data : undefined;
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
      let parsed: unknown;
      try {
        const json = await system.readElements(MAX_ELEMENTS_BYTES);
        if (json === undefined) return { status: "empty" };
        parsed = JSON.parse(json);
      } catch {
        // Unreadable or not JSON: not Webforge's elements.
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
