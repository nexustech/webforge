// @vitest-environment happy-dom

import type { PageDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { act } from "react";
import { afterEach, expect, it } from "vitest";
import type { CanvasEngine } from "../canvas-engine.js";
import { createPuckEngine } from "./puck-engine.js";

// Its own file, so no other test has loaded Puck's editor first: the first rich text this canvas
// draws is the first anywhere, as when the app starts.

const library: ComponentLibrary = {
  components: {
    Text: {
      label: "Text",
      fields: { body: { kind: "richtext", label: "Text", inline: true } },
      defaults: { body: "<p>Text</p>" },
      render: ({ values }) => <div className="t-text">{values.body as never}</div>,
    },
  },
};

const page: PageDoc = {
  root: { props: {} },
  content: [{ type: "Text", props: { id: "t", body: "<p>Tell visitors what you do.</p>" } }],
};

let engine: CanvasEngine | undefined;
let element: HTMLDivElement | undefined;

afterEach(async () => {
  engine?.destroy();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  element?.remove();
});

it("draws rich text with the real editor from the start, never Puck's fallback (ADR 0004)", async () => {
  element = document.createElement("div");
  document.body.append(element);
  // Puck's fallback is an editable `.rich-text` of its own; the real editor's is not editable
  // itself but holds the editable `.ProseMirror`.
  let fallback = false;
  const watch = new MutationObserver(() => {
    if (element?.querySelector(".rich-text[contenteditable]") !== null) fallback = true;
  });
  watch.observe(element, { subtree: true, childList: true, attributes: true });

  engine = createPuckEngine({ iframe: false });
  await act(async () => {
    engine?.mount(element as HTMLDivElement, { library, theme: { name: "test" } });
    engine?.loadPage(page, { header: [], footer: [] });
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  watch.disconnect();

  expect(element.querySelector(".rich-text .ProseMirror")).not.toBeNull();
  // Text typed into the fallback while the editor loaded was lost when the editor replaced it.
  expect(fallback).toBe(false);
});
