import { anchorIdSchema } from "./link.js";
import { RESERVED_SLUGS } from "./site-doc.js";
import { isDeviceName } from "./site-path.js";

/** The longest slug {@link slugSchema} accepts. */
const MAX_SLUG_LENGTH = 80;

/** What a name with no usable letters or digits becomes ("!!!" → `page`). */
const FALLBACK_SLUG = "page";

/**
 * A page name as a file name (X1): lowercase ASCII letters and digits joined by single hyphens.
 * Accents are dropped ("Café Menü" → `cafe-menu`), anything else separates words, and a name with
 * nothing usable becomes `page`. The result always passes `slugSchema`, but may be reserved or
 * taken; {@link uniqueSlug} handles that.
 */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, "");
  return slug === "" ? FALLBACK_SLUG : slug;
}

/**
 * `slug`, or `slug-2`, `slug-3`… when it is reserved (`index`, `404`, `assets`), a Windows device
 * name (`con`, `com1`: no such file can be written there) or in `taken` (the slugs already used in
 * the same folder). Shortened first if the number would make it too long.
 */
export function uniqueSlug(slug: string, taken: ReadonlySet<string>): string {
  const free = (candidate: string) =>
    !RESERVED_SLUGS.has(candidate) && !isDeviceName(candidate) && !taken.has(candidate);
  if (free(slug)) {
    return slug;
  }
  for (let number = 2; ; number += 1) {
    const suffix = `-${number}`;
    const base = slug.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/-+$/, "");
    const candidate = `${base}${suffix}`;
    if (free(candidate)) {
      return candidate;
    }
  }
}

/** The longest anchor {@link anchorFrom} makes before a number, leaving room for `-99`. */
const ANCHOR_STEM_MAX = 56;

/**
 * An anchor for a section, made from its name (F-ED-18): "Opening times" → `opening-times`,
 * starting with a letter (`section-2024` for "2024"), and `-2`, `-3`… while `taken` says the page
 * has it already.
 */
export function anchorFrom(name: string, taken: (anchor: string) => boolean): string {
  const base = slugify(name);
  const start = /^[a-z]/.test(base) ? base : `section-${base}`;
  const stem = start.slice(0, ANCHOR_STEM_MAX).replace(/-+$/, "");
  let anchor = stem;
  for (let number = 2; taken(anchor) || !anchorIdSchema.safeParse(anchor).success; number++) {
    anchor = `${stem}-${number}`;
  }
  return anchor;
}
