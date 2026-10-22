import { t } from "@webforge/i18n";
import {
  copiedNodeId,
  copyHolding,
  expandSharedCopies,
  isSharedCopy,
  type NodeDoc,
  newId,
  type PageDoc,
  type PageId,
  pageAnchors,
  pastedCopies,
  SHARED_COPY_TYPE,
  type SharedCopyNode,
  type SharedSection,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import { updateField } from "../editor/apply-patch.js";
import type { EditorSession } from "../editor/editor-session.js";
import { findNode } from "../editor/nodes.js";

/**
 * Shared sections in the editor (1.29, F-ED-23): saving a section as one, finding the copy an
 * element the canvas shows is in, and detaching a copy. The canvas edits copies itself (the engine
 * folds them back into their shared section); this is what the commands, the Edit panel, the banner
 * and the clipboard need.
 */

/** The parts of an editor session these actions use. */
type SharedSectionSession = Pick<EditorSession, "history" | "ui" | "edit">;

/** An element the canvas shows in a linked copy, and where it really is. */
export type CopySelection = {
  /** The copy on the page. */
  readonly copy: NodeDoc & SharedCopyNode;
  /** The shared section it shows. */
  readonly shared: SharedSection;
  /** The element as the shared section holds it: the section itself, or something in it. */
  readonly node: NodeDoc;
};

/** The shared section `id`, if the site has it. */
function sharedSection(site: SiteDoc, id: SharedSectionId): SharedSection | undefined {
  return Object.hasOwn(site.sharedSections, id) ? site.sharedSections[id] : undefined;
}

/** Where `nodeId`, an element the canvas shows on page `pageId`, is when it is in a copy. */
export function copySelection(
  site: SiteDoc,
  pageId: PageId,
  nodeId: string | null,
): CopySelection | undefined {
  if (nodeId === null) return undefined;
  const copy = copyHolding(site.pages[pageId]?.doc.content ?? [], nodeId);
  const shared = copy === undefined ? undefined : sharedSection(site, copy.props.sharedSectionId);
  if (copy === undefined || shared === undefined) return undefined;
  const id = nodeId.slice(copiedNodeId(copy.props.id, "").length);
  const node = findNode([shared.section], (candidate) => candidate.props.id === id);
  return node === undefined ? undefined : { copy, shared, node };
}

/** `section` as a page, for the helpers that walk a page's content. */
const asPage = (section: NodeDoc): PageDoc => ({ root: { props: {} }, content: [section] });

/**
 * Sets one field of element `nodeId` of shared section `id` in `draft`, a draft of `site`, to what
 * `next` makes of its current value: every copy shows the change. Returns false if it isn't there.
 */
export function updateSectionField(
  draft: SiteDoc,
  site: SiteDoc,
  id: SharedSectionId,
  nodeId: string,
  field: string,
  next: (current: unknown) => unknown,
): boolean {
  const from = sharedSection(site, id);
  const into = Object.hasOwn(draft.sharedSections, id) ? draft.sharedSections[id] : undefined;
  if (from === undefined || into === undefined) return false;
  return updateField(asPage(into.section), asPage(from.section), nodeId, field, next);
}

/** How far a change to shared section `id` reaches: its copies, and the pages they are on. */
export function reachOf(
  site: SiteDoc,
  id: SharedSectionId,
): { readonly copies: number; readonly pages: number } {
  let copies = 0;
  let pages = 0;
  for (const page of Object.values(site.pages)) {
    const here = page.doc.content.filter(
      (node) => isSharedCopy(node) && node.props.sharedSectionId === id,
    ).length;
    copies += here;
    if (here > 0) pages++;
  }
  return { copies, pages };
}

/**
 * The anchors a section's element `nodeId` can't take (Advanced mode's anchor field): its
 * section's other elements', and, on every page with a copy, any the copy would show it as.
 */
export function anchorsTakenInSection(
  site: SiteDoc,
  id: SharedSectionId,
  nodeId: string,
): string[] {
  const taken = new Set<string>();
  const shared = sharedSection(site, id);
  if (shared === undefined) return [];
  findNode([shared.section], (node) => {
    const anchor = node.props.advanced?.anchorId;
    if (anchor !== undefined && anchor !== "" && node.props.id !== nodeId) taken.add(anchor);
    return false;
  });
  for (const { doc } of Object.values(site.pages)) {
    const isCopy = (node: NodeDoc) => isSharedCopy(node) && node.props.sharedSectionId === id;
    const suffixes = doc.content
      .filter(isSharedCopy)
      .filter((copy) => copy.props.sharedSectionId === id)
      .map((copy) => copy.props.anchorSuffix);
    if (suffixes.length === 0) continue;
    const others = pageAnchors(
      doc.content.filter((node) => !isCopy(node)),
      site.sharedSections,
      site.layout,
    );
    for (const anchor of others) {
      for (const suffix of suffixes) {
        // The anchor this copy would show as `anchor`, if any (`hours` for `hours-2` in copy 2).
        if (suffix === undefined) taken.add(anchor);
        else if (anchor.endsWith(`-${suffix}`)) taken.add(anchor.slice(0, -suffix.length - 1));
      }
    }
  }
  return [...taken];
}

/**
 * The section that the selected element `nodeId` of page `pageId` is, if it can be saved as a shared
 * section: a section of the page itself, not a copy (no shared section in another) and never the
 * Header or Footer.
 */
export function savableSection(
  site: SiteDoc,
  pageId: PageId,
  nodeId: string | null,
): NodeDoc | undefined {
  const content = site.pages[pageId]?.doc.content ?? [];
  const node = content.find((candidate) => candidate.props.id === nodeId);
  return node === undefined || isSharedCopy(node) ? undefined : node;
}

/**
 * Saves the selected section as shared section `name` (F-ED-23), in one step ("Saved 'Opening
 * hours' as a shared section"): the section goes to the site's shared sections as it is, and the
 * page shows it as its first copy, with the same anchors, so links to it keep working. Returns
 * whether it saved.
 */
export function saveAsSharedSection(session: SharedSectionSession, name: string): boolean {
  const site = session.history.document.getState();
  const ui = session.ui.getState();
  const section = savableSection(site, ui.pageId, ui.nodeId);
  if (section === undefined) return false;
  const id = newId("sharedSection");
  const copy: SharedCopyNode = {
    type: SHARED_COPY_TYPE,
    props: { id: newId("node"), sharedSectionId: id },
  };
  const selected = copiedNodeId(copy.props.id, section.props.id);
  session.edit(
    "props",
    t("history.savedSharedSection", { name: t("history.namedItem", { name }) }),
    (draft) => {
      const content = draft.pages[ui.pageId]?.doc.content;
      const index = content?.findIndex((node) => node.props.id === section.props.id) ?? -1;
      if (content === undefined || index === -1) return;
      draft.sharedSections[id] = { id, name, section };
      content[index] = copy;
    },
    { selectionAfter: { ...ui, nodeId: selected } },
  );
  session.ui.setState({ nodeId: selected });
  return true;
}

/**
 * Detaches the copy the selected element is in (F-ED-23), in one step ("Detached 'Opening
 * hours'"): the page gets a normal section showing what the copy showed, its elements with new ids
 * and its anchors as the copy had them, so links to it keep working. The shared section and its
 * other copies stay. Selects the new section. Returns whether it detached.
 */
export function detachCopy(session: SharedSectionSession): boolean {
  const site = session.history.document.getState();
  const ui = session.ui.getState();
  const selected = copySelection(site, ui.pageId, ui.nodeId);
  if (selected === undefined) return false;
  const { copy, shared } = selected;
  const [section] = pastedCopies(expandSharedCopies([copy], site.sharedSections));
  if (section === undefined) return false;
  session.edit(
    "props",
    t("history.detachedSharedSection", { name: t("history.namedItem", { name: shared.name }) }),
    (draft) => {
      const content = draft.pages[ui.pageId]?.doc.content;
      const index = content?.findIndex((node) => node.props.id === copy.props.id) ?? -1;
      if (content !== undefined && index !== -1) content[index] = section;
    },
    { selectionAfter: { ...ui, nodeId: section.props.id } },
  );
  session.ui.setState({ nodeId: section.props.id });
  return true;
}
