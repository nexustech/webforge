import type { ComponentLibrary } from "@webforge/site-components";
import type { CanvasDocs } from "./route-edit.js";
import { composePage } from "./shared-layout.js";
import { allNodes } from "./tree.js";

/**
 * The name of each element the canvas shows, by id, for the View menu's labels (F-ED-25): its
 * Layers name, else its component's (from `library`), else its type.
 */
export function elementNames(
  docs: CanvasDocs,
  library: ComponentLibrary | null,
): ReadonlyMap<string, string> {
  const nodes = allNodes(composePage(docs.page, docs.layout, docs.shared));
  return new Map(
    nodes.map((node) => [
      node.props.id,
      node.props.layerName?.trim() || (library?.components[node.type]?.label ?? node.type),
    ]),
  );
}
