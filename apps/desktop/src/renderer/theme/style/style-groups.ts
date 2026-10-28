import type { OptionGroup } from "@webforge/editor-ui";
import {
  APPEARANCE_FIELDS,
  BACKGROUND_FIELDS,
  type FieldDef,
  HOVER_FIELDS,
  STYLE_GROUPS,
} from "@webforge/site-components";

/** The Appearance group (2.22), first in the dialog: the basics the Style tab has too. */
const APPEARANCE = APPEARANCE_FIELDS.lookShadow.optionGroup;

/**
 * How *Style this ‹component›…* arranges an item's fields (3.13b, CT-2): its groups in order, and
 * the group each field shows in, or none for a field the dialog leaves out.
 */
export type DialogGroups = {
  readonly order: readonly OptionGroup[];
  readonly of: (name: string, field: FieldDef) => OptionGroup | undefined;
};

/**
 * The dialog's groups (3.13b): the Appearance basics, then Background, Border, Corners, Shadow,
 * Title, Spacing and When hovered. Besides the deeper fields, which are in theirs:
 * - a section's background image and its overlay (2.26) go in Background;
 * - padding and margin, a section's (1.32) and an element's (CT-5), in Spacing;
 * - the hover row's effect, speed and movement (2.28), in When hovered.
 */
export const STYLE_DIALOG_GROUPS: DialogGroups = {
  order: [
    APPEARANCE,
    STYLE_GROUPS.background,
    STYLE_GROUPS.border,
    STYLE_GROUPS.corners,
    STYLE_GROUPS.shadow,
    STYLE_GROUPS.title,
    STYLE_GROUPS.spacing,
    STYLE_GROUPS.hover,
  ],
  of: (name, field) => {
    if (Object.hasOwn(BACKGROUND_FIELDS, name)) return STYLE_GROUPS.background;
    if (Object.hasOwn(HOVER_FIELDS, name)) return STYLE_GROUPS.hover;
    if (
      name === "lookPadding" ||
      (field.kind === "box" && (name === "padding" || name === "margin"))
    ) {
      return STYLE_GROUPS.spacing;
    }
    if (field.inDialog === true) return field.optionGroup;
    return field.optionGroup?.id === APPEARANCE.id ? APPEARANCE : undefined;
  },
};
