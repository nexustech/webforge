import type { EngineEdit } from "@webforge/engine";
import { t } from "@webforge/i18n";
import type { PageDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { findNode } from "./nodes.js";

/**
 * How undo labels name an element: the name the user gave it in Layers ("'Opening times'"), else
 * its component's display name ("Heading"), as the glossary has it (D2).
 */
function itemName(edit: EngineEdit, library: ComponentLibrary, pages: readonly PageDoc[]): string {
  const id = edit.nodeId;
  const node =
    id === null
      ? undefined
      : pages.map((page) => findNode(page.content, (n) => n.props.id === id)).find(Boolean);
  const layerName = node?.props.layerName;
  if (typeof layerName === "string" && layerName.trim() !== "") {
    return t("history.namedItem", { name: layerName.trim() });
  }
  const component =
    edit.componentType === null ? undefined : library.components[edit.componentType];
  return component?.label ?? edit.componentType ?? "";
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
      // button text); a Heading's one text stays "Edited Heading text".
      const component =
        edit.componentType === null ? undefined : library.components[edit.componentType];
      const texts = Object.values(component?.fields ?? {}).filter(
        (field) => field.kind === "text" || field.kind === "richtext",
      );
      const field = edit.field === null ? undefined : component?.fields[edit.field];
      return texts.length > 1 && field !== undefined
        ? t("history.editedField", { item, field: field.label.toLowerCase() })
        : t("history.editedText", { item });
    }
    case "props": {
      const component =
        edit.componentType === null ? undefined : library.components[edit.componentType];
      const field = edit.field === null ? undefined : component?.fields[edit.field];
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
