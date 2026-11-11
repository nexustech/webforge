import type { EditPanelField } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  type Bindings,
  bindableSettingSchema,
  bindingOf,
  type CollectionField,
  ITEM_TITLE_FIELD,
  isItemBinding,
  itemBindingOf,
  validBindings,
} from "@webforge/model";
import type { FieldDef } from "@webforge/site-components";

/** What the Edit panel's "shows" choice for field `name` is called: `text:shows`. */
const SUFFIX = ":shows";

/** Whether an Edit panel field is a bindable field's "shows" choice. */
export const isBindingField = (name: string) => name.endsWith(SUFFIX);

/** The text field a "shows" choice belongs to. */
export const boundFieldOf = (name: string) => name.slice(0, -SUFFIX.length);

/** The fields of a post `field` can show (6.10a): its title, text and dates for text; pictures for a picture. */
function itemChoices(
  field: FieldDef,
  itemFields: readonly CollectionField[],
): { readonly label: string; readonly value: string }[] {
  const option = (name: string, label: string) => ({
    label: t("blog.binding.field", { field: label }),
    value: `item.${name}`,
  });
  if (field.kind === "media") {
    return field.itemBindable === true
      ? itemFields
          .filter((each) => each.kind === "image")
          .map((each) => option(each.name, each.label))
      : [];
  }
  const textual =
    (field.kind === "text" && field.bindable !== undefined && field.bindable.length > 0) ||
    (field.kind === "richtext" && field.itemBindable === true);
  return textual
    ? [
        option(ITEM_TITLE_FIELD, t("blog.binding.title")),
        ...itemFields
          .filter((each) => each.kind !== "image")
          .map((each) => option(each.name, each.label)),
      ]
    : [];
}

/**
 * A bindable field's Edit panel fields (1.17): a choice of what it shows, its own text or a Site
 * Settings value, then its own text field while it shows that. `fields` are the field as the panel
 * would show it otherwise; other fields come back unchanged. In a Blog's design (6.10a),
 * `itemFields` are the post's: a text can show its title, date or summary, a picture its picture.
 */
export function withBindingChoice(
  name: string,
  field: FieldDef,
  bindings: unknown,
  fields: readonly EditPanelField[],
  itemFields?: readonly CollectionField[],
): EditPanelField[] {
  const settings = field.kind === "text" ? (field.bindable ?? []) : [];
  const items = itemFields === undefined ? [] : itemChoices(field, itemFields);
  if (settings.length === 0 && items.length === 0) {
    return [...fields];
  }
  const item = itemBindingOf(bindings, name);
  const bound = item === undefined ? bindingOf(bindings, name) : `item.${item}`;
  const choice: EditPanelField = {
    name: `${name}${SUFFIX}`,
    kind: "select",
    label: t("site.binding.shows", { field: field.label }),
    group: field.group ?? "content",
    value: bound ?? "",
    options: [
      {
        label: field.kind === "media" ? t("blog.binding.ownPicture") : t("site.binding.ownText"),
        value: "",
      },
      ...settings.map((key) => ({ label: t(`site.binding.setting.${key}`), value: key })),
      ...items,
    ],
  };
  // A bound field shows the Site Settings value or the post's: its own waits, kept, for an
  // unbinding.
  return bound === undefined ? [choice, ...fields] : [choice];
}

/**
 * The undo label for choosing what a field shows: "Heading shows Phone number", or "Heading shows
 * its own text" once unbound.
 */
export function bindingLabel(item: string, value: unknown): string {
  if (isItemBinding(value)) {
    return t("blog.history.binding", { item, field: value.slice("item.".length) });
  }
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
  const next = validBindings(bindings);
  const setting = bindableSettingSchema.safeParse(value);
  if (setting.success) {
    next[name] = setting.data;
  } else if (isItemBinding(value)) {
    next[name] = value;
  } else {
    delete next[name];
  }
  return Object.keys(next).length === 0 ? undefined : next;
}
