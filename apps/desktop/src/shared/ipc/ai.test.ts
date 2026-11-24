import { describe, expect, it } from "vitest";
import { aiChannels } from "./ai.js";
import { describeChannels } from "./contract-kit.test-helper.js";

describeChannels("ai", aiChannels);

describe("the answer to a request", () => {
  it("carries a long note: a plan's, naming each element whose alt text went (#1371)", () => {
    const places = Array.from({ length: 200 }, (_, index) => `element "logo-${index}" ("image")`);
    const note = `A new picture cleared the alt text that described the old one, in ${places.join(", ")}.`;
    expect(
      aiChannels.aiAnswer.request.safeParse([
        1,
        { status: "done", label: "AI (Claude): Change every logo", note },
      ]).success,
    ).toBe(true);
  });
});
