import { hasBuiltInRenderer } from "@webforge/editor-ui";
import { describe, expect, it } from "vitest";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { sessionWith } from "../testing/fixtures.js";
import { fakePreloadApi } from "../testing/preload.js";
import { FIELD_KINDS } from "./field-kinds.js";
import { fieldRenderers } from "./field-renderers.js";

// Every kind of field a component can have is drawn by a renderer (2.20, B5): the Edit panel's own,
// or the app's (fields/<kind>/), with a story, so Storybook's axe and screenshot checks see it. Its
// Puck field is checked in the engine's config test.

// The stories of the Edit panel's renderers and the app's, as Vite reads them: only in a test.
const STORIES = import.meta.glob(
  ["../../../../../packages/editor-ui/src/**/*.stories.tsx", "../**/*.stories.tsx"],
  { query: "?raw", import: "default", eager: true },
);

/** The titles of those stories. */
const storyTitles = new Set(
  Object.values(STORIES).flatMap((text) =>
    [...String(text).matchAll(/^\s+title: "([^"]+)",$/gm)].map(([, title]) => title),
  ),
);

describe("field kinds (2.20, B5)", () => {
  const appRenderers = fieldRenderers({
    api: fakePreloadApi(),
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

  it("has a story for the renderer of every kind", () => {
    const missing = Object.entries(FIELD_KINDS).flatMap(([kind, editing]) =>
      "editPanel" in editing && !storyTitles.has(editing.story)
        ? [
            `${kind} fields are drawn by the "${editing.editPanel}" renderer, whose story ` +
              `"${editing.story}" (FIELD_KINDS, field-kinds.ts) doesn't exist. Add a story with ` +
              "that title next to the renderer, as fields/link/LinkField.stories.tsx does.",
          ]
        : [],
    );

    expect(storyTitles).toContain("Edit/Fields/Text");
    expect(missing).toEqual([]);
  });

  it("draws images, links, icons and colours the app's way", () => {
    expect(Object.keys(appRenderers)).toEqual(
      expect.arrayContaining(["color", "icon", "image", "link"]),
    );
  });
});
