import { z } from "zod";
import { V1_REASON, V1_SITE_FORMAT } from "./schema.js";
import { readRow } from "./schema-check.js";
import {
  type AssetInfo,
  reasonOfKind,
  VERSION_REASONS,
  type VersionInfo,
  type VersionPublish,
  versionPublishSchema,
} from "./store-types.js";

// The rows a project store reads, as it reads them (#986, out of `project-store.ts`): each checked,
// as the file is untrusted.

export const documentRowSchema = z.object({ id: z.string(), kind: z.string(), hash: z.string() });
export const blobRowSchema = z.object({ mime: z.string(), data: z.instanceof(Uint8Array) });
const versionRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["manual", "auto"]),
  reason: z.string(),
  created_at: z.string(),
  site_format: z.number(),
  thumbnail_hash: z.string().nullable(),
  published_to: z.string().nullable(),
});

/** A version's row as {@link VERSION_COLUMNS} reads it. */
export function toVersionInfo(row: unknown): VersionInfo {
  const version = readRow(versionRowSchema, row);
  // A newer Webforge may save for a reason this one doesn't know: who saved it is still known.
  const reason = z.enum(VERSION_REASONS).safeParse(version.reason);
  return {
    id: version.id,
    name: version.name,
    kind: version.kind,
    reason: reason.success ? reason.data : reasonOfKind(version.kind),
    createdAt: version.created_at,
    siteFormat: version.site_format,
    thumbnailHash: version.thumbnail_hash ?? undefined,
    publishedTo: publishOf(version.published_to),
  };
}

/** What a version's `published_to` says, if it says it: a fact to show, never one to fail on. */
function publishOf(text: string | null): VersionPublish | undefined {
  if (text === null) return undefined;
  try {
    const parsed = versionPublishSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The columns a version is read from: by name, so a newer format's added ones are never read. A
 * format 1 file, opened read-only, says why and in which site format as its migration would.
 */
export const VERSION_COLUMNS = (format: number) =>
  format >= 2
    ? "id, name, kind, reason, created_at, site_format, thumbnail_hash, published_to"
    : `id, name, kind, ${V1_REASON} AS reason, created_at, ${V1_SITE_FORMAT} AS site_format,
       NULL AS thumbnail_hash, NULL AS published_to`;

/** The site format `documents`' `site` document records, or 1 when it records none. */
export function siteFormatOf(
  documents: Iterable<{ readonly id: string; readonly content: unknown }>,
): number {
  for (const { id, content } of documents) {
    if (id !== "site") continue;
    const site = z.object({ formatVersion: z.int().positive() }).safeParse(content);
    return site.success ? site.data.formatVersion : 1;
  }
  return 1;
}

const assetRowSchema = z.object({
  media_id: z.string(),
  blob_hash: z.string(),
  mime: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  original_name: z.string(),
});

/** The columns an asset is read from: by name, so a newer format's added ones are never read. */
export const ASSET_COLUMNS = "media_id, blob_hash, mime, width, height, original_name";

export function toAssetInfo(row: unknown): AssetInfo {
  const asset = readRow(assetRowSchema, row);
  return {
    mediaId: asset.media_id,
    hash: asset.blob_hash,
    mime: asset.mime,
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
    originalName: asset.original_name,
  };
}
