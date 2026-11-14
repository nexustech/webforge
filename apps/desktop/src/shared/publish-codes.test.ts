import { PUBLISH_ERROR_CODES } from "@webforge/publish/codes";
import { describe, expect, it } from "vitest";
import { PUBLISH_FAILURES } from "./export-worker-protocol.js";
import { CONNECTION_FAILURES } from "./ipc/publish.js";

describe("the publish codes shared/ derives (#988)", () => {
  it("lets a connection test fail for each of the publisher's reasons", () => {
    expect(CONNECTION_FAILURES).toEqual(PUBLISH_ERROR_CODES);
  });

  it("gives a publish each of the publisher's reasons but cancelling, then the build's", () => {
    expect(PUBLISH_FAILURES).toEqual([
      ...PUBLISH_ERROR_CODES.filter((code) => code !== "cancelled"),
      "build-failed",
      "reserved-name",
      "unreadable-image",
    ]);
    expect(PUBLISH_FAILURES).not.toContain("cancelled");
  });
});
