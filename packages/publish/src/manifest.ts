import { createHash } from "node:crypto";
import { sitePathSchema } from "@webforge/model";
import { z } from "zod";
import { uploadOrder } from "./order.js";

/** The SHA-1 digest of `data`, as 40 lowercase hex digits (Netlify's file digest). */
export function sha1(data: Uint8Array): string {
  return createHash("sha1").update(data).digest("hex");
}

/** Every published file's path and SHA-1 digest. */
const filesSchema = z.record(sitePathSchema, z.string().regex(/^[0-9a-f]{40}$/));

/**
 * The site that published to a folder (A8, 4.3): its project and the destination it published
 * to, so another site published to the same folder is told apart before anything is replaced.
 */
export const publishedSiteSchema = z.strictObject({
  projectId: z.string().min(1).max(200),
  destinationId: z.string().min(1).max(200),
});

/** The site that published to a folder. */
export type PublishedSite = z.infer<typeof publishedSiteSchema>;

/**
 * What was published (version 2, 4.3): every file's path and SHA-1 digest, the site that
 * published it and when.
 */
export const manifestSchema = z.object({
  version: z.literal(2),
  site: publishedSiteSchema,
  publishedAt: z.iso.datetime(),
  files: filesSchema,
});

/** What was published. */
export type Manifest = z.infer<typeof manifestSchema>;

/** A manifest as a host may hold it: version 2, or version 1, which had only the files (0.3). */
const storedManifestSchema = z.discriminatedUnion("version", [
  z.object({ version: z.literal(1), files: filesSchema }),
  manifestSchema,
]);

/** What a host's manifest says: the files, and the site that published them (version 2). */
export type PublishedFiles = {
  readonly site?: PublishedSite;
  readonly files: Readonly<Record<string, string>>;
};

/** What a manifest read from a host says; `null` for anything that isn't one. */
export function readManifest(value: unknown): PublishedFiles | null {
  const parsed = storedManifestSchema.safeParse(value);
  if (!parsed.success) return null;
  return parsed.data.version === 1
    ? { files: parsed.data.files }
    : { site: parsed.data.site, files: parsed.data.files };
}

/** Every file's SHA-1 digest, by its path. */
export function digestsOf(files: ReadonlyMap<string, Uint8Array>): Record<string, string> {
  const digests: Record<string, string> = {};
  for (const [path, data] of files) {
    digests[path] = sha1(data);
  }
  return digests;
}

/** The manifest of `files`, published by `site` at `publishedAt` (an ISO time). */
export function manifestOf(
  files: ReadonlyMap<string, Uint8Array>,
  site: PublishedSite,
  publishedAt: string,
): Manifest {
  return { version: 2, site, publishedAt, files: digestsOf(files) };
}

/** What a publish has to do to turn the `previous` site into the `next` one. */
export type ManifestDiff = {
  /** New and changed files, in upload order (assets, pages, `index.html` last). */
  readonly upload: readonly string[];
  /** Files that are already published with the same content. */
  readonly unchanged: readonly string[];
  /** Files published before that the site no longer has, pages before assets. */
  readonly remove: readonly string[];
};

/**
 * Compares the `next` build with the `previous` publish (`null` for a first publish). Only files
 * the previous manifest lists are ever removed, so files someone else put there stay (08).
 */
export function diffManifest(previous: PublishedFiles | null, next: PublishedFiles): ManifestDiff {
  const before = previous?.files ?? {};
  const paths = Object.keys(next.files);
  const same = (path: string) => Object.hasOwn(before, path) && before[path] === next.files[path];
  const unchanged = paths.filter(same);
  const changed = paths.filter((path) => !same(path));
  const gone = Object.keys(before).filter((path) => !Object.hasOwn(next.files, path));
  return {
    upload: uploadOrder(changed),
    unchanged: unchanged.sort(),
    remove: uploadOrder(gone).reverse(),
  };
}
