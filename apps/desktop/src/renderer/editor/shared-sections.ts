import { t } from "@webforge/i18n";
import {
  anchorsIn,
  copiedNodeId,
  copyHolding,
  expandSharedCopies,
  findNode,
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
  sharedSectionNamed,
} from "@webforge/model";
import { updateField } from "./apply-patch.js";
import type { EditorSession } from "./editor-session.js";

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

/** The shared section `id`, if the site has it as its own (never `constructor` and the like). */
export function sharedSection(site: SiteDoc, id: SharedSectionId): SharedSection | undefined {
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
 * section's other elements', and, on every page with a copy, any a copy would show as an anchor
 * already there, another copy's of the same section included (`team-2` in one copy against `team`
 * in the copy with suffix 2).
 */
export function anchorsTakenInSection(
  site: SiteDoc,
  id: SharedSectionId,
  nodeId: string,
): string[] {
  const shared = sharedSection(site, id);
  if (shared === undefined) return [];
  // The section without the element's own anchor: whatever else every copy shows.
  const section = structuredClone(shared.section);
  const own = findNode([section], (node) => node.props.id === nodeId);
  if (own?.props.advanced !== undefined) delete own.props.advanced.anchorId;
  const without = { ...site.sharedSections, [id]: { ...shared, section } };
  const taken = anchorsIn([section]);
  for (const { doc } of Object.values(site.pages)) {
    const suffixes = doc.content
      .filter(isSharedCopy)
      .filter((copy) => copy.props.sharedSectionId === id)
      .map((copy) => copy.props.anchorSuffix);
    if (suffixes.length === 0) continue;
    for (const anchor of pageAnchors(doc.content, without, site.layout)) {
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
 * Why `name` can't name a shared section (`except`, when renaming it), if it can't: another shared
 * section has it, whatever its capitals or spaces, since the Add panel lists them by name.
 */
export function nameProblem(
  site: SiteDoc,
  name: string,
  except?: SharedSectionId,
): string | undefined {
  const taken = sharedSectionNamed(site.sharedSections, name, except);
  return taken === undefined
    ? undefined
    : t("canvas.sharedSectionNameTaken", { name: t("history.namedItem", { name: taken.name }) });
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
 * hours' as a shared section"): the section goes to the site's shared sections, and the page shows
 * it as its first copy, with the same anchors, so links to it keep working. Its Layers name and
 * hidden state (F-ED-12) stay on the page, as that copy's own: other copies are neither.
 * Returns whether it saved.
 */
export function saveAsSharedSection(session: SharedSectionSession, name: string): boolean {
  const site = session.history.document.getState();
  const ui = session.ui.getState();
  const section = savableSection(site, ui.pageId, ui.nodeId);
  if (section === undefined || nameProblem(site, name) !== undefined) return false;
  const id = newId("sharedSection");
  const { layerName, hidden, ...props } = section.props;
  const stored: NodeDoc = { type: section.type, props: props as NodeDoc["props"] };
  const copy: SharedCopyNode = {
    type: SHARED_COPY_TYPE,
    props: {
      id: newId("node"),
      sharedSectionId: id,
      ...(layerName === undefined ? {} : { layerName }),
      ...(hidden === true ? { hidden } : {}),
    },
  };
  const selected = copiedNodeId(copy.props.id, section.props.id);
  session.edit(
    "props",
    t("history.savedSharedSection", { name: t("history.namedItem", { name }) }),
    (draft) => {
      const content = draft.pages[ui.pageId]?.doc.content;
      const index = content?.findIndex((node) => node.props.id === section.props.id) ?? -1;
      if (content === undefined || index === -1) return;
      draft.sharedSections[id] = { id, name, section: stored };
      content[index] = copy;
    },
    { selectionAfter: { ...ui, nodeId: selected }, apply: true },
  );
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
    { selectionAfter: { ...ui, nodeId: section.props.id }, apply: true },
  );
  return true;
}

/**
 * Renames shared section `id` to `name` (F-ED-23), in one step ("Renamed 'Hours' to 'Opening
 * hours'"). Returns false, changing nothing, if it isn't there or another shared section has the
 * name.
 */
export function renameSharedSection(
  session: SharedSectionSession,
  id: SharedSectionId,
  name: string,
): boolean {
  const site = session.history.document.getState();
  const shared = sharedSection(site, id);
  const trimmed = name.trim();
  if (shared === undefined || trimmed === "" || nameProblem(site, trimmed, id) !== undefined) {
    return false;
  }
  if (trimmed === shared.name) return true;
  session.edit(
    "props",
    t("history.renamedSharedSection", {
      name: t("history.namedItem", { name: shared.name }),
      newName: t("history.namedItem", { name: trimmed }),
    }),
    (draft) => {
      const entry = draft.sharedSections[id];
      if (entry !== undefined) entry.name = trimmed;
    },
  );
  return true;
}

/**
 * Deletes shared section `id` (F-ED-23), in one step ("Deleted shared section 'Opening hours'"):
 * every copy of it, on every page, becomes a normal section showing what the copy showed, its
 * elements with new ids and its anchors as the copy had them, so no content is lost and links to
 * it keep working. A selection inside a copy on the page shown moves to the section that copy
 * becomes. Returns whether it deleted.
 */
export function deleteSharedSection(session: SharedSectionSession, id: SharedSectionId): boolean {
  const site = session.history.document.getState();
  const shared = sharedSection(site, id);
  if (shared === undefined) return false;
  const ui = session.ui.getState();
  const selected = copySelection(site, ui.pageId, ui.nodeId);
  // The normal section each copy becomes, by page, worked out once so the step and the
  // selection agree.
  const sections = new Map<PageId, Map<string, NodeDoc>>();
  for (const page of Object.values(site.pages)) {
    const copies = page.doc.content
      .filter(isSharedCopy)
      .filter((copy) => copy.props.sharedSectionId === id);
    if (copies.length === 0) continue;
    sections.set(
      page.id,
      new Map(
        copies.flatMap((copy) => {
          const [section] = pastedCopies(expandSharedCopies([copy], site.sharedSections));
          return section === undefined ? [] : [[copy.props.id, section] as const];
        }),
      ),
    );
  }
  const nodeId =
    selected?.shared.id === id
      ? (sections.get(ui.pageId)?.get(selected.copy.props.id)?.props.id ?? null)
      : ui.nodeId;
  session.edit(
    "remove",
    t("history.deletedSharedSection", { name: t("history.namedItem", { name: shared.name }) }),
    (draft) => {
      for (const [pageId, byCopy] of sections) {
        const content = draft.pages[pageId]?.doc.content;
        content?.forEach((node, index) => {
          const section = byCopy.get(node.props.id);
          if (section !== undefined) content[index] = section;
        });
      }
      delete draft.sharedSections[id];
    },
    { selectionAfter: { ...ui, nodeId }, apply: true },
  );
  return true;
}

/**
 * A name the dialog asks for: the selected section's, to save it as a shared section, or a new
 * one for shared section `id`. `suggested` is what the field starts with.
 */
export type SharedSectionNaming =
  | { readonly kind: "save"; readonly suggested: string }
  | { readonly kind: "rename"; readonly id: SharedSectionId; readonly suggested: string };
