import { createHash } from "node:crypto";
import { z } from "zod";
import { uploadOrder } from "./order.js";

/** The SHA-1 digest of `data`, as 40 lowercase hex digits (Netlify's file digest). */
export function sha1(data: Uint8Array): string {
  return createHash("sha1").update(data).digest("hex");
}

/**
 * A relative site path: `/`-separated, no leading `/`, no empty, `.` or `..` segments, no `\` or
 * `:` (a Windows drive or stream).
 * Clean-up deletes the paths a manifest lists, so a manifest read from a server must never be
 * able to point outside the site's folder.
 */
export const sitePathSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine(
    (path) =>
      !path.includes("\\") &&
      !path.includes(":") &&
      // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it rejects.
      !/[\u0000-\u001f]/.test(path) &&
      path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== ".."),
    { message: "Not a relative site path" },
  );

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
