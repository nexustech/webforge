import type { NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { siteLibrary } from "./catalogue/index.js";
import { EDITOR_RENDER_CONTEXT, withLook } from "./library.js";
import { renderNodesToHtml } from "./render-static.js";

// Each kind's look from the theme (3.12, CT-1), under what an element sets itself.

const button = (props: Record<string, unknown> = {}): NodeDoc => ({
  type: "Button",
  props: { id: "b", label: "Book now", ...props },
});
const looks = {
  Button: {
    lookCorners: "full",
    lookShadow: { $responsive: { desktop: "large", mobile: "none" } },
  },
};
const draw = (nodes: NodeDoc[], withLooks = looks) =>
  renderNodesToHtml(nodes, siteLibrary, { ...EDITOR_RENDER_CONTEXT, looks: withLooks });

describe("withLook (3.12, CT-1)", () => {
  it("gives each field an element doesn't set its kind's look, and keeps what it sets", () => {
    expect(withLook({ label: "Go" }, "Button", looks)).toEqual({ ...looks.Button, label: "Go" });
    expect(withLook({ lookCorners: "small" }, "Button", looks)).toMatchObject({
      lookCorners: "small",
    });
    // Set to the theme's own on purpose: that's its choice, not a gap for the look.
    expect(withLook({ lookCorners: "default" }, "Button", looks)).toMatchObject({
      lookCorners: "default",
    });
    // Another kind, or a theme without looks, as it was.
    expect(withLook({ label: "Go" }, "Heading", looks)).toEqual({ label: "Go" });
    expect(withLook({ label: "Go" }, "Button", undefined)).toEqual({ label: "Go" });
  });
});

describe("the export with looks (3.12, CT-1)", () => {
  it("draws an element in its kind's look, per device as the look says", () => {
    const html = draw([button()]);

    expect(html).toContain("rounded-full!");
    expect(html).toMatch(/lg:shadow-lg!|md:shadow-lg!/);
    expect(html).toContain("max-md:shadow-none!");
  });

  it("draws an element's own Appearance over its kind's look", () => {
    const html = draw([button({ lookCorners: "none" })]);

    expect(html).toContain("rounded-none!");
    expect(html).not.toContain("rounded-full!");
  });

  it("draws nothing differently without a look for the kind", () => {
    expect(draw([button()], {} as typeof looks)).toBe(
      renderNodesToHtml([button()], siteLibrary, EDITOR_RENDER_CONTEXT),
    );
  });
});
