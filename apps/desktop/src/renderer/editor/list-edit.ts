import type { ListChange, ListItemValue } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { isNodeDoc, type NodeDoc, newId } from "@webforge/model";
import type {
  ComponentLibrary,
  FieldDef,
  ListItem,
  ListItemFieldDef,
} from "@webforge/site-components";

/**
 * A field the Edit panel shows as a repeating list (F-ED-6): a `list` field, whose items are plain
 * values, or a slot that allows one component type only (a FAQ's questions), whose items are
 * elements of that type.
 */
export type EditableList = {
  /** What one item is called: "Testimonial", "Question". */
  readonly itemLabel: string;
  /** The fields edited in an item's row. */
  readonly fields: Readonly<Record<string, FieldDef>>;
  /** A new item's values. */
  readonly defaults: Readonly<Record<string, unknown>>;
} & ({ readonly holds: "items" } | { readonly holds: "elements"; readonly type: string });

/** The kinds an item's row can edit: plain values. */
const ITEM_KINDS: ReadonlySet<FieldDef["kind"]> = new Set<ListItemFieldDef["kind"]>([
  "text",
  "select",
  "toggle",
  "slider",
  "color",
  "spacing",
]);

/** `field` as a list the Edit panel can edit, or undefined if it isn't one. */
export function editableList(field: FieldDef, library: ComponentLibrary): EditableList | undefined {
  if (field.kind === "list") {
    return {
      holds: "items",
      itemLabel: field.itemLabel,
      fields: field.fields,
      defaults: field.defaults,
    };
  }
  const [type, ...others] = field.kind === "slot" ? (field.allow ?? []) : [];
  const component = type === undefined ? undefined : library.components[type];
  if (type === undefined || others.length > 0 || component === undefined) {
    return undefined;
  }
  return {
    holds: "elements",
    type,
    itemLabel: component.label,
    fields: Object.fromEntries(
      Object.entries(component.fields).filter(([, def]) => ITEM_KINDS.has(def.kind)),
    ),
    defaults: component.defaults,
  };
}

const asItems = (stored: unknown): unknown[] => (Array.isArray(stored) ? stored : []);

/** An item's key and values, from a `list` item or an element. */
function itemValue(item: unknown, list: EditableList): ListItemValue | undefined {
  if (list.holds === "elements") {
    return isNodeDoc(item) ? { key: item.props.id, values: item.props } : undefined;
  }
  const values = item as Partial<ListItem> | null;
  return typeof values?.id === "string" ? { key: values.id, values } : undefined;
}

/** The items of a list's stored value, as the Edit panel shows them. */
export function listItems(stored: unknown, list: EditableList): ListItemValue[] {
  return asItems(stored).flatMap((item) => {
    const value = itemValue(item, list);
    return value === undefined ? [] : [value];
  });
}

/**
 * Applies `change` to `items`, the list's array in the document being edited (an Immer draft). An
 * added item gets the list's defaults and a new id. Returns false if there was nothing to change:
 * an item that is gone, a move out of the list.
 */
export function applyListChange(items: unknown[], change: ListChange, list: EditableList): boolean {
  if (change.type === "add") {
    const id = newId("node");
    const values = structuredClone(list.defaults);
    items.push(
      list.holds === "elements"
        ? ({ type: list.type, props: { ...values, id } } satisfies NodeDoc)
        : { ...values, id },
    );
    return true;
  }
  const index = items.findIndex((item) => itemValue(item, list)?.key === change.key);
  const item = items[index];
  if (item === undefined) {
    return false;
  }
  switch (change.type) {
    case "move":
      if (change.to < 0 || change.to >= items.length || change.to === index) {
        return false;
      }
      items.splice(index, 1);
      items.splice(change.to, 0, item);
      return true;
    case "remove":
      items.splice(index, 1);
      return true;
    case "edit": {
      const values = (list.holds === "elements" ? (item as NodeDoc).props : item) as Record<
        string,
        unknown
      >;
      values[change.name] = change.value;
      return true;
    }
  }
}

/**
 * The undo label for a change to a list's item (D2): "Added Question", "Moved Testimonial",
 * "Deleted Question", or for an item's field "Edited Testimonial quote", "Changed Testimonial
 * rating". `textLabel` names an element's text edit as the canvas does.
 */
export function listChangeLabel(
  change: ListChange,
  list: EditableList,
  textLabel: (key: string, field: string) => string,
): string {
  const item = list.itemLabel;
  switch (change.type) {
    case "add":
      return t("history.added", { item });
    case "move":
      return t("history.moved", { item });
    case "remove":
      return t("history.deleted", { item });
    case "edit": {
      const field = list.fields[change.name];
      if (field?.kind === "text" && list.holds === "elements") {
        return textLabel(change.key, change.name);
      }
      return t(field?.kind === "text" ? "history.editedField" : "history.changed", {
        item,
        field: (field?.label ?? change.name).toLowerCase(),
      });
    }
  }
}
