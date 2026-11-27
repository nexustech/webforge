import { FORMAT_VERSION } from "@webforge/storage";
import { describe, expect, it } from "vitest";
import { RELEASES, releasesThatWrote } from "./format-releases.js";

// Which releases wrote each storage format (#1525): a copy kept from before an update says which
// versions of Webforge open it.

describe("the releases that wrote each format (#1525)", () => {
  it("has a release for the format this build writes, so a later format change can't forget it", () => {
    expect(RELEASES.some((release) => release.fileFormat === FORMAT_VERSION)).toBe(true);
  });

  it("lists the releases oldest first, each a format no newer than this build's", () => {
    const versions = RELEASES.map((release) => release.version);
    expect(versions).toEqual(
      [...versions].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    );
    for (const release of RELEASES) expect(release.fileFormat).toBeLessThanOrEqual(FORMAT_VERSION);
  });

  it("names the first and last release before this one that wrote a format", () => {
    expect(releasesThatWrote(2, "0.4.0")).toEqual({ first: "0.1.0", last: "0.3.1" });
    // The running version didn't write the copy it kept: it came from before it.
    expect(releasesThatWrote(2, "0.3.1")).toEqual({ first: "0.1.0", last: "0.3.0" });
    expect(releasesThatWrote(2, "0.10.0")).toEqual({ first: "0.1.0", last: "0.3.1" });
  });

  it("names none for a format no release wrote", () => {
    expect(releasesThatWrote(1, "0.4.0")).toBeUndefined();
    expect(releasesThatWrote(2, "0.1.0")).toBeUndefined();
  });
});
