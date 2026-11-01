import { randomUUID } from "node:crypto";
import { basename, extname, resolve } from "node:path";
import { t } from "@webforge/i18n";
import {
  DEFAULT_EXPORT_CHOICES,
  type ExportChoices,
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
  ProjectFileError,
  type ProjectFileErrorCode,
  ProjectStore,
  ReadOnlyProjectError,
  SiteZipError,
  type StoredBlob,
  writeSiteZip,
} from "@webforge/storage";
import type {
  CommitResult,
  ProjectFailureReason,
  ProjectResult,
  ProjectSummary,
  ReadSiteResult,
  SaveSiteZipResult,
  SiteUiChange,
  SiteUiState,
  UiStateResult,
} from "../shared/ipc-contract.js";
import type { ImportSource, PrepareOutcome } from "../shared/storage-writer-protocol.js";
import { createImportJobs } from "../worker/store-import.js";
import { BUNDLE_MIME_TYPES } from "./bundle-download.js";
import { log, logFailure } from "./log.js";
import { type NewSiteFill, newSiteImporter } from "./new-site.js";
import {
  createInlineStorageWriter,
  type PreparedImport,
  type StorageWriter,
} from "./storage-writer.js";
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
 * The open site as one renderer's call may read or change it (R6, #663):
 * {@link ProjectSession.forSession}, the only way to its Media, its export choices and its copy as
 * a ZIP. Each method checks the session again, so a call that waited (for a dialog, the clipboard,
 * or an export) while a hand-off replaced the site reads and changes nothing in the new one.
 */
export type SessionSite = {
  /** The open site, or `null`. */
  current(): ProjectSummary | null;
  /** Why the call can't use the open site now (see {@link ProjectSession.staleReason}). */
  staleReason(): "no-site" | "stale-session" | undefined;
  /** The bytes of a Media file in the site, by hash; never a site document. */
  readMedia(hash: string): Promise<StoredBlob | undefined>;
  /** Imports a file as Media item `mediaId`'s asset (1.16, R13b). */
  importFile(mediaId: string, fileName: string, source: ImportSource): Promise<ImportFileResult>;
  /** Stores a pasted Media item's bytes, unless the site has them (1.25). */
  storeCopiedMedia(
    item: MediaMeta,
    read: () => Uint8Array | undefined,
  ): Promise<StoreAssetResult | { readonly status: "missing" }>;
  /** Stores files' bytes for the site's code, all or none (Download and bundle, 3.9). */
  storeBlobs(
    files: readonly { readonly data: Uint8Array; readonly mime: string }[],
  ): Promise<StoreBlobsResult>;
  /** What the person chose for the site's last export (3.3); the defaults once it isn't open. */
  exportChoices(): Promise<ExportChoices>;
  /** Remembers the person's export choices with the site; nothing once it isn't open. */
  setExportChoices(choices: ExportChoices): Promise<void>;
  /** Saves a copy of the site as a ZIP at `path` (4.7); `canceled` once it isn't open. */
  saveSiteZip(path: string): Promise<SaveSiteZipResult>;
};

/** What came of storing files' bytes in the open site: their hashes, in order, or why not. */
export type StoreBlobsResult =
  | { readonly status: "stored"; readonly hashes: readonly string[] }
  | {
      readonly status: "failed";
      readonly reason: "no-site" | "stale-session" | "read-only" | "unknown";
    };

/**
 * What came of importing a file into the open site (R13b): stored, with what the storage writer
 * learnt of it; not a file Media takes; not a file at all; or why it couldn't be stored.
 */
export type ImportFileResult =
  | ({ readonly status: "stored" } & Omit<PreparedImport, "status" | "token">)
  | Extract<PrepareOutcome, { status: "rejected" | "skipped" }>
  | Extract<StoreAssetResult, { status: "failed" }>;

/** Where an imported file's bytes come from: a file the main process found, or bytes. */
export type { ImportSource };

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

