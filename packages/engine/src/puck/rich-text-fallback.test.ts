import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { toPuckConfig } from "./config.js";

// Puck draws rich text that isn't edited in place, or an element that resolves its data or
// permissions, through a fallback that inserts the stored HTML as it is (`RichTextRenderFallback`,
// security review S23). An opened file's and a paste's rich text is cleaned (`withCleanRichText`),
// but any other way in would reach that fallback raw. Before letting one of these through, patch
// the fallback to draw nothing (ADR 0007) and change this test.

const config = toPuckConfig(siteLibrary);

describe("Puck's raw rich-text fallback stays out of reach (S23)", () => {
  it("edits every rich-text field of the catalogue in place", () => {
    const notInline = Object.entries(config.components).flatMap(([type, component]) =>
      Object.entries(component.fields ?? {})
        .filter(([, field]) => field.type === "richtext" && field.contentEditable !== true)
        .map(([name]) => `${type}.${name}`),
    );
    expect(notInline).toEqual([]);
  });

  it("resolves no element's data or permissions", () => {
    const resolving = Object.entries(config.components)
      .filter(([, component]) => "resolveData" in component || "resolvePermissions" in component)
      .map(([type]) => type);
    expect(resolving).toEqual([]);
    expect(config.root).not.toHaveProperty("resolveData");
    expect(config.root).not.toHaveProperty("resolvePermissions");
  });
});
