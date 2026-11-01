import { z } from "zod";
import { isNodeDoc, type NodeDoc, nodeDocSchema, withoutUnsafeKeys } from "./documents.js";
import { newId, type SharedSectionId, sharedSectionIdSchema } from "./ids.js";
import { type MediaMeta, mediaMetaSchema } from "./media.js";
import { MIGRATIONS, migrateSiteWith, type RawSite } from "./migrations.js";
import { SITE_FORMAT_VERSION } from "./site-doc.js";

/**
 * Elements on the clipboard (1.25, F-ED-16): copies of the nodes, and the Media items they show,
 * so they can be pasted into another site opened later with their images.
 */
export type CopiedElements = {
  readonly nodes: readonly NodeDoc[];
  readonly media: readonly MediaMeta[];
  /**
   * For a copied linked copy of a shared section (F-ED-23), the shared section's id: pasted into a
   * site that has it, it places another linked copy; elsewhere, `nodes` (the section) is pasted.
   */
  readonly sharedSectionId?: SharedSectionId | undefined;
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
    sharedSectionId: sharedSectionIdSchema.optional(),
  }),
);

/**
 * Copied elements as the system clipboard holds them: with the site format they were copied in
 * (ADR 0012), so a later build migrates them as it migrates a site, and an older one refuses them.
 */
export type ClipboardPayload = CopiedElements & { readonly formatVersion: number };

/**
 * The format of copied elements written before the clipboard named one: every such build wrote
 * format 12 or older, and none was released, so 12 is assumed.
 */
const UNVERSIONED_FORMAT = 12;

/** `elements` as the clipboard holds them, in this build's site format. */
export function clipboardPayload(elements: CopiedElements): ClipboardPayload {
  return { formatVersion: SITE_FORMAT_VERSION, ...elements };
}

/** What {@link readClipboardPayload} makes of the clipboard's data. */
export type ReadClipboardPayload =
  | { readonly status: "elements"; readonly elements: CopiedElements }
  /** Copied in a newer build, whose format this one can't read. */
  | { readonly status: "newer-format" }
  /** Not copied elements, or not valid ones. */
  | { readonly status: "invalid" };

/**
 * The copied elements in `raw`, read from the system clipboard, where any program can put data in
 * Webforge's format: brought from the format they were copied in up to this build's, through the
 * site migration chain (ADR 0012), then validated. Elements copied in a newer build are refused.
 */
export function readClipboardPayload(raw: unknown): ReadClipboardPayload {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { status: "invalid" };
  const { formatVersion, ...rest } = raw as Record<string, unknown>;
  const version = formatVersion ?? UNVERSIONED_FORMAT;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return { status: "invalid" };
  }
  if (version > SITE_FORMAT_VERSION) return { status: "newer-format" };
  const parsed = copiedElementsSchema.safeParse(
    version === SITE_FORMAT_VERSION ? rest : migratedElements(rest, version),
  );
  return parsed.success ? { status: "elements", elements: parsed.data } : { status: "invalid" };
}

/** The page of the site that carries copied elements through the migration chain. */
const CARRIED_PAGE = "clipboard";

/**
 * `copied`, of site format `version`, brought up to this build's: its nodes on a page of a site
 * holding nothing else, and its Media items as that site's, migrated as a site would be. `null`
 * when the chain can't take them; validating then refuses it.
 */
function migratedElements(copied: Record<string, unknown>, version: number): unknown {
  const { nodes, media, ...rest } = copied;
  if (!Array.isArray(nodes) || !Array.isArray(media)) return null;
  const items = media.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null && typeof item.id === "string",
  );
  const carrier: RawSite = {
    formatVersion: version,
    pages: { [CARRIED_PAGE]: { doc: { root: { props: {} }, content: nodes } } },
    layout: { header: [], footer: [] },
    media: Object.fromEntries(items.map((item) => [item.id, item])),
  };
  let migrated: RawSite;
  try {
    migrated = migrateSiteWith(carrier, {
      migrations: MIGRATIONS,
      currentVersion: SITE_FORMAT_VERSION,
    });
  } catch {
    // Anything the chain can't take, as `migrateSite` treats it: not elements to paste.
    return null;
  }
  const pages = migrated.pages as Record<string, { doc: { content: unknown } }>;
  return {
    ...rest,
    nodes: pages[CARRIED_PAGE]?.doc.content,
    media: Object.values(migrated.media as Record<string, unknown>),
  };
}

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
