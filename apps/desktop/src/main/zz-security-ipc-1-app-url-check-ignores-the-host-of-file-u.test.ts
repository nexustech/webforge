// Security review S7 (docs/reviews/2026-10-30-security-review.md), restored by #652: the app-URL
// check compares the host of a file: URL too, as it does for the app's own scheme.
import { describe, expect, it } from "vitest";
import { isAppUrl, mayNavigate } from "./security.js";

const appUrl = "file:///C:/Program%20Files/Webforge/resources/app.asar/out/renderer/index.html";
const foreign =
  "file://attacker.example/C:/Program%20Files/Webforge/resources/app.asar/out/renderer/index.html";

describe("isAppUrl with a file: URL on another host", () => {
  it("refuses the app's path on a foreign host", () => {
    expect(isAppUrl(foreign, appUrl)).toBe(false);
  });

  it("refuses a navigation of the main frame to it", () => {
    expect(mayNavigate({ url: foreign, isMainFrame: true, isSameDocument: false }, appUrl)).toBe(
      false,
    );
  });
});
