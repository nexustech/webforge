import { z } from "zod";
import {
  anchorsIn,
  isNodeDoc,
  type LayoutDoc,
  type NodeAdvanced,
  type NodeDoc,
  nodeAdvancedSchema,
  nodeDocSchema,
  withoutUnsafeKeys,
} from "./documents.js";
import { newId, type SharedSectionId, sharedSectionIdSchema } from "./ids.js";
import { ANCHOR_ID_MAX } from "./link.js";

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
    /** Its name in Layers, shown for its section there (F-ED-12). */
    readonly layerName?: string | undefined;
    /** Hidden in Layers: this copy dimmed on the canvas and left out of the export (F-ED-12). */
    readonly hidden?: boolean | undefined;
    /** Kept as any node may have it; the copy shows its shared section's own. */
    readonly advanced?: NodeAdvanced | undefined;
  };
};

/** Whether `node` is a linked copy of a shared section. */
export function isSharedCopy(node: NodeDoc): node is NodeDoc & SharedCopyNode {
  return (
    node.type === SHARED_COPY_TYPE &&
    sharedSectionIdSchema.safeParse(node.props.sharedSectionId).success
  );
}

/** Whether `nodes`, or anything in their slots, include a linked copy, valid or not. */
export function containsCopy(nodes: readonly NodeDoc[]): boolean {
  return nodes.some(
    (node) =>
      node.type === SHARED_COPY_TYPE ||
      Object.values(node.props).some(
        (value) => Array.isArray(value) && containsCopy(value.filter(isNodeDoc)),
      ),
  );
}

/** A copy node as files and IPC carry it: its suffix goes into HTML ids, so digits only. */
const sharedCopyNodeSchema = z.strictObject({
  type: z.literal(SHARED_COPY_TYPE),
  props: z.strictObject({
    id: z.string().min(1),
    sharedSectionId: sharedSectionIdSchema,
    anchorSuffix: z
      .string()
      .regex(/^[1-9][0-9]{0,5}$/)
      .optional(),
    // What Layers sets on any node: renaming or hiding a copy (F-ED-12).
    layerName: z.string().max(100).optional(),
    hidden: z.boolean().optional(),
    advanced: nodeAdvancedSchema.optional(),
  }),
});

/** A problem with the copies on a page, and where it is in the page's content. */
type CopyIssue = { readonly message: string; readonly path: PropertyKey[] };

/**
 * The problems with the linked copies in `content`, a page's top level: each copy is a valid copy
 * node, only at the top level (only that is expanded, F-ED-23), and two copies of one section never
 * share a suffix, which would give the page two elements with one anchor.
 */
export function copyIssues(content: readonly NodeDoc[]): CopyIssue[] {
  const issues: CopyIssue[] = [];
  const suffixes = new Set<string>();
  content.forEach((node, index) => {
    if (node.type !== SHARED_COPY_TYPE) {
      if (containsCopy([node])) {
        issues.push({
          message: "A copy of a shared section can only be at the top of a page",
          path: [index],
        });
      }
      return;
    }
    const parsed = sharedCopyNodeSchema.safeParse(node);
    if (!parsed.success) {
      issues.push({ message: "Not a valid copy of a shared section", path: [index] });
      return;
    }
    const { sharedSectionId, anchorSuffix } = parsed.data.props;
    const key = `${sharedSectionId} ${anchorSuffix ?? ""}`;
    if (suffixes.has(key)) {
      issues.push({
        message: "Two copies of a shared section have the same anchors",
        path: [index],
      });
    }
    suffixes.add(key);
  });
  return issues;
}

/** The longest name a shared section may have. */
export const SHARED_SECTION_NAME_MAX = 100;

const sharedSectionSchema = z.strictObject({
  id: sharedSectionIdSchema,
  name: z.string().trim().min(1).max(SHARED_SECTION_NAME_MAX),
  section: nodeDocSchema,
});

/**
 * Whether two shared section names are the same name: the Add panel lists shared sections by
 * name, so no two may share one, whatever its spaces around it or its capitals.
 */
