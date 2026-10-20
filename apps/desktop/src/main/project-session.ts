import { basename, extname, resolve } from "node:path";
import { t } from "@webforge/i18n";
import { ProjectFileError, type ProjectFileErrorCode, ProjectStore } from "@webforge/storage";
import type {
  ProjectFailureReason,
  ProjectResult,
  ProjectSummary,
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
  return { name, fileName: basename(path), formatVersion };
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

  /** Closes the open site, if any. */
  close(): void {
    this.#store?.close();
    this.#store = undefined;
    this.#path = undefined;
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
