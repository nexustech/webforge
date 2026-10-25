import { randomUUID } from "node:crypto";
import { basename, extname, resolve } from "node:path";
import { t } from "@webforge/i18n";
import {
  FILE_MIME_TYPES,
  IMAGE_MIME_TYPES,
  type MediaMeta,
  type SiteDoc,
  type SiteDocumentChange,
  SiteFormatError,
  validateSiteChanges,
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
import { log, logFailure } from "./log.js";
import { createStoreGate, type StoreGate } from "./store-gate.js";

/** The blob types a Media item's file can have; documents (JSON) are never served as media. */
const MEDIA_MIME_TYPES: ReadonlySet<string> = new Set([...IMAGE_MIME_TYPES, ...FILE_MIME_TYPES]);

/** Outcome of storing an imported file in the open site. */
export type StoreAssetResult =
  | { readonly status: "stored"; readonly hash: string }
  | {
      readonly status: "failed";
      readonly reason: "no-site" | "stale-session" | "read-only" | "unknown";
    };

/**
 * The open site as one renderer's call may change it (R6): {@link ProjectSession.forSession}. Each
 * method checks the session again, so a call that waited (for a dialog, or the clipboard) while a
 * hand-off replaced the site changes nothing in the new one.
 */
export type SessionSite = Pick<
  ProjectSession,
  "current" | "readMedia" | "storeAsset" | "storeCopiedMedia"
>;

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
  // The error's name and code say what went wrong; paths and file contents are never logged.
  logFailure("Webforge could not create or open a site", error);
  return {
    status: "failed",
    reason: error instanceof ProjectFileError ? FAILURE_REASONS[error.code] : "unknown",
  };
}

/**
 * Work with the open site's store while it holds the gate's shared side (R13b), for the main
 * process's other users of the file, such as backups. Gives `undefined` without running `work`
 * when the site it was given for has closed meanwhile.
 */
export type SiteStoreAccess = <T>(
  work: (store: ProjectStore) => T | Promise<T>,
) => Promise<T | undefined>;

/** What a {@link ProjectSession} tells others, e.g. the backup schedule. */
export type ProjectSessionEvents = {
  /** A site was opened or created; `access` reaches its store through the gate. */
  opened?(access: SiteStoreAccess, path: string): void;
  /** Changes to the open site were saved. */
  committed?(): void;
  /** The open site was closed. */
  closed?(): void;
};

/** How long closing the site waits for work on it before closing anyway (R13b). */
const CLOSE_WAIT_MS = 5_000;

/** What New Site makes of a new site (2.14a): its name, and what writes its content. */
export type NewSiteFill = {
  readonly name: string;
  readonly fill: (store: ProjectStore) => void;
};

/** What a {@link ProjectSession} is made with, injectable for tests. */
export type ProjectSessionOptions = {
  /** Who may use the open site's file when: the main process, or the storage writer (R13b). */
  readonly gate?: StoreGate;
  /** Opens a site's file; `ProjectStore.open` unless a test wraps it. */
  readonly openStore?: (path: string) => ProjectStore;
  /** Creates a site's file; `ProjectStore.create` unless a test wraps it. */
  readonly createStore?: (path: string, name: string) => ProjectStore;
};

/**
 * The site open in the main process. At most one site is open at a time; opening or creating
 * another replaces it only once the new one is open, so a failure keeps the current site.
 *
 * Every use of the open site's file goes through the store gate (R13b): reads and saves on its
 * shared side, closing on its exclusive side, after the work before it.
 */
export class ProjectSession {
  #store: ProjectStore | undefined;
  #path: string | undefined;
  /** The open site as last read or saved; commits are checked against it. */
  #site: SiteDoc | undefined;
  /** This opening of the open site (R6): new each time a site is opened or created. */
  #sessionId: string | undefined;
  readonly #events: ProjectSessionEvents;
  readonly #gate: StoreGate;
  readonly #openStore: (path: string) => ProjectStore;
  readonly #createStore: (path: string, name: string) => ProjectStore;

  constructor(events: ProjectSessionEvents = {}, options: ProjectSessionOptions = {}) {
    this.#events = events;
    this.#gate = options.gate ?? createStoreGate();
    this.#openStore = options.openStore ?? ((path) => ProjectStore.open(path));
    this.#createStore =
      options.createStore ?? ((path, name) => ProjectStore.create(path, { name }));
  }

  /** The open site's file, for the main process only (never sent to the renderer). */
  currentPath(): string | undefined {
    return this.#path;
  }

  /** The open site, or `null`. */
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
   * The open site for a call from a renderer loaded for opening `sessionId` (R6): it reads no Media
   * bytes and stores nothing once another site has opened, however long the call waited before it
   * did (for a dialog, the clipboard, or the gate), and says why (`stale-session`).
   */
  forSession(sessionId: string): SessionSite {
    return {
      current: () => this.current(),
      readMedia: (hash) => this.#readMedia(hash, sessionId),
      storeAsset: (asset) => this.#storeAsset(asset, sessionId),
      storeCopiedMedia: (item, read) => this.#storeCopiedMedia(item, read, sessionId),
    };
  }

