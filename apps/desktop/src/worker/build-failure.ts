import { BuildError } from "@webforge/pipeline";

/**
 * A build's failure as an export's and a publish's outcome both have it (#987): either can return
 * it as its own.
 */
type FailedBuild = {
  readonly type: "failed";
  readonly code: "reserved-name" | "unreadable-image" | "build-failed";
  readonly detail: string;
  readonly page?: string;
  readonly image?: string;
};

/**
 * What became of a build that threw `error`, by its code only, never with a secret or a path
 * (#987: the export's and the publish's, once each): cancelled; a page whose file name is reserved,
 * with the page; an image that couldn't be read, with the image; or any other build failure.
 * `undefined` for an error that isn't the build's, which the caller reports as its own.
 */
export function buildFailureOf(
  error: unknown,
): { readonly type: "cancelled" } | FailedBuild | undefined {
  if (!(error instanceof BuildError)) return undefined;
  if (error.code === "cancelled") return { type: "cancelled" };
  if (error.code === "reserved-name") {
    return {
      type: "failed",
      code: "reserved-name",
      detail: error.code,
      ...(error.page === undefined ? {} : { page: error.page }),
    };
  }
  if (error.code === "unreadable-image") {
    return {
      type: "failed",
      code: "unreadable-image",
      detail: error.code,
      ...(error.image === undefined ? {} : { image: error.image }),
    };
  }
  return { type: "failed", code: "build-failed", detail: error.code };
}
