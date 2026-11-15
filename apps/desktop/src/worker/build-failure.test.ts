import { BuildError, WriteError } from "@webforge/pipeline";
import { describe, expect, it } from "vitest";
import { buildFailureOf } from "./build-failure.js";

describe("a build's failure, as an export and a publish report it (#987)", () => {
  it("is cancelled when the build was", () => {
    expect(buildFailureOf(new BuildError("cancelled", "Cancelled"))).toEqual({ type: "cancelled" });
  });

  it("names the page whose file name is reserved, and the image it couldn't read", () => {
    expect(buildFailureOf(new BuildError("reserved-name", "Reserved", { page: "Assets" }))).toEqual(
      { type: "failed", code: "reserved-name", detail: "reserved-name", page: "Assets" },
    );
    expect(
      buildFailureOf(new BuildError("unreadable-image", "Unreadable", { image: "media-1" })),
    ).toEqual({
      type: "failed",
      code: "unreadable-image",
      detail: "unreadable-image",
      image: "media-1",
    });
    // Without them, as the build may not know which.
    expect(buildFailureOf(new BuildError("reserved-name", "Reserved"))).toEqual({
      type: "failed",
      code: "reserved-name",
      detail: "reserved-name",
    });
  });

  it("is any other build failure by its code alone, never its message", () => {
    const failure = buildFailureOf(new BuildError("missing-font", "C:Users\rosa\font.woff2"));
    expect(failure).toEqual({ type: "failed", code: "build-failed", detail: "missing-font" });
  });

  it("leaves an error that isn't the build's to the caller", () => {
    expect(buildFailureOf(new WriteError("cancelled", "Cancelled"))).toBeUndefined();
    expect(buildFailureOf(new Error("boom"))).toBeUndefined();
  });
});
