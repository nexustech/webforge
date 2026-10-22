import {
  imageValueSchema,
  isNodeDoc,
  linkValueSchema,
  type NodeDoc,
  rewriteRichTextLinks,
} from "@webforge/model";
import type { ComponentType, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type BehaviourName,
  type ComponentDef,
  type ComponentLibrary,
  type RenderContext,
  withAdvanced,
} from "./library.js";
import { RichText } from "./rich-text.js";

/** A node uses a component type the library does not have (a build failure, X5). */
export class UnknownComponentError extends Error {
  readonly componentType: string;

  constructor(componentType: string) {
    super(`Unknown component type "${componentType}"`);
    this.name = "UnknownComponentError";
    this.componentType = componentType;
  }
}

function definitionOf(library: ComponentLibrary, node: NodeDoc): ComponentDef {
  const def = library.components[node.type];
  if (def === undefined) {
    throw new UnknownComponentError(node.type);
  }
  return def;
}

function childrenIn(value: unknown): NodeDoc[] {
  return Array.isArray(value) ? value.filter(isNodeDoc) : [];
}

/** Options of {@link walkNodes} and {@link renderNodesToHtml}. */
type NodeListOptions = {
  /**
   * Include nodes hidden in Layers (F-ED-12). The export leaves them out (the default); the canvas
   * still shows them, dimmed, so its site CSS needs their classes (#142). This also skips nodes of
   * component types the library lacks instead of failing, so one such node (from an older or
   * hand-edited file) doesn't stop the canvas styling the rest.
   */
  readonly includeHidden?: boolean;
};

/**
 * Which nodes `options` keeps: those not hidden in Layers (with everything in them), or for
 * `includeHidden` every node of a known component type.
 */
const keeps =
  (options: NodeListOptions, library: ComponentLibrary) =>
  (node: NodeDoc): boolean =>
    options.includeHidden === true
      ? library.components[node.type] !== undefined
      : node.props.hidden !== true;

/**
 * Calls `visit` for every node in `nodes` and their slots, in document order. Hidden nodes and
 * everything in them are skipped unless `options.includeHidden`, so by default their media and
 * behaviours aren't exported.
 */
export function walkNodes(
  nodes: readonly NodeDoc[],
  library: ComponentLibrary,
  visit: (node: NodeDoc, def: ComponentDef) => void,
  options: NodeListOptions = {},
): void {
  for (const node of nodes.filter(keeps(options, library))) {
    const def = definitionOf(library, node);
    visit(node, def);
    for (const [name, field] of Object.entries(def.fields)) {
      if (field.kind === "slot") {
        walkNodes(childrenIn(node.props[name]), library, visit, options);
      }
    }
  }
}

/** The media ids that `nodes` use in `media` fields (image values). */
export function mediaUsedBy(nodes: readonly NodeDoc[], library: ComponentLibrary): Set<string> {
  const ids = new Set<string>();
  walkNodes(nodes, library, (node, def) => {
    for (const [name, field] of Object.entries(def.fields)) {
      const placed = field.kind === "media" ? imageValueSchema.safeParse(node.props[name]) : null;
      if (placed?.success === true) {
        ids.add(placed.data.mediaId);
      }
    }
  });
  return ids;
}

/**
 * The Media ids of the documents that `nodes` link to in `link` fields (1.28): the export copies
 * these, and only these, to `files/`.
 */
export function documentsLinkedBy(
  nodes: readonly NodeDoc[],
  library: ComponentLibrary,
): Set<string> {
  const ids = new Set<string>();
  walkNodes(nodes, library, (node, def) => {
    for (const [name, field] of Object.entries(def.fields)) {
      const link = field.kind === "link" ? linkValueSchema.safeParse(node.props[name]) : null;
      if (link?.success === true && link.data.kind === "file") {
        ids.add(link.data.mediaId);
      }
    }
  });
  return ids;
}

/** The `webforge.js` behaviours that `nodes` need, in a stable order. */
export function behavioursUsedBy(
  nodes: readonly NodeDoc[],
  library: ComponentLibrary,
): BehaviourName[] {
  const names = new Set<BehaviourName>();
  walkNodes(nodes, library, (_node, def) => {
    for (const name of def.behaviours ?? []) names.add(name);
  });
  return [...names].sort();
}

/** What rendering a list of nodes needs, passed down to the nodes in slots. */
type Rendering = {
  readonly library: ComponentLibrary;
  readonly context: RenderContext;
  readonly keep: (node: NodeDoc) => boolean;
};

function renderNode(node: NodeDoc, rendering: Rendering): ReactNode {
  const { library, context } = rendering;
  const def = definitionOf(library, node);
  const { id, ...props } = node.props;
  const values: Record<string, unknown> = { ...props };
  const slots: Record<string, ComponentType> = {};
  for (const [name, field] of Object.entries(def.fields)) {
    const value = props[name];
    if (field.kind === "richtext" && typeof value === "string") {
      // On the canvas the engine passes rich text as an editor element; here it is sanitised HTML,
      // its links to the site's pages pointing at their exported files (F-ED-18).
      values[name] = <RichText html={rewriteRichTextLinks(value, context.href)} />;
    } else if (field.kind === "slot") {
      const children = childrenIn(value);
      slots[name] = () => <>{renderNodes(children, rendering)}</>;
    }
  }
  return withAdvanced(def.render({ id, values, slots, context }), props.advanced);
}

function renderNodes(nodes: readonly NodeDoc[], rendering: Rendering): ReactNode[] {
  return nodes
    .filter(rendering.keep)
    .map((node) => <StaticNode key={node.props.id} node={node} rendering={rendering} />);
}

function StaticNode(props: { readonly node: NodeDoc; readonly rendering: Rendering }) {
  return <>{renderNode(props.node, props.rendering)}</>;
}

/**
 * Renders a list of nodes (a page's content, or the Header or Footer) to static HTML, without any
 * editor wrappers, and without hidden nodes unless `options.includeHidden`. Throws
 * {@link UnknownComponentError} for component types the library lacks.
 */
export function renderNodesToHtml(
  nodes: readonly NodeDoc[],
  library: ComponentLibrary,
  context: RenderContext,
  options: NodeListOptions = {},
): string {
  // Check every type first so an unknown one fails before React swallows it in a render.
  walkNodes(nodes, library, () => {}, options);
  const rendering: Rendering = { library, context, keep: keeps(options, library) };
  return renderToStaticMarkup(<>{renderNodes(nodes, rendering)}</>);
}
