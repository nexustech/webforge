import type { EditPanelField, FieldSource, OptionGroup } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { appearanceBoxClasses, type FieldDef } from "@webforge/site-components";

/** How *Style this ‹component›…* arranges an item's fields (3.13b): `EditPanelHost`'s `dialogGroups`. */
type Arrangement = {
  readonly order: readonly OptionGroup[];
  readonly of: (name: string, field: FieldDef) => OptionGroup | undefined;
};

/**
 * `fields` as *Style this ‹component›…* shows them (3.13b): those in its groups, each in its group,
 * the groups in its order and the fields in theirs as the item has them, as one list.
 */
export function arranged(
  fields: readonly EditPanelField[],
  arrangement: Arrangement,
  defs: Readonly<Record<string, FieldDef>>,
): EditPanelField[] {
  const rank = (group: OptionGroup) => arrangement.order.findIndex((each) => each.id === group.id);
  return fields
    .flatMap((field, at) => {
      const def = defs[field.name];
      const group = def === undefined ? undefined : arrangement.of(field.name, def);
      return group === undefined
        ? []
        : [{ field: { ...field, group: "content" as const, optionGroup: group }, at, group }];
    })
    .sort((a, b) => rank(a.group) - rank(b.group) || a.at - b.at)
    .map(({ field }) => field);
}

/**
 * What the Colour of a background says while it's drawn as a gradient (CT-4, 3.13b): the Style tab
 * shows the dialog's gradient as one chip there, which opens the dialog when it can.
 */
export function gradientSource(
  values: Readonly<Record<string, unknown>>,
  item: string,
  open: (() => void) | undefined,
): { readonly source?: FieldSource } {
  const drawn = appearanceBoxClasses({
    lookGradientDirection: values.lookGradientDirection,
    lookGradientFrom: values.lookGradientFrom,
    lookGradientTo: values.lookGradientTo,
  });
  if (drawn === "") return {};
  return {
    source: {
      text: t("editPanel.gradientSource", { item }),
      ...(open === undefined ? {} : { onReveal: open }),
    },
  };
}