  /**
   * Creates a site at `path` (adding `.wforge` if missing), named after the file, and opens it.
   * An existing file at `path` is replaced; the save dialog has already asked the user.
   *
   * New Site (2.14a) gives `newSite`: the site's name as typed, and `fill`, which writes its
   * pages, theme and Media into the new file before it opens. A fill that fails closes the file,
   * and the open site stays open.
   */
  async create(path: string, newSite?: NewSiteFill): Promise<ProjectResult> {
    const target = withProjectExtension(path);
    // The current site's file can't be replaced while it is open: it is closed first, and opened
    // again, as the same opening, if the new site can't be made.
    const replaced =
      this.#path !== undefined && samePath(this.#path, target)
        ? { path: this.#path, sessionId: this.#sessionId }
        : undefined;
    if (replaced !== undefined) {
      await this.close();
    }
    const name =
      newSite?.name ?? (basename(target, extname(target)).trim() || t("site.untitledName"));
    const result = await this.#replaceWith(target, () => {
      const store = this.#createStore(target, name);
      try {
        newSite?.fill(store);
      } catch (error) {
        store.close();
        throw error;
      }
      return store;
    });
    if (result.status === "failed" && replaced !== undefined) {
      await this.#replaceWith(
        replaced.path,
        () => this.#openStore(replaced.path),
        replaced.sessionId,
      );
    }
    return result;
  }

  /** Opens the site at `path`. */
  open(path: string): Promise<ProjectResult> {
    return this.#replaceWith(path, () => {
      const store = this.#openStore(path);
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
  readSite(): Promise<ReadSiteResult> {
    return this.#shared<ReadSiteResult>(
      (store) => this.#readSiteFrom(store),
      () => ({ status: "none" }),
    );
  }

  /**
   * Saves changed documents in one transaction, but only if they leave a valid site: the renderer
   * is not trusted to send a consistent one. The changes apply to the site last read or saved.
   * `sessionId`, when given, must still be the open site's once the gate lets the save in (R6).
   */
  commit(changes: readonly SiteDocumentChange[], sessionId?: string): Promise<CommitResult> {
    return this.#shared<CommitResult>(
      (store) => {
        // Changes always build on the stored site; read it first if the editor hasn't yet.
        if (this.#site === undefined && !store.isEmpty()) {
          if (this.#readSiteFrom(store).status !== "ok") {
            return { status: "failed", reason: "invalid" };
          }
        }
        // Only the changed documents are parsed: the rest passed when it was read or saved.
        const next = validateSiteChanges(this.#site, changes);
        if (!next.success) {
          log.error("Webforge refused changes that would break the site");
          return { status: "failed", reason: "invalid" };
        }
        try {
          store.commit(changes);
        } catch (error) {
          if (error instanceof ReadOnlyProjectError) {
            return { status: "failed", reason: "read-only" };
          }
          logFailure("Webforge could not save the site", error);
          return { status: "failed", reason: "unknown" };
        }
        this.#site = next.data;
        this.#events.committed?.();
        return { status: "saved" };
      },
      (reason) => ({ status: "failed", reason }),
      sessionId,
    );
  }

  /**
   * Stores an imported file's original bytes, unmodified, as a Media item's asset (1.16). The item
   * itself joins the site when the renderer commits it; until then, and after an Undo, garbage
   * collection at the next open or close removes the unused bytes again.
   */
  storeAsset(asset: NewAsset): Promise<StoreAssetResult> {
    return this.#storeAsset(asset);
  }

  /**
   * Stores a pasted Media item's bytes (1.25) unless the open site already has them under its id
   * and hash. `read` gives the bytes kept with the clipboard, only when they are needed;
   * `"missing"` when neither it nor the site has them. Like an import, the item joins the site when
   * the renderer commits the paste.
   */
  storeCopiedMedia(
    item: MediaMeta,
    read: () => Uint8Array | undefined,
  ): Promise<StoreAssetResult | { readonly status: "missing" }> {
    return this.#storeCopiedMedia(item, read);
  }

  /** The bytes of a Media file in the open site, by hash; never a site document. */
  readMedia(hash: string): Promise<StoredBlob | undefined> {
    return this.#readMedia(hash);
  }

  /** The open site's editor state, or `null` without an open site. */
  uiState(): Promise<SiteUiState | null> {
    return this.#shared<SiteUiState | null>(
      (store) => ({ editorMode: store.readEditorMode() }),
      () => null,
    );
  }

  /** Remembers the editor state with the open site (not a site change: never versioned). */
  setUiState(state: SiteUiState, sessionId?: string): Promise<UiStateResult> {
    return this.#shared<UiStateResult>(
      (store) => {
        try {
          store.writeEditorMode(state.editorMode);
          return { status: "saved" };
        } catch (error) {
          if (error instanceof ReadOnlyProjectError) {
            return { status: "failed", reason: "read-only" };
          }
          logFailure("Webforge could not remember the editor mode", error);
          return { status: "failed", reason: "unknown" };
        }
      },
      (reason) => ({ status: "failed", reason }),
      sessionId,
    );
  }

  /**
   * Closes the open site, if any, once the work before it on the file is done; work that takes
   * longer than {@link CLOSE_WAIT_MS} doesn't hold it up (R13b).
   */
  close(): Promise<void> {
    return this.#gate.run("exclusive", () => this.#closeNow(), { waitMs: CLOSE_WAIT_MS });
  }

  #closeNow(): void {
    if (this.#store !== undefined) {
      this.#events.closed?.();
    }
    this.#store?.close();
    this.#store = undefined;
    this.#path = undefined;
    this.#site = undefined;
    this.#sessionId = undefined;
  }

  /**
   * Runs `work` with the open store on the gate's shared side, or gives `none(reason)` when no site
   * is open, or the one opened for `sessionId` no longer is, by the time the gate lets it in.
   */
  #shared<T>(
    work: (store: ProjectStore) => T | Promise<T>,
    none: (reason: "no-site" | "stale-session") => T,
    sessionId?: string,
  ): Promise<T> {
    return this.#gate.run("shared", () => {
      const store = this.#store;
      if (store === undefined) return none("no-site");
      if (sessionId !== undefined && sessionId !== this.#sessionId) return none("stale-session");
      return work(store);
    });
  }

  /** The site in `store`, kept as the one commits build on. Inside the gate only. */
  #readSiteFrom(store: ProjectStore): ReadSiteResult {
    if (store.isEmpty()) {
      this.#site = undefined;
      return { status: "empty" };
    }
    try {
      this.#site = store.readSite();
      return { status: "ok", site: this.#site };
    } catch (error) {
      // Paths and site content stay out of the log; the code says enough.
      if (error instanceof SiteFormatError || error instanceof ProjectFileError) {
        logFailure("Webforge could not read the site", error);
        return {
          status: "failed",
          reason: error instanceof SiteFormatError ? error.code : "invalid",
        };
      }
      throw error;
    }
  }

  #readMedia(hash: string, sessionId?: string): Promise<StoredBlob | undefined> {
    return this.#shared(
      (store) => {
        const blob = store.readBlob(hash);
        return blob !== undefined && MEDIA_MIME_TYPES.has(blob.mime) ? blob : undefined;
      },
      () => undefined,
      sessionId,
    );
  }

  #storeAsset(asset: NewAsset, sessionId?: string): Promise<StoreAssetResult> {
    return this.#shared<StoreAssetResult>(
      (store) => {
        try {
          return { status: "stored", hash: store.putAsset(asset).hash };
        } catch (error) {
          if (error instanceof ReadOnlyProjectError) {
            return { status: "failed", reason: "read-only" };
          }
          logFailure("Webforge could not store an imported file", error);
          return { status: "failed", reason: "unknown" };
        }
      },
      (reason) => ({ status: "failed", reason }),
      sessionId,
    );
  }

  #storeCopiedMedia(
    item: MediaMeta,
    read: () => Uint8Array | undefined,
    sessionId?: string,
  ): Promise<StoreAssetResult | { readonly status: "missing" }> {
    return this.#shared<StoreAssetResult | { readonly status: "missing" }>(
      (store) => {
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
          logFailure("Webforge could not store a pasted file", error);
          return { status: "failed", reason: "unknown" };
        }
      },
      (reason) => ({ status: "failed", reason }),
      sessionId,
    );
  }

  /**
   * Opens the store `openStore` makes in place of the open one, as opening `sessionId`. The new
   * store is opened first, outside the gate (no one else knows it yet); the swap waits for the
   * work on the old one, like closing.
   */
  async #replaceWith(
    path: string,
    openStore: () => ProjectStore,
    sessionId: string = randomUUID(),
  ): Promise<ProjectResult> {
    let store: ProjectStore;
    try {
      store = openStore();
    } catch (error) {
      return failure(error);
    }
    await this.#gate.run(
      "exclusive",
      () => {
        this.#closeNow();
        this.#store = store;
        this.#path = path;
        this.#sessionId = sessionId;
      },
      { waitMs: CLOSE_WAIT_MS },
    );
    this.#events.opened?.(this.#accessTo(store), path);
    return { status: "opened", project: summarise(store, path, sessionId) };
  }

  /** Reaches `store` through the gate's shared side, while it is still the open one. */
  #accessTo(store: ProjectStore): SiteStoreAccess {
    return (work) =>
      this.#gate.run("shared", () => (this.#store === store ? work(store) : undefined));
  }
}
