import {
  anchorIdSchema,
  type LinkValue,
  linkValueSchema,
  type PageDoc,
  type PageId,
  pageIdSchema,
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

/**
 * Gives section `anchor.nodeId` its anchor in `draft` (the document being edited), unless it
 * already has one: an anchor someone may link to is never renamed behind their back.
 */
export function applyAnchor(
  draft: PageDoc,
  page: PageDoc,
  anchor: NonNullable<LinkFieldChange["anchor"]>,
): void {
  updateField(draft, page, anchor.nodeId, "advanced", (current) => {
    const advanced = (current ?? {}) as { anchorId?: string };
    return advanced.anchorId === undefined || advanced.anchorId === ""
      ? { ...advanced, anchorId: anchor.anchorId }
      : advanced;
  });
}
