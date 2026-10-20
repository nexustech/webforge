import type { EngineEdit } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { isNodeDoc, type NodeDoc, type PageDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";

function findNode(nodes: readonly NodeDoc[], id: string): NodeDoc | undefined {
  for (const node of nodes) {
    if (node.props.id === id) {
      return node;
    }
    for (const value of Object.values(node.props)) {
      const found = Array.isArray(value) ? findNode(value.filter(isNodeDoc), id) : undefined;
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

/**
 * How undo labels name an element: the name the user gave it in Layers ("'Opening times'"), else
 * its component's display name ("Heading"), as the glossary has it (D2).
 */
function itemName(edit: EngineEdit, library: ComponentLibrary, pages: readonly PageDoc[]): string {
  const node =
    edit.nodeId === null
      ? undefined
      : pages.map((page) => findNode(page.content, edit.nodeId as string)).find(Boolean);
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
    case "text":
      return t("history.editedText", { item });
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
