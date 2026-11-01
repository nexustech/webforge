import type { ListChange } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { isNodeDoc, type NodeDoc, newId } from "@webforge/model";
import {
  acceptsFieldValue,
  type ComponentLibrary,
  type FieldDef,
  type ListItem,
  type ListItemFieldDef,
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
      // An item's value is the same on every device (see ListItemFieldDef).
      Object.entries(component.fields).filter(
        ([, def]) => ITEM_KINDS.has(def.kind) && def.responsive !== true,
      ),
    ),
    defaults: component.defaults,
  };
}

const asItems = (stored: unknown): unknown[] => (Array.isArray(stored) ? stored : []);

/** An item's id and values, from a `list` item or an element (its props). */
function itemValue(item: unknown, list: EditableList): ListItem | undefined {
  if (list.holds === "elements") return isNodeDoc(item) ? item.props : undefined;
  const values = item as Partial<ListItem> | null;
  return typeof values?.id === "string" ? (values as ListItem) : undefined;
}

/** The items of a list's stored value, as the Edit panel shows them. */
export function listItems(stored: unknown, list: EditableList): ListItem[] {
  return asItems(stored).flatMap((item) => {
    const value = itemValue(item, list);
    return value === undefined ? [] : [value];
  });
}

/**
 * `change`, from the Edit panel's list field, if it is a change `list` takes (#667): an item added,
 * moved to a place, or removed, or an item's field the list's items have set to a value that field
 * accepts. Anything else is refused.
 */
export function acceptedListChange(change: unknown, list: EditableList): ListChange | undefined {
  if (typeof change !== "object" || change === null || !("type" in change)) return undefined;
  const id = "id" in change && typeof change.id === "string" ? change.id : undefined;
  switch (change.type) {
    case "add":
      return { type: "add" };
    case "remove":
      return id === undefined ? undefined : { type: "remove", id };
    case "move": {
      const to = "to" in change ? change.to : undefined;
      return id === undefined || typeof to !== "number" || !Number.isInteger(to)
        ? undefined
        : { type: "move", id, to };
    }
    case "edit": {
      const name = "name" in change && typeof change.name === "string" ? change.name : undefined;
      const field = name === undefined ? undefined : list.fields[name];
      const value = "value" in change ? change.value : undefined;
      return id === undefined ||
        name === undefined ||
        field === undefined ||
        !acceptsFieldValue(field, value, { responsive: false })
        ? undefined
        : { type: "edit", id, name, value };
    }
    default:
      return undefined;
  }
}

/**
 * Applies `change` to `items`, the list's array in the document being edited (an Immer draft). An
 * added item gets the list's defaults and a new id. Returns false if there was nothing to change:
 * an item that is gone, a move out of the list, a field its items don't have or a value that field
 * doesn't take.
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
  const index = items.findIndex((item) => itemValue(item, list)?.id === change.id);
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
      // Only a field the items have, set to a value it takes (#667).
      const field = list.fields[change.name];
      if (field === undefined || !acceptsFieldValue(field, change.value, { responsive: false })) {
        return false;
      }
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
        return textLabel(change.id, change.name);
      }
      return t(field?.kind === "text" ? "history.editedField" : "history.changed", {
        item,
        field: (field?.label ?? change.name).toLowerCase(),
      });
    }
  }
}
