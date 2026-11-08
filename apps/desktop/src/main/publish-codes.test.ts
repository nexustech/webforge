import { isMessageKey } from "@webforge/i18n";
import { PUBLISH_ERROR_CODES } from "@webforge/publish";
import { describe, expect, it } from "vitest";
import { PUBLISH_FAILURES } from "../shared/export-worker-protocol.js";
import { CONNECTION_FAILURES } from "../shared/ipc/publish.js";

// The renderer can't import @webforge/publish (it holds the SSH and FTP clients), so the IPC
// contracts list the publisher's codes again. These keep the lists and their messages in step
// (A23, #671).

/** The codes a publish can end with: all but `cancelled`, which isn't a failure. */
const FAILURES = PUBLISH_ERROR_CODES.filter((code) => code !== "cancelled");

describe("the publisher's codes (A23)", () => {
  it("each reach the renderer, from a publish and from Test Connection", () => {
    expect([...CONNECTION_FAILURES].toSorted()).toEqual([...PUBLISH_ERROR_CODES].toSorted());
    expect(PUBLISH_FAILURES).toEqual(expect.arrayContaining(FAILURES));
  });

  it("each have a message of their own, after a publish and after Test Connection", () => {
    expect(FAILURES.filter((code) => !isMessageKey(`publish.failed.${code}`))).toEqual([]);
    expect(PUBLISH_ERROR_CODES.filter((code) => !isMessageKey(`publish.test.${code}`))).toEqual([]);
  });
});