export function sameSharedName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The shared section in `shared` called `name`, other than `except`, if there is one. */
export function sharedSectionNamed(
  shared: Readonly<Record<SharedSectionId, SharedSection>>,
  name: string,
  except?: SharedSectionId,
): SharedSection | undefined {
  return Object.values(shared).find(
    (entry) => entry.id !== except && sameSharedName(entry.name, name),
  );
}

/**
 * The site's shared sections, by id. A shared section holds no copy of another, so editing one
 * never changes another (F-ED-23).
 */
export const sharedSectionsDocSchema: z.ZodType<Record<SharedSectionId, SharedSection>> =
  withoutUnsafeKeys(
    z.record(sharedSectionIdSchema, sharedSectionSchema).superRefine((shared, ctx) => {
      const named = new Set<string>();
      for (const [key, entry] of Object.entries(shared)) {
        const name = entry.name.toLowerCase();
        if (named.has(name)) {
          ctx.addIssue({
            code: "custom",
            message: `Two shared sections are called "${entry.name}"`,
            path: [key, "name"],
          });
        }
        named.add(name);
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

/**
 * The anchor a copy with `suffix` gives the shared section's `anchor`: `hours-2` for `hours`. A long
 * anchor is shortened first, so the copy's is never longer than an anchor may be.
 */
export function copiedAnchor(anchor: string, suffix: string | undefined): string {
  if (suffix === undefined) return anchor;
  const end = `-${suffix}`;
  return `${anchor.slice(0, ANCHOR_ID_MAX - end.length).replace(/-+$/, "")}${end}`;
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
 * The section copy `copy` shows: its shared section's `section`, ids and anchors its own, under
 * the copy's Layers name and hidden when the copy is (F-ED-12), so the canvas dims it and the
 * export leaves it out.
 */
function shownBy(section: NodeDoc, copy: SharedCopyNode): NodeDoc {
  const shown = inCopy(section, copy);
  const { layerName, hidden } = copy.props;
  if (layerName !== undefined) shown.props.layerName = layerName;
  if (hidden === true) shown.props.hidden = true;
  return shown;
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
    return entry === undefined ? [] : [shownBy(entry.section, node)];
  });
}

/**
 * Every anchor in use on a page with `content`: its own sections', its copies' as they show them,
 * and the Header's and Footer's.
 */
export function pageAnchors(
  content: readonly NodeDoc[],
  shared: SharedSectionsDoc,
  layout: LayoutDoc,
): Set<string> {
  return anchorsIn([...layout.header, ...expandSharedCopies(content, shared), ...layout.footer]);
}

/** The copy in `content`, a page's top level, that shows the element the canvas calls `nodeId`. */
export function copyHolding(
  content: readonly NodeDoc[],
  nodeId: string,
): (NodeDoc & SharedCopyNode) | undefined {
  return content
    .filter(isSharedCopy)
    .find((copy) => nodeId.startsWith(copiedNodeId(copy.props.id, "")));
}

/**
 * A new linked copy of shared section `id` to place among `content`, a page's top level (the Add
 * panel, a paste). The first copy of a section on a page keeps its anchors; another gets the
 * lowest suffix no copy there has (`2`, `3`…), kept for good, so each copy can be linked to. A
 * suffix that would give the copy an anchor the page already has (`hours-2` from the link dialog,
 * or the Header's) is skipped.
 */
export function newSharedCopy(
  content: readonly NodeDoc[],
  id: SharedSectionId,
  shared: SharedSectionsDoc,
  layout: LayoutDoc,
): SharedCopyNode {
  const used = new Set(
    content
      .filter((node) => isSharedCopy(node) && node.props.sharedSectionId === id)
      .map((node) => node.props.anchorSuffix),
  );
  const section = Object.hasOwn(shared, id) ? shared[id]?.section : undefined;
  const anchors = section === undefined ? [] : [...anchorsIn([section])];
  const taken = pageAnchors(content, shared, layout);
  const free = (suffix: string | undefined) =>
    !used.has(suffix) && anchors.every((anchor) => !taken.has(copiedAnchor(anchor, suffix)));
  let suffix: string | undefined;
  for (let next = 2; !free(suffix); next++) suffix = String(next);
  return {
    type: SHARED_COPY_TYPE,
    props: {
      id: newId("node"),
      sharedSectionId: id,
      ...(suffix === undefined ? {} : { anchorSuffix: suffix }),
    },
  };
}
