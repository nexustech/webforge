import {
  copiedNodeId,
  isNodeDoc,
  isSharedCopy,
  type NodeDoc,
  type SharedCopyNode,
  type SharedSectionId,
  type SharedSectionsDoc,
} from "@webforge/model";

/** A linked copy on the page, as the page stores it. */
type Copy = NodeDoc & SharedCopyNode;

/** The shared section a copy shows, if the site has it. */
function sectionOf(shared: SharedSectionsDoc, copy: Copy): NodeDoc | undefined {
  const id = copy.props.sharedSectionId;
  return Object.hasOwn(shared, id) ? shared[id]?.section : undefined;
}

/**
 * `node`, shown in `copy`, as its shared section holds it: ids and anchors back as they are there.
 * An element added inside the copy keeps the id Puck gave it.
 */
function fromCopy(node: NodeDoc, copy: Copy): NodeDoc {
  const prefix = copiedNodeId(copy.props.id, "");
  const suffix = copy.props.anchorSuffix === undefined ? undefined : `-${copy.props.anchorSuffix}`;
  const props: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(node.props)) {
    props[name] = Array.isArray(value)
      ? value.map((item) => (isNodeDoc(item) ? fromCopy(item, copy) : item))
      : value;
  }
  const id = node.props.id;
  props.id = id.startsWith(prefix) ? id.slice(prefix.length) : id;
  const anchor = node.props.advanced?.anchorId;
  if (anchor !== undefined && suffix !== undefined && anchor.endsWith(suffix)) {
    props.advanced = { ...node.props.advanced, anchorId: anchor.slice(0, -suffix.length) };
  }
  return { type: node.type, props: props as NodeDoc["props"] };
}

/** Whether two JSON values are the same, whatever the order of their objects' keys. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => sameValue(item, b[index]))
    );
  }
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const left = Object.entries(a).filter(([, value]) => value !== undefined);
  const right = Object.entries(b).filter(([, value]) => value !== undefined);
  return (
    left.length === right.length &&
    left.every(([key, value]) => sameValue(value, (b as Record<string, unknown>)[key]))
  );
}

/** A shared section a copy now shows differently: the section as that copy shows it. */
export type ChangedSection = {
  readonly section: NodeDoc;
  /** The copy that shows it so, whose ids the canvas gives its elements. */
  readonly copyId: string;
};

/** The page's content as the canvas shows it, folded back into the page and its shared sections. */
export type FoldedCopies = {
  /** The page's own content: each copy shown is its copy node again. */
  readonly content: NodeDoc[];
  /** The shared sections a copy now shows differently, by id. */
  readonly sections: ReadonlyMap<SharedSectionId, ChangedSection>;
  /**
   * True when one edit changed more than one copy (an element moved from one copy to another),
   * or more than one shared section: that isn't an edit of one shared section, so it is refused.
   */
  readonly refused: boolean;
};

/**
 * Folds the page's content as Puck shows it (`shown`, its copies expanded) back into the page and
 * its shared sections (F-ED-23): a copy's section, found by its root's id, goes back to the copy
 * node the page had (`own`), and its content to its shared section. A copy that still shows its
 * section as it was doesn't count; one edit may change one copy only.
 */
export function foldCopies(
  shown: readonly NodeDoc[],
  own: readonly NodeDoc[],
  shared: SharedSectionsDoc,
): FoldedCopies {
  const copies = copiesOn(own);
  const content: NodeDoc[] = [];
  const sections = new Map<SharedSectionId, ChangedSection>();
  let changedCopies = 0;
  for (const node of shown) {
    const copy = copyShownBy(node, copies, shared);
    if (copy === undefined) {
      content.push(node);
      continue;
    }
    content.push(copy);
    const section = sectionOf(shared, copy);
    const now = fromCopy(node, copy);
    if (section !== undefined && !sameValue(now, section)) {
      changedCopies++;
      sections.set(copy.props.sharedSectionId, { section: now, copyId: copy.props.id });
    }
  }
  return { content, sections, refused: changedCopies > 1 };
}

/** Whether `nodes`, or anything in their slots, include an element with `id`. */
function holds(nodes: readonly NodeDoc[], id: string): boolean {
  return nodes.some(
    (node) =>
      node.props.id === id ||
      Object.values(node.props).some(
        (value) => Array.isArray(value) && holds(value.filter(isNodeDoc), id),
      ),
  );
}

/**
 * The id the canvas shows element `id` under once a changed section is shown again: an element
 * the edit added inside the copy gets the copy's id for it; any other id stays as it is.
 */
export function shownInCopy(changed: ChangedSection, id: string | null): string | null {
  return id !== null && holds([changed.section], id) ? copiedNodeId(changed.copyId, id) : id;
}

/** The copy whose section `node` is, as the canvas shows it, if it is one. */
export function copyShownBy(
  node: NodeDoc,
  copies: ReadonlyMap<string, Copy>,
  shared: SharedSectionsDoc,
): Copy | undefined {
  for (const copy of copies.values()) {
    const section = sectionOf(shared, copy);
    if (section !== undefined && node.props.id === copiedNodeId(copy.props.id, section.props.id)) {
      return copy;
    }
  }
  return undefined;
}

/** The copies on a page's own content, by id. */
export function copiesOn(own: readonly NodeDoc[]): Map<string, Copy> {
  return new Map(own.filter(isSharedCopy).map((copy) => [copy.props.id, copy]));
}
