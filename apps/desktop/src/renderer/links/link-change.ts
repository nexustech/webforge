import {
  anchorIdSchema,
  type LinkValue,
  linkValueSchema,
  type PageId,
  pageIdSchema,
  type SiteDoc,
} from "@webforge/model";
import { z } from "zod";
import { updateField } from "../editor/apply-patch.js";
import { copySelection, updateSectionField } from "../shared-sections/index.js";

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
  const give = (current: unknown) => {
    const advanced = (current ?? {}) as { anchorId?: string };
    return advanced.anchorId === undefined || advanced.anchorId === ""
      ? { ...advanced, anchorId: anchor.anchorId }
      : advanced;
  };
  const selected = copySelection(site, anchor.pageId, anchor.nodeId);
  if (selected === undefined) {
    updateField(target.doc, page.doc, anchor.nodeId, "advanced", give);
    return;
  }
  const { shared, node } = selected;
  updateSectionField(draft, site, shared.id, node.props.id, "advanced", give);
}
