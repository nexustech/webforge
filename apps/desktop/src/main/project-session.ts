import { basename, extname, resolve } from "node:path";
import { t } from "@webforge/i18n";
import {
  applySiteChanges,
  type SiteDoc,
  type SiteDocumentChange,
  SiteFormatError,
  siteDocSchema,
} from "@webforge/model";
import {
  detectSyncFolder,
  ProjectFileError,
  type ProjectFileErrorCode,
  ProjectStore,
  ReadOnlyProjectError,
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

function samePath(a: string, b: string): boolean {
  const normalise = (path: string) =>
    process.platform === "win32" ? resolve(path).toLowerCase() : resolve(path);
  return normalise(a) === normalise(b);
}

function summarise(store: ProjectStore, path: string): ProjectSummary {
  const { name, formatVersion } = store.info;
  return {
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

/**
 * The site open in the main process. At most one site is open at a time; opening or creating
 * another replaces it only once the new one is open, so a failure keeps the current site.
 */
export class ProjectSession {
  #store: ProjectStore | undefined;
  #path: string | undefined;
  /** The open site as last read or saved; commits are checked against it. */
  #site: SiteDoc | undefined;

  /** The open site, or `null`. */
  current(): ProjectSummary | null {
    return this.#store === undefined || this.#path === undefined
      ? null
      : summarise(this.#store, this.#path);
  }

  /**
   * Creates a site at `path` (adding `.wforge` if missing), named after the file, and opens it.
   * An existing file at `path` is replaced; the save dialog has already asked the user.
   */
  create(path: string): ProjectResult {
    const target = withProjectExtension(path);
    // The current site's file can't be replaced while it is open.
    if (this.#path !== undefined && samePath(this.#path, target)) {
      this.close();
    }
    const name = basename(target, extname(target)).trim() || t("site.untitledName");
    return this.#replaceWith(target, () => ProjectStore.create(target, { name }));
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
    return { status: "saved" };
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
    this.#store?.close();
    this.#store = undefined;
    this.#path = undefined;
    this.#site = undefined;
  }

  #replaceWith(path: string, openStore: () => ProjectStore): ProjectResult {
    let store: ProjectStore;
    try {
      store = openStore();
    } catch (error) {
      return failure(error);
    }
    this.close();
    this.#store = store;
    this.#path = path;
    return { status: "opened", project: summarise(store, path) };
  }
}
