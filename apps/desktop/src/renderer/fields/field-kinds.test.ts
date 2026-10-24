import { hasBuiltInRenderer } from "@webforge/editor-ui";
import { describe, expect, it } from "vitest";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { sessionWith } from "../testing/fixtures.js";
import { FIELD_KINDS } from "./field-kinds.js";
import { fieldRenderers } from "./field-renderers.js";

// Every kind of field a component can have is drawn by a renderer (2.20, B5): the Edit panel's own,
// or the app's (fields/<kind>/). Its story is checked in tools/src/field-kinds.test.ts, and its
// Puck field in the engine's config test.

describe("field kinds (2.20, B5)", () => {
  const appRenderers = fieldRenderers({
    session: sessionWith(),
    preferences: createPreferencesStore(),
    imagePicks: { request: () => undefined, take: () => false, subscribe: () => () => undefined },
  });

  it("has a renderer for every kind the Edit panel draws", () => {
    const missing = Object.entries(FIELD_KINDS).flatMap(([kind, editing]) =>
      "editPanel" in editing &&
      !hasBuiltInRenderer(editing.editPanel) &&
      appRenderers[editing.editPanel] === undefined
        ? [
            `${kind} fields are drawn by the "${editing.editPanel}" renderer, which neither the ` +
              "Edit panel nor the app has: add one in apps/desktop/src/renderer/fields/" +
              `${editing.editPanel}/field.ts and list it in fieldRenderers (field-renderers.ts).`,
          ]
        : [],
    );

    expect(missing).toEqual([]);
  });

  it("draws images, links and colours the app's way", () => {
    expect(Object.keys(appRenderers).toSorted()).toEqual(["color", "image", "link"]);
  });
});
