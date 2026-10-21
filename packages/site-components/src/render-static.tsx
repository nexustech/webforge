import { imageValueSchema, isNodeDoc, type NodeDoc } from "@webforge/model";
import type { ComponentType, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { BehaviourName, ComponentDef, ComponentLibrary, RenderContext } from "./library.js";
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

/** Whether a node is exported: not hidden in Layers (F-ED-12), which leaves out its slots too. */
const isShown = (node: NodeDoc) => node.props.hidden !== true;

/**
 * Calls `visit` for every exported node in `nodes` and their slots, in document order. Hidden
 * nodes and everything in them are skipped, so their media and behaviours aren't exported either.
 */
export function walkNodes(
  nodes: readonly NodeDoc[],
  library: ComponentLibrary,
  visit: (node: NodeDoc, def: ComponentDef) => void,
): void {
  for (const node of nodes.filter(isShown)) {
    const def = definitionOf(library, node);
    visit(node, def);
    for (const [name, field] of Object.entries(def.fields)) {
      if (field.kind === "slot") {
        walkNodes(childrenIn(node.props[name]), library, visit);
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

function renderNode(node: NodeDoc, library: ComponentLibrary, context: RenderContext): ReactNode {
  const def = definitionOf(library, node);
  const { id, ...props } = node.props;
  const values: Record<string, unknown> = { ...props };
  const slots: Record<string, ComponentType> = {};
  for (const [name, field] of Object.entries(def.fields)) {
    const value = props[name];
    if (field.kind === "richtext" && typeof value === "string") {
      // On the canvas the engine passes rich text as an editor element; here it is sanitised HTML.
      values[name] = <RichText html={value} />;
    } else if (field.kind === "slot") {
      const children = childrenIn(value);
      slots[name] = () => <>{renderNodes(children, library, context)}</>;
    }
  }
  return def.render({ id, values, slots, context });
}

function renderNodes(
  nodes: readonly NodeDoc[],
  library: ComponentLibrary,
  context: RenderContext,
): ReactNode[] {
  return nodes
    .filter(isShown)
    .map((node) => (
      <StaticNode key={node.props.id} node={node} library={library} context={context} />
    ));
}

function StaticNode(props: {
  readonly node: NodeDoc;
  readonly library: ComponentLibrary;
  readonly context: RenderContext;
}) {
  return <>{renderNode(props.node, props.library, props.context)}</>;
}

/**
 * Renders a list of nodes (a page's content, or the Header or Footer) to static HTML, without any
 * editor wrappers or hidden nodes. Throws {@link UnknownComponentError} for component types the
 * library lacks.
 */
export function renderNodesToHtml(
  nodes: readonly NodeDoc[],
  library: ComponentLibrary,
  context: RenderContext,
): string {
  // Check every type first so an unknown one fails before React swallows it in a render.
  walkNodes(nodes, library, () => {});
  return renderToStaticMarkup(<>{renderNodes(nodes, library, context)}</>);
}
