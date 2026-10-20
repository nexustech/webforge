// @vitest-environment happy-dom

import { t } from "@webforge/i18n";
import type { ComponentLibrary } from "@webforge/site-components";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { PUCK_MESSAGES, puckDictionary } from "./dictionary.js";
import { createPuckEngine } from "./puck-engine.js";

declare global {
  // Tells React that act() is available (testing without @testing-library).
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const library: ComponentLibrary = {
  components: {
    Heading: {
      label: "Heading",
      fields: { text: { kind: "text", label: "Text" } },
      defaults: { text: "Heading" },
      render: () => <p>Heading</p>,
    },
  },
};

describe("puckDictionary", () => {
  it("resolves every Puck string through t()", () => {
    const dictionary = puckDictionary();
    for (const [puckKey, key] of Object.entries(PUCK_MESSAGES)) {
      expect(dictionary[puckKey], puckKey).toBe(t(key));
      expect(dictionary[puckKey]?.trim(), puckKey).not.toBe("");
    }
    expect(Object.keys(dictionary)).toEqual(Object.keys(PUCK_MESSAGES));
  });

  it("keeps the placeholders Puck fills in", () => {
    const dictionary = puckDictionary();
    expect(dictionary["drawer-category-collapse"]).toContain("{title}");
    expect(dictionary["field-arrayitem-summary"]).toContain("{index}");
    expect(dictionary["viewport-zoom-auto"]).toContain("{zoom}");
    expect(dictionary["viewport-switch"]).toContain("{label}");
    expect(dictionary["canvas-noconfig"]).toContain("{type}");
  });

  it("is what the mounted editor shows instead of Puck's own text", async () => {
    const element = document.createElement("div");
    document.body.append(element);
    const engine = createPuckEngine({ iframe: false });
    await act(async () => {
      engine.mount(element, { library, theme: { name: "test" } });
      engine.loadPage({ root: { props: {} }, content: [] }, { header: [], footer: [] });
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    try {
      const text = element.textContent;
      // Puck's own words would be "Blocks", "Outline" and "Fields".
      expect(text).toContain(t("puck.panel.add"));
      expect(text).toContain(t("puck.panel.layers"));
      expect(text).toContain(t("puck.panel.edit"));
      expect(element.querySelector(`[aria-label="${t("puck.layout.maximize")}"]`)).not.toBeNull();
    } finally {
      engine.destroy();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      element.remove();
    }
  });
});
