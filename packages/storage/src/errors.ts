import { WebforgeError } from "@webforge/errors";

/**
 * Why a file could not be opened as a Webforge project.
 * - `not-found`: no file at the path.
 * - `not-a-project`: not an SQLite database, or one that another program made.
 * - `corrupt`: a Webforge project that fails SQLite's integrity check.
 * - `unexpected-schema`: tables, indexes, triggers or metadata that this format version doesn't
 *   define; treated as untrusted and never opened.
 * - `newer-format`: saved by a newer Webforge. `ProjectStore.open` now opens such files read-only
 *   instead (`info.newerFormat`); the code stays until the app's IPC reports read-only sites.
 */
export type ProjectFileErrorCode =
  | "not-found"
  | "not-a-project"
  | "corrupt"
  | "unexpected-schema"
  | "newer-format";

/** What the person is told for each {@link ProjectFileErrorCode}. */
const PROJECT_FILE_MESSAGES = {
  "not-found": "site.openFailed.missing",
  "not-a-project": "site.openFailed.notASite",
  corrupt: "site.openFailed.damaged",
  "unexpected-schema": "site.openFailed.notASite",
  "newer-format": "site.openFailed.newer",
} as const satisfies Record<ProjectFileErrorCode, string>;

/** A `.wforge` file that cannot be opened. The message is for developers; `code` says what. */
export class ProjectFileError extends WebforgeError<ProjectFileErrorCode> {
  override readonly name = "ProjectFileError";

  constructor(code: ProjectFileErrorCode, message: string, options?: ErrorOptions) {
    super(code, PROJECT_FILE_MESSAGES[code], message, options);
  }
}

/** A write to a project opened read-only: on request, or because a newer Webforge saved it. */
export class ReadOnlyProjectError extends WebforgeError<"read-only"> {
  override readonly name = "ReadOnlyProjectError";

  constructor() {
    super("read-only", "errors.readOnly", "The project is open read-only");
  }
}
