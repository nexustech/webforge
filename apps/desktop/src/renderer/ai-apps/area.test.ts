import { describe, expect, it } from "vitest";
import { WINDOW_AREAS } from "../areas.js";
import { aiAppsArea } from "./area.js";

describe("the Ai apps area", () => {
  it("is listed in the composition root", () => {
    expect(WINDOW_AREAS).toContain(aiAppsArea);
  });
});
