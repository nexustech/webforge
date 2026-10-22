import { z } from "zod";
import { isNodeDoc, type NodeDoc, nodeDocSchema, withoutUnsafeKeys } from "./documents.js";
import { type SharedSectionId, sharedSectionIdSchema } from "./ids.js";

/**
 * Shared sections (F-ED-23, C5): a section saved once under a name and placed on any page, more
 * than once if needed, as linked copies. A page holds a copy node that refers to the shared
 * section by id; editing any copy edits the shared section, so every copy changes at once.
 */
export type SharedSection = {
  readonly id: SharedSectionId;
  /** The name the person gave it: the Add panel lists it, and undo labels and the banner name it. */
  readonly name: string;
  /** The section itself, with everything in it. */
  readonly section: NodeDoc;
};

/** The node type of a linked copy of a shared section. */
export const SHARED_COPY_TYPE = "SharedSectionCopy";

/** A linked copy of a shared section on a page: where it is, and which section it shows. */
export type SharedCopyNode = {
  readonly type: typeof SHARED_COPY_TYPE;
  readonly props: {
    readonly id: string;
    readonly sharedSectionId: SharedSectionId;
    /**
     * Makes this copy's anchors its own (`hours-2` for the section's `hours`) when another copy
     * on the page already has the section's anchors. Given when the copy is placed and kept, so
     * reordering copies never changes where a link goes.
     */
    readonly anchorSuffix?: string;
  };
};

/** Whether `node` is a linked copy of a shared section. */
export function isSharedCopy(node: NodeDoc): node is NodeDoc & SharedCopyNode {
  return (
    node.type === SHARED_COPY_TYPE &&
    sharedSectionIdSchema.safeParse(node.props.sharedSectionId).success
  );
}

/** Whether `nodes`, or anything in their slots, include a linked copy. */
function containsCopy(nodes: readonly NodeDoc[]): boolean {
  return nodes.some(
    (node) =>
      isSharedCopy(node) ||
      Object.values(node.props).some(
        (value) => Array.isArray(value) && containsCopy(value.filter(isNodeDoc)),
      ),
  );
}

const sharedSectionSchema = z.strictObject({
  id: sharedSectionIdSchema,
  name: z.string().trim().min(1).max(100),
  section: nodeDocSchema,
});

/**
 * The site's shared sections, by id. A shared section holds no copy of another, so editing one
 * never changes another (F-ED-23).
 */
export const sharedSectionsDocSchema: z.ZodType<Record<SharedSectionId, SharedSection>> =
  withoutUnsafeKeys(
    z.record(sharedSectionIdSchema, sharedSectionSchema).superRefine((shared, ctx) => {
      for (const [key, entry] of Object.entries(shared)) {
        if (entry.id !== key) {
          ctx.addIssue({
            code: "custom",
            message: `Shared section "${key}" has the id "${entry.id}"`,
            path: [key, "id"],
          });
        }
        if (containsCopy([entry.section])) {
          ctx.addIssue({
            code: "custom",
            message: "A shared section can't hold a copy of a shared section",
            path: [key, "section"],
          });
        }
      }
    }),
  ) as z.ZodType<Record<SharedSectionId, SharedSection>>;

/** The site's shared sections, by id. */
export type SharedSectionsDoc = Readonly<Record<SharedSectionId, SharedSection>>;

/** The id an element of a shared section has in a copy: unique on the page, whatever copy it is in. */
export function copiedNodeId(copyId: string, nodeId: string): string {
  return `${copyId}~${nodeId}`;
}

/** The anchor a copy with `suffix` gives the shared section's `anchor`. */
export function copiedAnchor(anchor: string, suffix: string | undefined): string {
  return suffix === undefined ? anchor : `${anchor}-${suffix}`;
}

/** `node` and everything in it, as it shows in the copy `copy`: ids and anchors its own. */
function inCopy(node: NodeDoc, copy: SharedCopyNode): NodeDoc {
  const props: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(node.props)) {
    props[name] = Array.isArray(value)
      ? value.map((item) => (isNodeDoc(item) ? inCopy(item, copy) : item))
      : value;
  }
  props.id = copiedNodeId(copy.props.id, node.props.id);
  const advanced = node.props.advanced;
  if (advanced?.anchorId !== undefined) {
    props.advanced = {
      ...advanced,
      anchorId: copiedAnchor(advanced.anchorId, copy.props.anchorSuffix),
    };
  }
  return { type: node.type, props: props as NodeDoc["props"] };
}

/**
 * `nodes` with every linked copy shown as its shared section (F-ED-23): what the page shows, on
 * the canvas and in the export. A copy of a shared section that isn't there shows nothing.
 */
export function expandSharedCopies(
  nodes: readonly NodeDoc[],
  shared: SharedSectionsDoc,
): NodeDoc[] {
  return nodes.flatMap((node) => {
    if (!isSharedCopy(node)) return [node];
    const entry = Object.hasOwn(shared, node.props.sharedSectionId)
      ? shared[node.props.sharedSectionId]
      : undefined;
    return entry === undefined ? [] : [inCopy(entry.section, node)];
  });
}
