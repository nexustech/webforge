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
  /**
   * The server isn't the one trusted for this destination: an SFTP host key that changed, or an
   * FTPS certificate the computer doesn't trust. Nothing was sent.
   */
  | "untrusted-host"
  /**
   * An FTPS destination's host doesn't offer encryption (it refused `AUTH TLS`): the person can
   * choose SFTP, if the host has it, or plain FTP after its warning (B5, 4.3).
   */
  | "no-encryption"
  /** An SFTP private key that can't be read: not a key, or its passphrase is wrong or missing. */
  | "bad-key"
  /**
   * The folder has another site published there with the app (its manifest names another
   * project): nothing was sent, and the app asks before replacing it (A8, 4.5).
   */
  | "other-site"
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
      /** The destination's own name for this version, where it has one: a Netlify deploy's id. */
      readonly version?: string;
    };

/** The event a publish ends with. */
export type PublishedEvent = Extract<PublishEvent, { readonly type: "published" }>;

/** What checking the live site found once a publish is done (08, step 5). */
export type Verification =
  /** The address serves the site just published. */
  | { readonly status: "live" }
  /**
   * The address answers, but with another site or an earlier version of this one: a cache still
   * holding it, another deploy published since, or an address that isn't this destination's.
   */
  | { readonly status: "different" }
  /**
   * The address or the host's API didn't answer in time, or answered with an error
   * (`httpStatus`, when it answered).
   */
  | { readonly status: "unreachable"; readonly httpStatus?: number }
  /** Not checked: no `https:` address, no home page in the build, or cancelled. */
  | { readonly status: "unchecked" };

/**
 * Publishes builds to one kind of destination (architecture §6). `D` holds the destination's
 * settings (stored in the `.wforge` file); credentials are given to the publisher when it is
 * created, never through `D`.
 */
export interface Publisher<D> {
  /**
   * Checks that the destination can be reached with the current credentials. Nothing is
   * published, so the site publishing isn't needed (4.3).
   */
  test(dest: Omit<D, "site" | "replaceOtherSite">, signal?: AbortSignal): Promise<TestResult>;
  /**
   * Uploads what changed, assets first and `index.html` last (08), then removes files the site
   * no longer has. Throws {@link PublishError}; cancelling leaves the previous site usable.
   */
  publish(build: BuildOutput, dest: D, signal: AbortSignal): AsyncIterable<PublishEvent>;
  /**
   * Checks that `published` is the version the destination serves, where the host can say so
   * itself (Netlify, through its API). Without it, the live address is asked for the home page
   * (`verifyPublished`). Never throws.
   */
  verify?(published: PublishedEvent, dest: D, signal: AbortSignal): Promise<Verification>;
}
