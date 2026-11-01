import { randomUUID } from "node:crypto";
import { basename, extname } from "node:path";
import { t } from "@webforge/i18n";
import {
  type ExportChoices,
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
  type StoredBlob,
} from "@webforge/storage";
import type {
  DeleteVersionResult,
  ListVersionsResult,
  ReadVersionSiteResult,
  SaveVersionResult,
} from "../shared/ipc/versions.js";
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
import { createWriterJobs } from "../worker/writer-jobs.js";
import { localDay, takeDailyVersion } from "./daily-version.js";
import { setUiState, uiState } from "./editor-state.js";
import { exportChoices, setExportChoices } from "./export-choices.js";
import { log, logFailure } from "./log.js";
import { type NewSiteFill, newSiteImporter } from "./new-site.js";
import {
  type ImportFileResult,
  type ImportSource,
  importFile,
  readMedia,
  type StoreAssetResult,
  type StoreBlobsResult,
  storeBlobs,
  storeCopiedMedia,
} from "./site-media.js";
import { samePath, withProjectExtension } from "./site-paths.js";
import { type SiteStore, type StaleReason, storeFailure } from "./site-store.js";
import {
  deleteVersion,
  listVersions,
  readVersionSite,
  saveVersion,
  type VersionPackageResult,
  type VersionToSave,
  versionPackage,
} from "./site-versions.js";
import { saveSiteZip } from "./site-zip.js";
import { createInlineStorageWriter, type StorageWriter } from "./storage-writer.js";
import { createStoreGate, type GateKind, type StoreGate } from "./store-gate.js";

/**
 * The open site as one renderer's call may read or change it (R6, #663):
 * {@link ProjectSession.forSession}, the only way to its Media, its export choices and its copy as
 * a ZIP. Each method checks the session again, so a call that waited (for a dialog, the clipboard,
 * or an export) while a hand-off replaced the site reads and changes nothing in the new one. Each is
 * an operation of its own module on {@link ProjectSession.site} (A13).
 */
export type SessionSite = {
  /** The open site, or `null`. */
  current(): ProjectSummary | null;
  /** Why the call can't use the open site now (see {@link ProjectSession.staleReason}). */
  staleReason(): StaleReason | undefined;
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
  /** The site's versions and the space they take (4.6). */
  listVersions(): Promise<ListVersionsResult>;
  /** Saves the site's file as it is as a version (4.6). */
  saveVersion(version: VersionToSave): Promise<SaveVersionResult>;
  /** Deletes a version (4.6). */
  deleteVersion(id: string): Promise<DeleteVersionResult>;
  /** A version's site, to preview or restore it (4.6). */
  readVersionSite(id: string): Promise<ReadVersionSiteResult>;
  /** A version as a site of its own, to open as a new site (4.6, P5). */
  versionPackage(id: string): Promise<VersionPackageResult>;
};

const FAILURE_REASONS = {
  "not-found": "not-found",
  "not-a-project": "not-a-project",
  corrupt: "corrupt",
  "unexpected-schema": "unexpected-schema",
  "newer-format": "newer-format",
} as const satisfies Record<ProjectFileErrorCode, ProjectFailureReason>;

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

/**
 * What a {@link ProjectSession} tells its listeners, e.g. the backup schedule and the app's
 * features (A12).
 */
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

/**
 * How long the storage writer may clean a closing site's file up before it is stopped, so a writer
 * that doesn't answer can't hold up opening the next site (#664). SQLite rolls back what it had
 * done the next time the file opens. Stopping can't cut a statement short, so `SiteFileWriter`
 * VACUUMs only a file small enough to finish well inside this.
 */
export const CLEAN_UP_WAIT_MS = 5_000;

