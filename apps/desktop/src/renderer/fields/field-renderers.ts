import type { FieldRenderers } from "@webforge/editor-ui";
import { codeField } from "./code/field.js";
import { colourField } from "./color/field.js";
import type { FieldRendererContext } from "./field-context.js";
import { iconField } from "./icon/field.js";
import { imageField } from "./image/field.js";
import { linkField } from "./link/field.js";

/**
 * The Edit panel's renderers the app draws itself (R11, 2.20 B5), one per kind, each from its
 * folder (`fields/<kind>/`): images, links, icons, and colours its way. The Edit panel has its own
 * for the other kinds; `FIELD_KINDS` (field-kinds.ts) says which kind each field is drawn by.
 */
export function fieldRenderers(context: FieldRendererContext): FieldRenderers {
  return {
    image: imageField(context),
    link: linkField(context),
    icon: iconField(),
    color: colourField(context),
    code: codeField(),
  };
}
