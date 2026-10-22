import {
  anchorIdSchema,
  copiedNodeId,
  copyHolding,
  type LinkValue,
  linkValueSchema,
  type NodeDoc,
  type PageDoc,
  type PageId,
  pageIdSchema,
  type SiteDoc,
} from "@webforge/model";
import { z } from "zod";
import { updateField } from "../editor/apply-patch.js";

/**
 * What a link field reports (F-ED-18): its new value, or none to remove the link, and, for a link
 * to a section that has no anchor yet, the anchor to give it. The Edit panel applies both as one
 * step, so undo takes the anchor away with the link.
 */
export type LinkFieldChange = {
  readonly link: LinkValue | undefined;
  readonly anchor?: {
    readonly pageId: PageId;
    /** The section that gets the anchor. */
    readonly nodeId: string;
    readonly anchorId: string;
  };
};

const linkFieldChangeSchema = z.strictObject({
  link: linkValueSchema.optional(),
  anchor: z
    .strictObject({ pageId: pageIdSchema, nodeId: z.string().min(1), anchorId: anchorIdSchema })
    .optional(),
});

/** `value` as a {@link LinkFieldChange}, if it is one. */
export function asLinkFieldChange(value: unknown): LinkFieldChange | undefined {
  const parsed = linkFieldChangeSchema.safeParse(value);
  return parsed.success ? (parsed.data as LinkFieldChange) : undefined;
}

/** Gives `nodeId` in `draft` (a draft of `doc`) `anchorId`, unless it has an anchor already. */
function giveAnchor(draft: PageDoc, doc: PageDoc, nodeId: string, anchorId: string): void {
  updateField(draft, doc, nodeId, "advanced", (current) => {
    const advanced = (current ?? {}) as { anchorId?: string };
    return advanced.anchorId === undefined || advanced.anchorId === ""
      ? { ...advanced, anchorId }
      : advanced;
  });
}

/**
 * Gives section `anchor.nodeId` its anchor in `draft` (a draft of `site`), unless it already has
 * one: an anchor someone may link to is never renamed behind their back. A section in a copy of a
 * shared section gets it in the shared section (F-ED-23), so every copy has it.
 */
export function applyAnchor(
  draft: SiteDoc,
  site: SiteDoc,
  anchor: NonNullable<LinkFieldChange["anchor"]>,
): void {
  const page = site.pages[anchor.pageId];
  const target = draft.pages[anchor.pageId];
  if (page === undefined || target === undefined) return;
  const copy = copyHolding(page.doc.content, anchor.nodeId);
  if (copy === undefined) {
    giveAnchor(target.doc, page.doc, anchor.nodeId, anchor.anchorId);
    return;
  }
  const id = copy.props.sharedSectionId;
  const shared = site.sharedSections[id];
  const into = draft.sharedSections[id];
  if (shared === undefined || into === undefined) return;
  const nodeId = anchor.nodeId.slice(copiedNodeId(copy.props.id, "").length);
  // updateField walks a page: the section as the only element of one.
  const asPage = (section: NodeDoc): PageDoc => ({ root: { props: {} }, content: [section] });
  giveAnchor(asPage(into.section), asPage(shared.section), nodeId, anchor.anchorId);
}
