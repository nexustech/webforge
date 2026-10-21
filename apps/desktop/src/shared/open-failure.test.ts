import { describe, expect, it } from "vitest";
import type { ProjectFailureReason } from "./ipc-contract.js";
import { openFailureMessage } from "./open-failure.js";

describe("openFailureMessage", () => {
  it.each<[ProjectFailureReason, string]>([
    ["not-a-project", "This file isn't a Webforge site."],
    ["corrupt", "This site file is damaged and can't be opened."],
    ["unexpected-schema", "This site file is damaged and can't be opened."],
    [
      "newer-format",
      "This site was saved by a newer version of Webforge. Update Webforge to open it.",
    ],
    ["not-found", "The site file is no longer there. It may have been moved or deleted."],
    ["unknown", "Webforge couldn't open the site."],
  ])("explains %s", (reason, message) => {
    expect(openFailureMessage(reason)).toBe(message);
  });
});