/** What a {@link ProjectSession} is made with, injectable for tests. */
export type ProjectSessionOptions = {
  /** Who may use the open site's file when: the main process, or the storage writer (R13b). */
  readonly gate?: StoreGate;
  /** Opens a site's file; `ProjectStore.open` unless a test wraps it. */
  readonly openStore?: (path: string) => ProjectStore;
  /**
   * Saves the daily version before the first change of the day (F-SITE-4), keeping `kept()` of
   * Webforge's own versions; none without it, as in most tests.
   */
  readonly dailyVersion?: { readonly kept: () => number };
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
  /** The listeners, in the order they were added; see {@link ProjectSession.listen}. */
  readonly #listeners: ProjectSessionEvents[];
  readonly #gate: StoreGate;
  readonly #openStore: (path: string) => ProjectStore;
  readonly #createStore: (path: string, name: string) => ProjectStore;
  readonly #writer: StorageWriter;
  readonly #dailyVersion: ProjectSessionOptions["dailyVersion"];
  /** The opening and day the daily version was last looked for: one look a day, not a commit. */
  #dailyChecked: string | undefined;
  /** The import the storage writer is writing to the open site's file now, holding the gate. */
  #writing: object | undefined;

  constructor(events: ProjectSessionEvents = {}, options: ProjectSessionOptions = {}) {
    this.#listeners = [events];
    this.#gate = options.gate ?? createStoreGate();
    this.#openStore = options.openStore ?? ((path) => ProjectStore.open(path));
    this.#createStore =
      options.createStore ?? ((path, name) => ProjectStore.create(path, { name }));
    this.#writer = options.writer ?? createInlineStorageWriter(createWriterJobs());
    this.#dailyVersion = options.dailyVersion;
  }

  /**
   * Tells `events` too as sites open, are saved and close (A12): a site replaced by a hand-off
   * closes as any other.
   */
  listen(events: ProjectSessionEvents): void {
    this.#listeners.push(events);
  }

  /**
   * Tells every listener of `event`, in order. One that throws is logged by its code only, and the
   * others are still told: a feature's failure never stops a site opening, saving or closing.
   */
  #tell<E extends keyof ProjectSessionEvents>(
    event: E,
    ...args: Parameters<NonNullable<ProjectSessionEvents[E]>>
  ): void {
    for (const listener of this.#listeners) {
      try {
        (listener[event] as ((...each: typeof args) => void) | undefined)?.(...args);
      } catch (error) {
        logFailure(`Webforge could not act on the site being ${event}`, error);
      }
    }
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
  staleReason(sessionId: string): StaleReason | undefined {
    return this.#staleFor(sessionId);
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
    const site = this.site(sessionId);
    return {
      current: () => this.current(),
      staleReason: () => site.staleReason(),
      readMedia: (hash) => readMedia(site, hash),
      importFile: (mediaId, fileName, source) => importFile(site, mediaId, fileName, source),
      storeCopiedMedia: (item, read) => storeCopiedMedia(site, item, read),
      storeBlobs: (files) => storeBlobs(site, files),
      exportChoices: () => exportChoices(site),
      setExportChoices: (choices) => setExportChoices(site, choices),
      saveSiteZip: (path) => saveSiteZip(site, path),
      listVersions: () => listVersions(site),
      saveVersion: (version) => saveVersion(site, version),
      deleteVersion: (id) => deleteVersion(site, id),
      readVersionSite: (id) => readVersionSite(site, id),
      versionPackage: (id) => versionPackage(site, id),
    };
  }

  /**
   * The bytes of a Media file in whichever site is open, by hash: for the `media://` protocol only,
   * whose addresses name a file by its hash, not by the opening (1.16). A page that outlived its
   * site gets the next one's file of that hash at most, read-only, until it reloads.
   */
  readOpenMedia(hash: string): Promise<StoredBlob | undefined> {
    return readMedia(this.site(), hash);
  }

  /**
   * The open site's store for opening `sessionId`, or for whichever site is open without one
   * (A13): the one way the site's operations reach it, through the gate (R13b), checking the
   * opening again once the gate lets them in.
   */
  site(sessionId?: string): SiteStore {
    const writer = this.#writer;
    return {
      staleReason: () => this.#staleFor(sessionId),
      openPath: () => this.#path,
      withStore: (kind, work, none) => this.#withStore(kind, sessionId, work, none),
      writer: {
        prepare: (fileName, source) => writer.prepare(fileName, source),
        discard: (prepared) => writer.discard(prepared),
      },
      writerTurn: (work, none) =>
        this.#gate.run("exclusive", async () => {
          const reason = this.#staleFor(sessionId);
          const path = this.#path;
          if (reason !== undefined || path === undefined) return none(reason ?? "no-site");
          if (this.#store?.info.readOnly === true) return none("read-only");
          // Its own token: an import a close stopped can't clear the mark of the one after it.
          const writing = {};
          this.#writing = writing;
          try {
            return await work(path, {
              store: (prepared, target) => writer.store(prepared, target),
              putBlobs: (sitePath, blobs, asset) => writer.putBlobs(sitePath, blobs, asset),
            });
          } finally {
            if (this.#writing === writing) this.#writing = undefined;
          }
        }),
    };
  }

  /** Why work for opening `sessionId` (any, without one) can't use the open site now, if it can't. */
  #staleFor(sessionId: string | undefined): StaleReason | undefined {
    if (this.#store === undefined) return "no-site";
    return sessionId === undefined || sessionId === this.#sessionId ? undefined : "stale-session";
  }

  /** See {@link SiteStore.withStore}: `work` with the store on the gate's `kind` side, or `none`. */
  #withStore<T>(
    kind: GateKind,
    sessionId: string | undefined,
    work: (store: ProjectStore) => T | Promise<T>,
    none: (reason: StaleReason) => T,
  ): Promise<T> {
    return this.#gate.run(kind, () => {
      const reason = this.#staleFor(sessionId);
      const store = this.#store;
      return reason !== undefined || store === undefined ? none(reason ?? "no-site") : work(store);
    });
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
   * The open site's documents as one validated site. A new site has no documents yet (`empty`):
   * the editor creates its first pages, with starter content and translated titles, and commits
   * them.
   */
  readSite(): Promise<ReadSiteResult> {
    return this.#withStore<ReadSiteResult>(
      "shared",
      undefined,
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
    return this.#withStore<CommitResult>(
      "shared",
      sessionId,
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
        this.#takeDailyVersion(store);
        try {
          store.commit(changes);
        } catch (error) {
          return storeFailure(error, "Webforge could not save the site");
        }
        this.#site = next.data;
        this.#tell("committed");
        return { status: "saved" };
      },
      (reason) => ({ status: "failed", reason }),
    );
  }

  /** The open site's editor state, or `null` without an open site; see `editor-state.ts`. */
  uiState(): Promise<SiteUiState | null> {
    return uiState(this.site());
  }

  /** Remembers the parts of the editor state in `change` with the open site. */
  setUiState(change: SiteUiChange, sessionId?: string): Promise<UiStateResult> {
    return setUiState(this.site(sessionId), change);
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
   * The file is cleaned up here, after the last save and with the file to itself (A1): every save
   * of a page leaves its previous JSON behind, as do undone imports and pastes, and Undo can no
   * longer bring any of it back. The storage writer does it, once this connection has closed:
   * garbage collection, and a VACUUM when enough of the file is free, which would hold the main
   * thread up for seconds on a large site (#664, ADR 0013). A read-only store (a newer format,
   * once the editor can show one) is left as it is. A failure is logged and the site still closes;
   * the next close tries again.
   */
  async #closeNow(): Promise<void> {
    if (this.#writing !== undefined) {
      await this.#writer.stop();
    }
    const store = this.#store;
    const path = this.#path;
    if (store !== undefined) this.#tell("closed");
    store?.close();
    this.#store = undefined;
    this.#path = undefined;
    this.#site = undefined;
    this.#sessionId = undefined;
    if (store !== undefined && path !== undefined && !store.info.readOnly) {
      await this.#cleanUp(path);
    }
  }

  /** Has the storage writer clean the file at `path` up, for {@link CLEAN_UP_WAIT_MS} at most. */
  async #cleanUp(path: string): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<"late">((resolve) => {
      timer = setTimeout(() => resolve("late"), CLEAN_UP_WAIT_MS);
    });
    try {
      const cleaned = await Promise.race([this.#writer.cleanUp(path), late]);
      if (cleaned === "late") {
        await this.#writer.stop();
        log.error("Webforge stopped the storage writer: cleaning up a site file took too long");
      } else if (cleaned.status === "failed") {
        log.error("Webforge could not clean up a site file as it closed");
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /** The site in `store`, kept as the one commits build on. Inside the gate only. */
  /**
   * The daily version, before the first change of the day is saved (F-SITE-4): looked for once a
   * day for each opening. One that can't be saved never stops the change being saved.
   */
  #takeDailyVersion(store: ProjectStore): void {
    if (this.#dailyVersion === undefined) return;
    const checked = `${this.#sessionId ?? ""} ${localDay(new Date())}`;
    if (this.#dailyChecked === checked) return;
    this.#dailyChecked = checked;
    try {
      takeDailyVersion(store, this.#dailyVersion.kept());
    } catch (error) {
      if (!(error instanceof ReadOnlyProjectError)) {
        logFailure("Webforge could not save the daily version of a site", error);
      }
    }
  }

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
    this.#tell("opened", this.#accessTo(store), path);
    return { status: "opened", project: summarise(store, path, sessionId) };
  }

  /** Reaches `store` through the gate's shared side, while it is still the open one. */
  #accessTo(store: ProjectStore): SiteStoreAccess {
    return (work) =>
      this.#gate.run("shared", () => (this.#store === store ? work(store) : undefined));
  }
}
