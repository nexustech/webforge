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

/** The page's content as the canvas shows it, folded back into the page and its shared sections. */
export type FoldedCopies = {
  /** The page's own content: each copy shown is its copy node again. */
  readonly content: NodeDoc[];
  /** The shared sections a copy now shows differently, by id, as that copy shows them. */
  readonly sections: ReadonlyMap<SharedSectionId, NodeDoc>;
};

/**
 * Folds the page's content as Puck shows it (`shown`, its copies expanded) back into the page and
 * its shared sections (F-ED-23): a copy's section, found by its root's id, goes back to the copy
 * node the page had (`own`), and its content to its shared section. `edited` is the element the
 * edit changed: when two copies of a section differ from it, the one holding that element counts.
 */
export function foldCopies(
  shown: readonly NodeDoc[],
  own: readonly NodeDoc[],
  shared: SharedSectionsDoc,
  edited: string | null,
): FoldedCopies {
  const copies = copiesOn(own);
  const content: NodeDoc[] = [];
  const sections = new Map<SharedSectionId, NodeDoc>();
  for (const node of shown) {
    const copy = copyShownBy(node, copies, shared);
    if (copy === undefined) {
      content.push(node);
      continue;
    }
    content.push(copy);
    const section = sectionOf(shared, copy);
    const now = fromCopy(node, copy);
    const id = copy.props.sharedSectionId;
    if (section !== undefined && JSON.stringify(now) !== JSON.stringify(section)) {
      // The copy the edit was in wins over another that still shows the section as it was.
      const holdsEdit = edited !== null && JSON.stringify(node).includes(`"id":"${edited}"`);
      if (!sections.has(id) || holdsEdit) sections.set(id, now);
    }
  }
  return { content, sections };
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
