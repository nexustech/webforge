import { EDITOR_RENDER_CONTEXT, type RenderContext } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { RENDER_CONTEXT_SOURCES, splitRenderContext } from "./render-context-sources.js";

describe("splitting the render context (#367)", () => {
  it("puts each part on the side its source says, losing none", () => {
    const context: RenderContext = {
      ...EDITOR_RENDER_CONTEXT,
      emptyImage: () => "Choose one",
      previews: { mobileMenu: true },
      emptySetting: () => "Not set",
    };
    const { parts, bindings } = splitRenderContext(context);
    for (const key of Object.keys(parts)) {
      expect(RENDER_CONTEXT_SOURCES[key as keyof RenderContext]).not.toBe("setSettings");
    }
    for (const key of Object.keys(bindings)) {
      expect(RENDER_CONTEXT_SOURCES[key as keyof RenderContext]).toBe("setSettings");
    }
    expect({ ...parts, ...bindings }).toEqual(context);
    // The optional defaults too, which a list of names would drop.
    expect(Object.keys(parts)).toEqual(expect.arrayContaining(["emptyImage", "previews"]));
    expect(Object.keys(bindings)).toEqual(expect.arrayContaining(["setting", "emptySetting"]));
  });
});
