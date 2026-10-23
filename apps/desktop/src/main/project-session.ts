import { randomUUID } from "node:crypto";
import { basename, extname, resolve } from "node:path";
import { t } from "@webforge/i18n";
import {
  applySiteChanges,
  FILE_MIME_TYPES,
  IMAGE_MIME_TYPES,
  type MediaMeta,
  type SiteDoc,
  type SiteDocumentChange,
  SiteFormatError,
  siteDocSchema,
} from "@webforge/model";
import {
  detectSyncFolder,
  type NewAsset,
  ProjectFileError,
  type ProjectFileErrorCode,
  ProjectStore,
  ReadOnlyProjectError,
  type StoredBlob,
} from "@webforge/storage";
import type {
  CommitResult,
  ProjectFailureReason,
  ProjectResult,
  ProjectSummary,
  ReadSiteResult,
  SiteUiState,
  UiStateResult,
} from "../shared/ipc-contract.js";

/** The blob types a Media item's file can have; documents (JSON) are never served as media. */
const MEDIA_MIME_TYPES: ReadonlySet<string> = new Set([...IMAGE_MIME_TYPES, ...FILE_MIME_TYPES]);

/** Outcome of storing an imported file in the open site. */
export type StoreAssetResult =
  | { readonly status: "stored"; readonly hash: string }
  | { readonly status: "failed"; readonly reason: "no-site" | "read-only" | "unknown" };

/** File extension of a Webforge site (P1). */
export const PROJECT_EXTENSION = ".wforge";

const FAILURE_REASONS = {
  "not-found": "not-found",
  "not-a-project": "not-a-project",
  corrupt: "corrupt",
  "unexpected-schema": "unexpected-schema",
  "newer-format": "newer-format",
} as const satisfies Record<ProjectFileErrorCode, ProjectFailureReason>;

/** Adds `.wforge` unless the path already ends with it (any letter case). */
export function withProjectExtension(path: string): string {
  return extname(path).toLowerCase() === PROJECT_EXTENSION ? path : `${path}${PROJECT_EXTENSION}`;
}

/**
 * The `.wforge` file passed on the command line: on Windows, double-clicking a site starts
 * Webforge with its path (P1 file association). macOS sends the app's `open-file` event instead.
 * Switches such as `--inspect` are skipped.
 */
export function findProjectArgument(argv: readonly string[]): string | undefined {
  return argv
    .slice(1)
    .find((arg) => !arg.startsWith("-") && extname(arg).toLowerCase() === PROJECT_EXTENSION);
}

/** Whether two paths name the same file (case-insensitively on Windows). */
export function samePath(a: string, b: string): boolean {
  const normalise = (path: string) =>
    process.platform === "win32" ? resolve(path).toLowerCase() : resolve(path);
  return normalise(a) === normalise(b);
}

function summarise(store: ProjectStore, path: string, sessionId: string): ProjectSummary {
  const { name, formatVersion } = store.info;
  return {
    sessionId,
    name,
    fileName: basename(path),
    formatVersion,
    syncService: detectSyncFolder(path) ?? null,
  };
}

function failure(error: unknown): ProjectResult {
  if (error instanceof ProjectFileError) {
    // The code says what went wrong; paths and file contents are never logged.
    console.error(`Webforge could not create or open a site (${error.code})`);
    return { status: "failed", reason: FAILURE_REASONS[error.code] };
  }
  const code = error instanceof Error && "code" in error ? String(error.code) : "no code";
  console.error(`Webforge could not open or create a site (${code})`);
  return { status: "failed", reason: "unknown" };
}

/** What a {@link ProjectSession} tells others, e.g. the backup schedule. */
export type ProjectSessionEvents = {
  /** A site was opened or created. */
  opened?(store: ProjectStore, path: string): void;
  /** Changes to the open site were saved. */
  committed?(): void;
  /** The open site was closed. */
  closed?(): void;
};

/**
 * The site open in the main process. At most one site is open at a time; opening or creating
 * another replaces it only once the new one is open, so a failure keeps the current site.
 */
export class ProjectSession {
  #store: ProjectStore | undefined;
  #path: string | undefined;
  /** The open site as last read or saved; commits are checked against it. */
  #site: SiteDoc | undefined;
  /** This opening of the open site (R6): new each time a site is opened or created. */
  #sessionId: string | undefined;
  readonly #events: ProjectSessionEvents;

  constructor(events: ProjectSessionEvents = {}) {
    this.#events = events;
  }

