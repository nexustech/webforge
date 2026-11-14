import type { NodeDoc } from "@webforge/model";
import { type FieldDef, siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { filesPlacedIn } from "./media-usage.js";

// A kind of field that can hold a Media file must be found by `filesPlacedIn`: Media counts the
// file as placed, and copying an element carries it to the site it's pasted in (#979). This lists
// every kind, so a new one doesn't type-check here until it says whether it can hold a file.

const FILE = "prices";

/** An element of `type` with `values`, over its defaults. */
const element = (type: string, values: Record<string, unknown>): NodeDoc => ({
  type,
  props: { ...siteLibrary.components[type]?.defaults, id: `${type}-1`, ...values },
});

/** A value of each kind of field that holds a Media file; `null` for a kind that can't hold one. */
const HOLDING_A_FILE = {
  text: null,
  richtext: `<p>See <a href="webforge:file/${FILE}">our prices</a>.</p>`,
  select: null,
  toggle: null,
  slider: null,
  color: null,
  spacing: null,
  box: null,
  // The elements a slot holds, at any depth.
  slot: [element("Image", { image: { mediaId: FILE } })],
  media: { mediaId: FILE },
  link: { kind: "file", mediaId: FILE },
  icon: null,
  code: null,
  // A list item's fields are text, choices, toggles, sliders and colours only (`ListItemFieldDef`).
  list: null,
} as const satisfies { readonly [Kind in FieldDef["kind"]]: unknown };

/** A component type of the catalogue's with a field of `kind`, and that field's name. */
function withFieldOf(kind: FieldDef["kind"]): readonly [string, string] {
  for (const [type, def] of Object.entries(siteLibrary.components)) {
    const name = Object.entries(def.fields).find(([, field]) => field.kind === kind)?.[0];
    if (name !== undefined) return [type, name];
  }
  throw new Error(`No component has a ${kind} field`);
}

describe("files in every kind of field (#979)", () => {
  for (const [kind, value] of Object.entries(HOLDING_A_FILE)) {
    if (value === null) continue;
    it(`finds the file a ${kind} field holds, for Media's count and for copying`, () => {
      const [type, field] = withFieldOf(kind as FieldDef["kind"]);

      expect(filesPlacedIn([element(type, { [field]: value })], siteLibrary)).toEqual(
        new Set([FILE]),
      );
    });
  }
});
