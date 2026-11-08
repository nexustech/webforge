// @vitest-environment happy-dom
// Security review S8 (docs/reviews/2026-10-30-security-review.md), restored by #652 as a documented
// exception: Puck's canvas is a same-origin srcdoc frame, which the engine reaches into, so it can't
// be sandboxed. ADR 0023 draws the boundary instead: no script of the site's or the person's ever
// runs in it, only in a separate view with no preload. A sandbox here would mean that ADR changes.

import { DEFAULT_THEME, type PageDoc } from "@webforge/model";
import { type ComponentLibrary, textValue } from "@webforge/site-components";
import { act } from "react";
import { afterAll, describe, expect, it } from "vitest";
import { createPuckEngine } from "./puck-engine.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 600));
});

const library: ComponentLibrary = {
  components: {
    Heading: {
      label: "Heading",
      fields: { text: { kind: "text", label: "Text", inline: true } },
      defaults: { text: "Heading" },
      render: ({ values }) => <p className="t-heading">{textValue(values.text)}</p>,
    },
  },
};
const page: PageDoc = {
  root: { props: {} },
  content: [{ type: "Heading", props: { id: "a", text: "First" } }],
};

describe("canvas iframe isolation (spec 01 §9, ADR 0023)", () => {
  it("renders the canvas in a same-origin srcdoc iframe, the exception ADR 0023 documents", async () => {
    const element = document.createElement("div");
    document.body.append(element);
    // Default options: the iframe is on, as in the editor.
    const engine = createPuckEngine();
    await act(async () => {
      engine.mount(element, { library, theme: { ...DEFAULT_THEME, preset: "test" } });
      engine.loadPage(page, { header: [], footer: [] });
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    const iframe = element.querySelector("iframe");
    try {
      expect(iframe).not.toBeNull();
      expect(iframe?.hasAttribute("srcdoc")).toBe(true);
      // Not sandboxed: the engine reaches into the frame (S8). So nothing may run in it (ADR 0023).
      expect(iframe?.hasAttribute("sandbox")).toBe(false);
    } finally {
      engine.destroy();
      element.remove();
    }
  });
});