/** What a {@link ProjectSession} is made with, injectable for tests. */
export type ProjectSessionOptions = {
  /** Who may use the open site's file when: the main process, or the storage writer (R13b). */
  readonly gate?: StoreGate;
  /** Opens a site's file; `ProjectStore.open` unless a test wraps it. */
  readonly openStore?: (path: string) => ProjectStore;
  /** Creates a site's file; `ProjectStore.create` unless a test wraps it. */
  readonly createStore?: (path: string, name: string) => ProjectStore;
  /**
   * Stores imports off the main thread (R13b, ADR 0013): the storage writer thread in the app.
   * Without one, imports are stored on the calling thread, as in tests.
   */
  readonly writer?: StorageWriter;
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
  readonly #writer: StorageWriter;
  /** The import the storage writer is writing to the open site's file now, holding the gate. */
  #writing: object | undefined;

  constructor(events: ProjectSessionEvents = {}, options: ProjectSessionOptions = {}) {
    this.#events = events;
    this.#gate = options.gate ?? createStoreGate();
    this.#openStore = options.openStore ?? ((path) => ProjectStore.open(path));
    this.#createStore =
      options.createStore ?? ((path, name) => ProjectStore.create(path, { name }));
    this.#writer = options.writer ?? createInlineStorageWriter(createImportJobs());
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
   * The open site's project id, which stays with its file (copies too), or `undefined` when none
   * is open. What's kept for the site on this computer is kept under it: its backups, the code its
   * owner trusts (#649).
   */
  projectId(): string | undefined {
    return this.#store?.info.projectId;
  }

  /**
   * The open site for a call from a renderer loaded for opening `sessionId` (R6): it reads no Media
   * bytes and stores nothing once another site has opened, however long the call waited before it
   * did (for a dialog, the clipboard, or the gate), and says why (`stale-session`). An export or a
   * preview takes it once, when it starts, and reads its Media through it (#663).
   */
  forSession(sessionId: string): SessionSite {
    return {
      current: () => this.current(),
      staleReason: () => this.staleReason(sessionId),
      readMedia: (hash) => this.#readMedia(hash, sessionId),
      importFile: (mediaId, fileName, source) =>
        this.#importFile(mediaId, fileName, source, sessionId),
      storeCopiedMedia: (item, read) => this.#storeCopiedMedia(item, read, sessionId),
      storeBlobs: (files) => this.#storeBlobs(files, sessionId),
      exportChoices: () => this.#exportChoices(sessionId),
      setExportChoices: (choices) => this.#setExportChoices(choices, sessionId),
      saveSiteZip: (path) => this.#saveSiteZip(path, sessionId),
    };
  }

  /**
   * The bytes of a Media file in whichever site is open, by hash: for the `media://` protocol only,
   * whose addresses name a file by its hash, not by the opening (1.16). A page that outlived its
   * site gets the next one's file of that hash at most, read-only, until it reloads.
   */
  readOpenMedia(hash: string): Promise<StoredBlob | undefined> {
    return this.#readMedia(hash);
  }

  /**
   * Creates a site at `path` (adding `.wforge` if missing), named after the file, and opens it.
   * An existing file at `path` is replaced; the save dialog has already asked the user.
   *
   * New Site (2.14a) gives `newSite`: the site's name as typed, and `fill`, which writes its
   * pages, theme and Media into the new file before it opens, its images through the storage
   * writer. A fill that fails closes the file, and the open site stays open.
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
    const made = await this.#newStore(target, name, newSite).then(
      (store) => ({ store }),
      (error: unknown) => ({ error }),
    );
    const result = await this.#replaceWith(target, () => {
      if ("error" in made) throw made.error;
      return made.store;
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

  /** A new site's file at `path`, filled as New Site asked, if it did; closed again if that fails. */
  async #newStore(path: string, name: string, newSite?: NewSiteFill): Promise<ProjectStore> {
    const store = this.#createStore(path, name);
    if (newSite === undefined) return store;
    try {
      await newSite.fill({
        store,
        importFile: newSiteImporter(this.#writer, path),
      });
    } catch (error) {
      store.close();
      throw error;
    }
    return store;
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
   * Saves a copy of the open site as a ZIP at `path` (4.7, F-SITE-5), a file the person chose. The
   * site is read on the gate's shared side, so it can't close meanwhile, all at once, so the copy
   * is the site as it was then, whatever is saved while the ZIP is written.
   *
   * Never over the open site's own file or the files SQLite keeps beside it: on macOS and Linux
   * the ZIP's rename would replace the database the site is saved to (`own-file`). Once another
   * site has opened than session `sessionId`'s, nothing is saved (`canceled`, #663): the person
   * asked for a copy of the one that has gone.
   */
  #saveSiteZip(path: string, sessionId: string): Promise<SaveSiteZipResult> {
    if (this.staleReason(sessionId) === "stale-session") {
      return Promise.resolve({ status: "canceled" });
    }
    const open = this.#path;
    if (
      open !== undefined &&
      ["", "-wal", "-journal", "-shm"].some((suffix) => samePath(`${open}${suffix}`, path))
    ) {
      return Promise.resolve({ status: "failed", reason: "own-file" });
    }
    return this.#shared<SaveSiteZipResult>(
      async (store) => {
        try {
          await writeSiteZip(store, path);
          return { status: "saved", fileName: basename(path) };
        } catch (error) {
          if (error instanceof SiteZipError && error.code === "too-large") {
            return { status: "failed", reason: "too-large" };
          }
          logFailure("Webforge could not save a copy of a site as a ZIP", error);
          return { status: "failed", reason: "unknown" };
        }
      },
      (reason) =>
        reason === "stale-session" ? { status: "canceled" } : { status: "failed", reason },
      sessionId,
    );
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

  /** The open site's editor state, or `null` without an open site. */
  uiState(): Promise<SiteUiState | null> {
    return this.#shared<SiteUiState | null>(
      (store) => ({
        editorMode: store.readEditorMode(),
        siteCheckIgnored: store.readSiteCheckIgnored(),
      }),
      () => null,
    );
  }

  /**
   * What the person chose for the last export of session `sessionId`'s site (3.3); the defaults
   * without a site, or once another has opened.
   */
  #exportChoices(sessionId: string): Promise<ExportChoices> {
    return this.#shared<ExportChoices>(
      (store) => store.readExportChoices(),
      () => DEFAULT_EXPORT_CHOICES,
      sessionId,
    );
  }

  /**
   * Remembers what the person chose for an export with session `sessionId`'s site, like the editor
   * state; never with another that has opened since (#663). A read-only site keeps its earlier
   * choices: that never stops the export.
   */
  #setExportChoices(choices: ExportChoices, sessionId: string): Promise<void> {
    return this.#shared<void>(
      (store) => {
        try {
          store.writeExportChoices(choices);
        } catch (error) {
          if (!(error instanceof ReadOnlyProjectError)) {
            logFailure("Webforge could not remember the export choices", error);
          }
        }
      },
      () => undefined,
      sessionId,
    );
  }

  /**
   * Remembers the parts of the editor state in `change` with the open site (not a site change:
   * never versioned).
   */
  setUiState(change: SiteUiChange, sessionId?: string): Promise<UiStateResult> {
    return this.#shared<UiStateResult>(
      (store) => {
        try {
          if (change.editorMode !== undefined) store.writeEditorMode(change.editorMode);
          if (change.siteCheckIgnored !== undefined) {
            store.writeSiteCheckIgnored(change.siteCheckIgnored);
          }
          return { status: "saved" };
        } catch (error) {
          if (error instanceof ReadOnlyProjectError) {
            return { status: "failed", reason: "read-only" };
          }
          logFailure("Webforge could not remember the editor state", error);
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

  /**
   * Closes the open site's store. Let in while the storage writer still writes (its time was up),
   * it stops the writer first: the import fails, and garbage collection removes its bytes.
   *
   * Garbage collection runs here, after the last save and with the file to itself (A1): every save
   * of a page leaves its previous JSON behind, as do undone imports and pastes, and Undo can no
   * longer bring any of it back. A read-only store (a newer format, once the editor can show one)
   * is left as it is. A failure is logged and the site still closes; the next close tries again.
   */
  async #closeNow(): Promise<void> {
    if (this.#writing !== undefined) {
      await this.#writer.stop();
    }
    if (this.#store !== undefined) {
      this.#events.closed?.();
      if (!this.#store.info.readOnly) {
        try {
          this.#store.collectGarbage();
        } catch (error) {
          logFailure("Webforge could not clean up a site file as it closed", error);
        }
      }
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
        // Media's files, and those kept for the site's code (3.9); never a site document.
        return blob !== undefined &&
          (MEDIA_MIME_TYPES.has(blob.mime) || BUNDLE_MIME_TYPES.has(blob.mime))
          ? blob
          : undefined;
      },
      () => undefined,
      sessionId,
    );
  }

  async #importFile(
    mediaId: string,
    fileName: string,
    source: ImportSource,
    sessionId?: string,
  ): Promise<ImportFileResult> {
    const stale = sessionId === undefined ? undefined : this.staleReason(sessionId);
    if (stale !== undefined) return { status: "failed", reason: stale };
    // First read, check and hash it, outside the gate: saves go on meanwhile, however slow the
    // file is to read (a network share), and a file that never opens holds up only its import.
    const prepared = await this.#writer.prepare(fileName, source);
    if (prepared.status === "failed") return this.#importFailed();
    if (prepared.status !== "prepared") return prepared;
    // Then store it alone, the bytes and the asset together: the main process's reads and saves
    // wait at the gate, as promises, and nothing of the import is written on its thread.
    const stored = await this.#gate.run<ImportFileResult | "stored" | "not-stored">(
      "exclusive",
      async () => {
        const path = this.#path;
        if (this.#store === undefined || path === undefined) {
          this.#writer.discard(prepared);
          return { status: "failed", reason: "no-site" };
        }
        if (sessionId !== undefined && sessionId !== this.#sessionId) {
          this.#writer.discard(prepared);
          return { status: "failed", reason: "stale-session" };
        }
        // Its own token: an import a close stopped can't clear the mark of the one after it.
        const writing = {};
        this.#writing = writing;
        try {
          const outcome = await this.#writer.store(prepared, {
            sitePath: path,
            mediaId,
            originalName: fileName,
          });
          return outcome.status === "stored" ? "stored" : "not-stored";
        } finally {
          if (this.#writing === writing) this.#writing = undefined;
        }
      },
    );
    if (stored === "not-stored") return this.#importFailed();
    if (stored !== "stored") return stored;
    const { token: _token, status: _status, ...facts } = prepared;
    return { status: "stored", ...facts };
  }

  #importFailed(): ImportFileResult {
    log.error("Webforge could not store an imported file");
    return { status: "failed", reason: "unknown" };
  }

  #storeBlobs(
    files: readonly { readonly data: Uint8Array; readonly mime: string }[],
    sessionId?: string,
  ): Promise<StoreBlobsResult> {
    return this.#shared<StoreBlobsResult>(
      (store) => {
        try {
          return {
            status: "stored",
            hashes: files.map(({ data, mime }) => store.putBlob(data, mime)),
          };
        } catch (error) {
          if (error instanceof ReadOnlyProjectError) {
            return { status: "failed", reason: "read-only" };
          }
          logFailure("Webforge could not store a downloaded file", error);
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
      async () => {
        await this.#closeNow();
        this.#store = store;
        this.#path = path;
        this.#sessionId = sessionId;
      },
      { waitMs: CLOSE_WAIT_MS },
    );
    // Ready for the first import, which then doesn't wait for a thread to start.
    this.#writer.warm();
    this.#events.opened?.(this.#accessTo(store), path);
    return { status: "opened", project: summarise(store, path, sessionId) };
  }

  /** Reaches `store` through the gate's shared side, while it is still the open one. */
  #accessTo(store: ProjectStore): SiteStoreAccess {
    return (work) =>
      this.#gate.run("shared", () => (this.#store === store ? work(store) : undefined));
  }
}
