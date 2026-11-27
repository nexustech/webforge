import { SITE_FORMAT_VERSION } from "@webforge/model";
import { FORMAT_VERSION } from "@webforge/storage";
import { describe, expect, it } from "vitest";
import { RELEASES, releasesThatOpen } from "./format-releases.js";

// Which releases open a file in each pair of formats (#1525): a copy kept from before an update says
// which versions of Webforge open it.

describe("the releases that open each format (#1525)", () => {
  it("has a release for the file format this build writes, so a later format change can't forget it", () => {
    expect(RELEASES.some((release) => release.fileFormat === FORMAT_VERSION)).toBe(true);
  });

  it("lists the releases oldest first, their formats never going back or past this build's", () => {
    const versions = RELEASES.map((release) => release.version);
    expect(versions).toEqual(
      [...versions].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    );
    RELEASES.forEach((release, index) => {
      const before = RELEASES[index - 1];
      expect(release.fileFormat).toBeLessThanOrEqual(FORMAT_VERSION);
      expect(release.siteFormat).toBeLessThanOrEqual(SITE_FORMAT_VERSION);
      if (before === undefined) return;
      expect(release.fileFormat).toBeGreaterThanOrEqual(before.fileFormat);
      expect(release.siteFormat).toBeGreaterThanOrEqual(before.siteFormat);
    });
  });

  it("names the first and last release before this one that open a file's formats", () => {
    // A site from before 0.1.0's site format opens in every release since.
    expect(releasesThatOpen({ fileFormat: 2, siteFormat: 11 }, "0.4.0")).toEqual({
      first: "0.1.0",
      last: "0.3.1",
    });
    // The running version didn't write the copy it kept: it came from before it.
    expect(releasesThatOpen({ fileFormat: 2, siteFormat: 11 }, "0.3.1")).toEqual({
      first: "0.1.0",
      last: "0.3.0",
    });
    expect(releasesThatOpen({ fileFormat: 2, siteFormat: 12 }, "0.10.0")).toEqual({
      first: "0.1.0",
      last: "0.3.1",
    });
  });

  it("leaves out the releases whose site format is older than the file's", () => {
    // Saved by 0.3.1: 0.1.0 to 0.3.0 say it was saved by a newer version.
    expect(releasesThatOpen({ fileFormat: 2, siteFormat: 22 }, "0.4.0")).toEqual({
      first: "0.3.1",
      last: "0.3.1",
    });
    // Saved by a build between 0.2.0 and 0.3.0.
    expect(releasesThatOpen({ fileFormat: 2, siteFormat: 16 }, "0.4.0")).toEqual({
      first: "0.3.0",
      last: "0.3.1",
    });
  });

  it("names none for formats no release opens", () => {
    expect(releasesThatOpen({ fileFormat: 1, siteFormat: 1 }, "0.4.0")).toBeUndefined();
    expect(releasesThatOpen({ fileFormat: 2, siteFormat: 11 }, "0.1.0")).toBeUndefined();
    // A development build's site, newer than any release.
    expect(releasesThatOpen({ fileFormat: 2, siteFormat: 23 }, "0.4.0")).toBeUndefined();
  });
});
