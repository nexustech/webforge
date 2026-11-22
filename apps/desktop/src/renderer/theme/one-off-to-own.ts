import { countOneOffUses } from "@webforge/model";
import { createStore } from "zustand/vanilla";
import type { EditorSession } from "../editor/editor-session.js";
import type { OneOffToOwn } from "../fields/index.js";
import { addOneOffToOwnColors, colorFieldsOf, type ThemeAsks } from "./theme-edits.js";

/**
 * How a colour field makes a one-off colour one of the person's colours (TC-3, #1221), through the
 * theme's own edits and `asks`: a built-in theme becomes the person's own in the same step, as
 * any change to it does. The colours the person said *Not Now* to are remembered while the window
 * is open, so the offer doesn't follow them from field to field.
 */
export function oneOffToOwn(session: EditorSession, asks: ThemeAsks): OneOffToOwn {
  const isColorField = colorFieldsOf(session.library);
  return {
    uses: (site, hex) => countOneOffUses(site, hex, isColorField),
    add: async (hex, name) =>
      (await addOneOffToOwnColors(session, asks, hex, name, isColorField)) !== undefined,
    declined: createStore<readonly string[]>(() => []),
  };
}
