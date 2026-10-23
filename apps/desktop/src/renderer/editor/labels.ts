import type { EngineEdit } from "@webforge/engine";
import { t } from "@webforge/i18n";
import type { PageDoc } from "@webforge/model";
import type { ComponentLibrary, FieldDef } from "@webforge/site-components";
import { findNode } from "./nodes.js";

/**
 * How undo labels name an element: the name the user gave it in Layers ("'Opening times'"), else
 * its component's display name ("Heading"), as the glossary has it (D2).
 */
function itemName(edit: EngineEdit, library: ComponentLibrary, pages: readonly PageDoc[]): string {
  const name = ownName(edit, library, pages);
  // An element of the shared Header or Footer: "Edited shared Footer text" (F-ED-7).
  return edit.shared === true ? t("history.sharedItem", { item: name }) : name;
}

function ownName(edit: EngineEdit, library: ComponentLibrary, pages: readonly PageDoc[]): string {
  const id = edit.nodeId;
  const layout = edit.layout === undefined ? [] : [...edit.layout.header, ...edit.layout.footer];
  const node =
    id === null
      ? undefined
      : [...pages.map((page) => page.content), layout]
          .map((nodes) => findNode(nodes, (n) => n.props.id === id))
          .find(Boolean);
  const layerName = node?.props.layerName;
  if (typeof layerName === "string" && layerName.trim() !== "") {
    return t("history.namedItem", { name: layerName.trim() });
  }
  const component =
    edit.componentType === null ? undefined : library.components[edit.componentType];
  return component?.label ?? edit.componentType ?? "";
}

/** The undo label for Paste Style (1.37): "Pasted style on Heading", or on a named element. */
export function pastedStyleLabel(edit: EngineEdit, library: ComponentLibrary): string {
  return t("history.pastedStyle", { item: itemName(edit, library, [edit.page]) });
}

/** "Changed {item} {field}" for a field the component doesn't define, such as the Advanced tab's. */
export function changedLabel(edit: EngineEdit, library: ComponentLibrary, field: string): string {
  return t("history.changed", { item: itemName(edit, library, [edit.page]), field });
}

/**
 * The undo label for resetting fields to their defaults (UX-13): "Reset Heading size", or for a
 * group of them "Reset Section spacing". `what` is already translated, in lower case.
 */
export function resetLabel(edit: EngineEdit, library: ComponentLibrary, what: string): string {
  return t("history.reset", { item: itemName(edit, library, [edit.page]), field: what });
}

/**
 * The undo label for resetting an option group (UX-13): "Reset Spacing on Heading", or with
 * `device`, when only that device's values go, "Reset Heading spacing on Mobile" (F-ED-4).
 */
export function resetGroupLabel(
  edit: EngineEdit,
  library: ComponentLibrary,
  group: string,
  device?: string,
): string {
  const item = itemName(edit, library, [edit.page]);
  return device === undefined
    ? t("history.resetGroup", { group, item })
    : t("history.resetGroupOn", { item, group: group.toLocaleLowerCase(), device });
}

/** The definition of the field an edit changed, if any. */
function fieldOf(edit: EngineEdit, library: ComponentLibrary): FieldDef | undefined {
  const component =
    edit.componentType === null ? undefined : library.components[edit.componentType];
  return edit.field === null ? undefined : component?.fields[edit.field];
}

/**
 * The undo label for a change to a value set for one device (F-ED-4), e.g. "Changed Section padding
 * on Mobile", or with `reset` for dropping it again: "Reset Section padding on Mobile".
 */
export function deviceLabelFor(
  edit: EngineEdit,
  library: ComponentLibrary,
  device: string,
  reset = false,
): string {
  const item = itemName(edit, library, [edit.page]);
  const field = fieldOf(edit, library);
  return t(reset ? "history.resetOn" : "history.changedOn", {
    item,
    field: (field?.label ?? edit.field ?? "").toLowerCase(),
    device,
  });
}

/**
 * The undo label for a canvas edit (D2), e.g. "Moved Heading", "Edited Heading text" or "Edited
 * 'Opening times' text". `before` is the page as it was, where a removed element is still found.
 */
export function labelFor(edit: EngineEdit, library: ComponentLibrary, before?: PageDoc): string {
  const item = itemName(edit, library, before === undefined ? [edit.page] : [edit.page, before]);
  switch (edit.kind) {
    case "insert":
      return t("history.added", { item });
    case "move":
      return t("history.moved", { item });
    case "remove":
      return t("history.deleted", { item });
    case "duplicate":
      return t("history.duplicated", { item });
    case "text": {
      // Name the field only where the element has several kinds of text (a Hero's title, text and
      // button text); a Heading's one text stays "Edited Heading text", and so does a field named
      // like its element (a Question's question).
      const component =
        edit.componentType === null ? undefined : library.components[edit.componentType];
      const texts = Object.values(component?.fields ?? {}).filter(
        (field) => field.kind === "text" || field.kind === "richtext",
      );
      const field = fieldOf(edit, library);
      return texts.length > 1 &&
        field !== undefined &&
        field.label.toLowerCase() !== item.toLowerCase()
        ? t("history.editedField", { item, field: field.label.toLowerCase() })
        : t("history.editedText", { item });
    }
    case "props": {
      const field = fieldOf(edit, library);
      return field === undefined
        ? t("history.editedPage")
        : t("history.changed", { item, field: field.label.toLowerCase() });
    }
    case "root":
      return t("history.changedPage");
    case "page":
      return t("history.editedPage");
  }
}
