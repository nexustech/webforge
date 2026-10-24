import { WebforgeError } from "@webforge/errors";
/** The files to publish: a build's output, by relative path (`index.html`, `assets/css/…`). */
export type BuildOutput = {
  readonly files: ReadonlyMap<string, Uint8Array>;
};

/** Why a publish or a connection test failed. The app shows a translated message for each code. */
export type PublishErrorCode =
  /** The sign-in or password was refused, or has expired. */
  | "unauthorized"
  /** The site or folder no longer exists at the destination. */
  | "not-found"
  /** The destination asked us to slow down; try again later. */
  | "rate-limited"
  /** The destination refused the files or the request (e.g. a validation error). */
  | "rejected"
  /** The destination could not be reached. */
  | "network"
  /** The user cancelled. */
  | "cancelled"
  /** Anything else, including a response we did not understand. */
  | "failed";

/** A publish that did not complete. Messages never contain credentials or site content. */
export class PublishError extends WebforgeError<PublishErrorCode> {
  override readonly name = "PublishError";

  constructor(code: PublishErrorCode, message: string, options?: ErrorOptions) {
    super(
      code,
      code === "cancelled" ? "errors.publishCancelled" : "errors.publishFailed",
      message,
      options,
    );
  }
}

/** Throws a `cancelled` {@link PublishError} if `signal` has been aborted. */
export function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new PublishError("cancelled", "Publishing was cancelled");
  }
}

/** The result of "Test connection". */
export type TestResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: PublishErrorCode };

/** Progress of a publish, for the progress bar and the publish history. */
export type PublishEvent =
  /** Comparing the build with what is already published. */
  | { readonly type: "preparing" }
  /** Uploading file `done + 1` of `total`. */
  | {
      readonly type: "uploading";
      readonly path: string;
      readonly done: number;
      readonly total: number;
    }
  /** The new version of the site is live at `url`. */
  | {
      readonly type: "published";
      readonly url: string;
      /** Files sent; the others were already at the destination. */
      readonly uploaded: number;
      readonly unchanged: number;
      /** Files removed because the site no longer has them. */
      readonly removed: number;
    };

/**
 * Publishes builds to one kind of destination (architecture §6). `D` holds the destination's
 * settings (stored in the `.wforge` file); credentials are given to the publisher when it is
 * created, never through `D`.
 */
export interface Publisher<D> {
  /** Checks that the destination can be reached with the current credentials. */
  test(dest: D, signal?: AbortSignal): Promise<TestResult>;
  /**
   * Uploads what changed, assets first and `index.html` last (08), then removes files the site
   * no longer has. Throws {@link PublishError}; cancelling leaves the previous site usable.
   */
  publish(build: BuildOutput, dest: D, signal: AbortSignal): AsyncIterable<PublishEvent>;
}
