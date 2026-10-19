/**
 * Why a file could not be opened as a Webforge project.
 * - `not-found`: no file at the path.
 * - `not-a-project`: not an SQLite database, or one that another program made.
 * - `corrupt`: a Webforge project that fails SQLite's integrity check.
 * - `unexpected-schema`: tables, indexes, triggers or metadata that this format version doesn't
 *   define; treated as untrusted and never opened.
 * - `newer-format`: saved by a newer Webforge; the user needs to update.
 */
export type ProjectFileErrorCode =
  | "not-found"
  | "not-a-project"
  | "corrupt"
  | "unexpected-schema"
  | "newer-format";

/** A `.wforge` file that cannot be opened. The message is for logs; show the user `code`. */
export class ProjectFileError extends Error {
  override readonly name = "ProjectFileError";
  readonly code: ProjectFileErrorCode;

  constructor(code: ProjectFileErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
  }
}
