import type { EditPanelField, FieldSource, OptionGroup } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { type Breakpoint, resolveResponsive } from "@webforge/model";
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
 * What the Colour of a background says while it's drawn as a gradient on `breakpoint`, the device
 * shown (CT-4, 3.13b): in the Style tab, one chip for the dialog's gradient, which opens the dialog
 * when it can; in the dialog (`inDialog`), that it's set under Background, just below.
 */
export function gradientSource(
  values: Readonly<Record<string, unknown>>,
  breakpoint: Breakpoint,
  where: { readonly inDialog: true } | { readonly item: string; readonly open?: () => void },
): { readonly source?: FieldSource } {
  const on = (value: unknown) => resolveResponsive(value as never, breakpoint);
  const drawn = appearanceBoxClasses({
    lookGradientDirection: on(values.lookGradientDirection),
    lookGradientFrom: on(values.lookGradientFrom),
    lookGradientTo: on(values.lookGradientTo),
  });
  if (drawn === "") return {};
  if ("inDialog" in where) return { source: { text: t("editPanel.gradientBelow") } };
  return {
    source: {
      text: t("editPanel.gradientSource", { item: where.item }),
      ...(where.open === undefined ? {} : { onReveal: where.open }),
    },
  };
}
