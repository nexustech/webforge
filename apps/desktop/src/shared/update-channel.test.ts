import { describe, expect, it } from "vitest";
import { updateChannelFor } from "./update-channel.js";

describe("the update channel an installation follows (5.2)", () => {
  it("is Beta below 1.0.0 and Stable from it, until the person chooses", () => {
    expect(updateChannelFor(undefined, "0.9.0")).toBe("beta");
    expect(updateChannelFor(undefined, "0.0.0-dry-run.4")).toBe("beta");
    expect(updateChannelFor(undefined, "1.0.0")).toBe("stable");
    expect(updateChannelFor(undefined, "2.3.1")).toBe("stable");
    expect(updateChannelFor("stable", "0.9.0")).toBe("stable");
    expect(updateChannelFor("beta", "1.0.0")).toBe("beta");
  });

  it("is Stable for a version it can't read", () => {
    expect(updateChannelFor(undefined, "")).toBe("stable");
    expect(updateChannelFor(undefined, "next")).toBe("stable");
  });
});
