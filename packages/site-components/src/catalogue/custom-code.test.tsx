import type { NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext } from "../schema.js";
import { siteLibrary } from "./index.js";

const CODE = '<div class="promo"><b>Sale</b><script>window.sold = true</script></div>';
const custom = (props: Record<string, unknown>): NodeDoc => ({
  type: "CustomCode",
  props: { id: "custom", ...siteLibrary.components.CustomCode?.defaults, ...props },
});
const html = (node: NodeDoc, context: RenderContext = EDITOR_RENDER_CONTEXT) =>
  renderNodesToHtml([node], siteLibrary, context);
const exported: RenderContext = { ...EDITOR_RENDER_CONTEXT, rawCustomCode: true };

describe("Custom Code (2.11, F-ED-15)", () => {
  it("is written as it is in the export, scripts and all", () => {
    expect(html(custom({ code: CODE }), exported)).toBe(
      `<div class="site-custom-code">${CODE}</div>`,
    );
  });

  it("is shown sanitised and labelled everywhere else: no script on the canvas", () => {
    const shown = html(custom({ code: CODE }));

    expect(shown).toContain('<div class="promo"><b>Sale</b></div>');
    expect(shown).not.toContain("<script");
    expect(shown).toContain("Custom Code");
  });

  it("can't be made raw by a stored document: only the export's render context does it", () => {
    const shown = html(
      custom({ code: CODE, rawCustomCode: true, context: { rawCustomCode: true } }),
    );

    expect(shown).not.toContain("<script");
  });

  it("shows nothing in the export while empty, and in the editor where to add it", () => {
    expect(html(custom({ code: "  " }), exported)).toBe("");
    expect(html(custom({}))).toContain("Add your HTML in the Edit panel");
  });

  it("is offered in Advanced mode only, and edited as code", () => {
    const def = siteLibrary.components.CustomCode;

    expect(def?.advancedOnly).toBe(true);
    expect(def?.fields.code?.kind).toBe("code");
  });
});