  /** The open site, or `null`. */
  /** The open site's file, for the main process only (never sent to the renderer). */
  currentPath(): string | undefined {
    return this.#path;
  }

  current(): ProjectSummary | null {
    return this.#store === undefined || this.#path === undefined || this.#sessionId === undefined
      ? null
      : summarise(this.#store, this.#path, this.#sessionId);
  }

  /**
   * Why a call from a renderer loaded for opening `sessionId` can't change the open site: none is
   * open, or another one has opened since (`stale-session`, R6), as when a hand-off replaced the
   * site while a save was on its way. `undefined`: it is the open site's.
   */
  staleReason(sessionId: string): "no-site" | "stale-session" | undefined {
    if (this.#store === undefined) return "no-site";
    return sessionId === this.#sessionId ? undefined : "stale-session";
  }

  /**
   * Creates a site at `path` (adding `.wforge` if missing), named after the file, and opens it.
   * An existing file at `path` is replaced; the save dialog has already asked the user.
   */
  create(path: string): ProjectResult {
    const target = withProjectExtension(path);
    // The current site's file can't be replaced while it is open: it is closed first, and opened
    // again, as the same opening, if the new site can't be made.
    const replaced =
      this.#path !== undefined && samePath(this.#path, target)
        ? { path: this.#path, sessionId: this.#sessionId }
        : undefined;
    if (replaced !== undefined) {
      this.close();
    }
    const name = basename(target, extname(target)).trim() || t("site.untitledName");
    const result = this.#replaceWith(target, () => ProjectStore.create(target, { name }));
    if (result.status === "failed" && replaced !== undefined) {
      this.#replaceWith(replaced.path, () => ProjectStore.open(replaced.path), replaced.sessionId);
    }
    return result;
  }

  /** Opens the site at `path`. */
  open(path: string): ProjectResult {
    return this.#replaceWith(path, () => {
      const store = ProjectStore.open(path);
      // The storage opens newer files read-only; until the editor can show a read-only site, the
      // user gets the "update Webforge" message instead.
      if (store.info.newerFormat) {
        store.close();
        throw new ProjectFileError("newer-format", "The site comes from a newer Webforge");
      }
      return store;
    });
  }

  /**
   * The open site's documents as one validated site. A new site has no documents yet (`empty`):
   * the editor creates its first pages, with starter content and translated titles, and commits
   * them.
   */
  readSite(): ReadSiteResult {
    const store = this.#store;
    if (store === undefined) {
      return { status: "none" };
    }
    if (store.isEmpty()) {
      this.#site = undefined;
      return { status: "empty" };
    }
    try {
      this.#site = store.readSite();
      return { status: "ok", site: this.#site };
    } catch (error) {
      // Paths and site content stay out of the log; the code says enough.
      if (error instanceof SiteFormatError) {
        console.error(`Webforge could not read the site (${error.code})`);
        return { status: "failed", reason: error.code };
      }
      if (error instanceof ProjectFileError) {
        console.error(`Webforge could not read the site (${error.code})`);
        return { status: "failed", reason: "invalid" };
      }
      throw error;
    }
  }

  /**
   * Saves changed documents in one transaction, but only if they leave a valid site: the renderer
   * is not trusted to send a consistent one. The changes apply to the site last read or saved.
   */
  commit(changes: readonly SiteDocumentChange[]): CommitResult {
    const store = this.#store;
    if (store === undefined) {
      return { status: "failed", reason: "no-site" };
    }
    // Changes always build on the stored site; read it first if the editor hasn't yet.
    if (this.#site === undefined && !store.isEmpty()) {
      if (this.readSite().status !== "ok") {
        return { status: "failed", reason: "invalid" };
      }
    }
    const next = siteDocSchema.safeParse(applySiteChanges(this.#site, changes));
    if (!next.success) {
      console.error("Webforge refused changes that would break the site");
      return { status: "failed", reason: "invalid" };
    }
    try {
      store.commit(changes);
    } catch (error) {
      if (error instanceof ReadOnlyProjectError) {
        return { status: "failed", reason: "read-only" };
      }
      const code = error instanceof Error && "code" in error ? String(error.code) : "no code";
      console.error(`Webforge could not save the site (${code})`);
      return { status: "failed", reason: "unknown" };
    }
    this.#site = next.data;
    this.#events.committed?.();
    return { status: "saved" };
  }

  /**
   * Stores an imported file's original bytes, unmodified, as a Media item's asset (1.16). The item
   * itself joins the site when the renderer commits it; until then, and after an Undo, garbage
   * collection at the next open or close removes the unused bytes again.
   */
  storeAsset(asset: NewAsset): StoreAssetResult {
    const store = this.#store;
    if (store === undefined) {
      return { status: "failed", reason: "no-site" };
    }
    try {
      return { status: "stored", hash: store.putAsset(asset).hash };
    } catch (error) {
      if (error instanceof ReadOnlyProjectError) {
        return { status: "failed", reason: "read-only" };
      }
      const code = error instanceof Error && "code" in error ? String(error.code) : "no code";
      console.error(`Webforge could not store an imported file (${code})`);
      return { status: "failed", reason: "unknown" };
    }
  }

  /**
   * Stores a pasted Media item's bytes (1.25) unless the open site already has them under its id
   * and hash. `read` gives the bytes kept with the clipboard, only when they are needed;
   * `"missing"` when neither it nor the site has them. Like an import, the item joins the site when the renderer
   * commits the paste.
   */
  storeCopiedMedia(
    item: MediaMeta,
    read: () => Uint8Array | undefined,
  ): StoreAssetResult | { readonly status: "missing" } {
    const store = this.#store;
    if (store === undefined) {
      return { status: "failed", reason: "no-site" };
    }
    const hasAsset = store.readAsset(item.id) !== undefined;
    if (hasAsset && store.hasBlob(item.hash)) {
      return { status: "stored", hash: item.hash };
    }
    // The kept bytes, else the same bytes this site already has under another item.
    const data = read() ?? store.readBlob(item.hash)?.data;
    if (data === undefined) {
      return { status: "missing" };
    }
    try {
      // An item of this site keeps its own asset (it may have been replaced since the copy).
      if (hasAsset) {
        store.putBlob(data, item.mimeType);
      } else {
        store.putAsset({
          mediaId: item.id,
          data,
          mime: item.mimeType,
          width: item.kind === "image" ? item.width : undefined,
          height: item.kind === "image" ? item.height : undefined,
          originalName: item.fileName,
        });
      }
      return { status: "stored", hash: item.hash };
    } catch (error) {
      if (error instanceof ReadOnlyProjectError) {
        return { status: "failed", reason: "read-only" };
      }
      const code = error instanceof Error && "code" in error ? String(error.code) : "no code";
      console.error(`Webforge could not store a pasted file (${code})`);
      return { status: "failed", reason: "unknown" };
    }
  }

  /** The bytes of a Media file in the open site, by hash; never a site document. */
  readMedia(hash: string): StoredBlob | undefined {
    const blob = this.#store?.readBlob(hash);
    return blob !== undefined && MEDIA_MIME_TYPES.has(blob.mime) ? blob : undefined;
  }

  /** The open site's editor state, or `null` without an open site. */
  uiState(): SiteUiState | null {
    return this.#store === undefined ? null : { editorMode: this.#store.readEditorMode() };
  }

  /** Remembers the editor state with the open site (not a site change: never versioned). */
  setUiState(state: SiteUiState): UiStateResult {
    const store = this.#store;
    if (store === undefined) {
      return { status: "failed", reason: "no-site" };
    }
    try {
      store.writeEditorMode(state.editorMode);
      return { status: "saved" };
    } catch (error) {
      if (error instanceof ReadOnlyProjectError) {
        return { status: "failed", reason: "read-only" };
      }
      const code = error instanceof Error && "code" in error ? String(error.code) : "no code";
      console.error(`Webforge could not remember the editor mode (${code})`);
      return { status: "failed", reason: "unknown" };
    }
  }

  /** Closes the open site, if any. */
  close(): void {
    if (this.#store !== undefined) {
      this.#events.closed?.();
    }
    this.#store?.close();
    this.#store = undefined;
    this.#path = undefined;
    this.#site = undefined;
    this.#sessionId = undefined;
  }

  /** Opens the store `openStore` makes in place of the open one, as opening `sessionId`. */
  #replaceWith(
    path: string,
    openStore: () => ProjectStore,
    sessionId: string = randomUUID(),
  ): ProjectResult {
    let store: ProjectStore;
    try {
      store = openStore();
    } catch (error) {
      return failure(error);
    }
    this.close();
    this.#store = store;
    this.#path = path;
    this.#sessionId = sessionId;
    this.#events.opened?.(store, path);
    return { status: "opened", project: summarise(store, path, sessionId) };
  }
}
