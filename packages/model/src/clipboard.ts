import { z } from "zod";
import { isNodeDoc, type NodeDoc, nodeDocSchema, withoutUnsafeKeys } from "./documents.js";
import { newId } from "./ids.js";
import { type MediaMeta, mediaMetaSchema } from "./media.js";

/**
 * Elements on the clipboard (1.25, F-ED-16): copies of the nodes, and the Media items they show,
 * so they can be pasted into another site opened later with their images.
 */
export type CopiedElements = {
  readonly nodes: readonly NodeDoc[];
  readonly media: readonly MediaMeta[];
};

/** The most elements one copy holds. */
export const MAX_COPIED_NODES = 100;

/**
 * Validates {@link CopiedElements} read back from the system clipboard, where any program can put
 * data in Webforge's format.
 */
export const copiedElementsSchema: z.ZodType<CopiedElements> = withoutUnsafeKeys(
  z.strictObject({
    nodes: z.array(nodeDocSchema).min(1).max(MAX_COPIED_NODES),
    media: z.array(mediaMetaSchema).max(500),
  }),
);

/**
 * Copies of `nodes` to paste: every element in them, slots included, gets a new id. A section
 * anchor (`advanced.anchorId`) that the target already has, given in `takenAnchors`, is left out of
 * the copy, so links keep going to the original and the page never has the same id twice.
 */
export function pastedCopies(
  nodes: readonly NodeDoc[],
  takenAnchors: ReadonlySet<string> = new Set(),
  createId: () => string = () => newId("node"),
): NodeDoc[] {
  const taken = new Set(takenAnchors);
  // Props are JSON (they come from a site file or the clipboard), so they copy as JSON.
  const copyValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.length > 0 && value.every(isNodeDoc)
        ? value.map(copyNode)
        : value.map(copyValue);
    }
    return typeof value === "object" && value !== null
      ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copyValue(entry)]))
      : value;
  };
  const copyNode = (node: NodeDoc): NodeDoc => {
    const id = createId();
    const props: Record<string, unknown> = Object.fromEntries(
      Object.entries(node.props).map(([key, value]) => [key, copyValue(value)]),
    );
    props.id = id;
    const advanced = props.advanced as { anchorId?: unknown } | undefined;
    if (typeof advanced?.anchorId === "string") {
      if (taken.has(advanced.anchorId)) {
        const { anchorId: _taken, ...rest } = advanced;
        if (Object.keys(rest).length === 0) {
          delete props.advanced;
        } else {
          props.advanced = rest;
        }
      } else {
        taken.add(advanced.anchorId);
      }
    }
    return { type: node.type, props: props as NodeDoc["props"] };
  };
  return nodes.map(copyNode);
}
