import type { EditPanelField } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { type Bindings, bindableSettingSchema, bindingOf, bindingsSchema } from "@webforge/model";
import type { FieldDef } from "@webforge/site-components";

/** What the Edit panel's "shows" choice for field `name` is called: `text:shows`. */
const SUFFIX = ":shows";

/** Whether an Edit panel field is a bindable field's "shows" choice. */
export const isBindingField = (name: string) => name.endsWith(SUFFIX);

/** The text field a "shows" choice belongs to. */
export const boundFieldOf = (name: string) => name.slice(0, -SUFFIX.length);

/**
 * A bindable text field's Edit panel fields (1.17): a choice of what it shows, its own text or a
 * Site Settings value, then its own text field while it shows that. `fields` are the field as the
 * panel would show it otherwise; other fields come back unchanged.
 */
export function withBindingChoice(
  name: string,
  field: FieldDef,
  bindings: unknown,
  fields: readonly EditPanelField[],
): EditPanelField[] {
  if (field.kind !== "text" || field.bindable === undefined || field.bindable.length === 0) {
    return [...fields];
  }
  const bound = bindingOf(bindings, name);
  const choice: EditPanelField = {
    name: `${name}${SUFFIX}`,
    kind: "select",
    label: t("site.binding.shows", { field: field.label }),
    group: field.group ?? "content",
    value: bound ?? "",
    options: [
      { label: t("site.binding.ownText"), value: "" },
      ...field.bindable.map((key) => ({ label: t(`site.binding.setting.${key}`), value: key })),
    ],
  };
  // A bound field shows the Site Settings value: its own text waits, kept, for an unbinding.
  return bound === undefined ? [choice, ...fields] : [choice];
}

/**
 * The undo label for choosing what a field shows: "Heading shows Phone number", or "Heading shows
 * its own text" once unbound.
 */
export function bindingLabel(item: string, value: unknown): string {
  const setting = bindableSettingSchema.safeParse(value);
  return setting.success
    ? t("site.binding.history.setting", {
        item,
        setting: t(`site.binding.setting.${setting.data}`),
      })
    : t("site.binding.history.ownText", { item });
}

/**
 * An element's bindings with field `name` showing `value`: a Site Settings value, or `""` for its
 * own text again. `undefined` when no field is bound any more, so the prop goes away.
 */
export function withBinding(bindings: unknown, name: string, value: unknown): Bindings | undefined {
  const current = bindingsSchema.safeParse(bindings);
  const next: Record<string, string> = { ...(current.success ? current.data : {}) };
  const setting = bindableSettingSchema.safeParse(value);
  if (setting.success) {
    next[name] = setting.data;
  } else {
    delete next[name];
  }
  return Object.keys(next).length === 0 ? undefined : (next as Bindings);
}
