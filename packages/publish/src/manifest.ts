import { createHash } from "node:crypto";
import { sitePathSchema } from "@webforge/model";
import { z } from "zod";
import { uploadOrder } from "./order.js";

/** The SHA-1 digest of `data`, as 40 lowercase hex digits (Netlify's file digest). */
export function sha1(data: Uint8Array): string {
  return createHash("sha1").update(data).digest("hex");
}

/** What was published: every file's path and SHA-1 digest. */
export const manifestSchema = z.object({
  version: z.literal(1),
  files: z.record(sitePathSchema, z.string().regex(/^[0-9a-f]{40}$/)),
});

/** What was published: every file's path and SHA-1 digest. */
export type Manifest = z.infer<typeof manifestSchema>;

/** The manifest of `files`. */
export function manifestOf(files: ReadonlyMap<string, Uint8Array>): Manifest {
  const digests: Record<string, string> = {};
  for (const [path, data] of files) {
    digests[path] = sha1(data);
  }
  return { version: 1, files: digests };
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
export function diffManifest(previous: Manifest | null, next: Manifest): ManifestDiff {
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
