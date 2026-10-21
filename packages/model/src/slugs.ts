import { RESERVED_SLUGS } from "./site-doc.js";

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
 * `slug`, or `slug-2`, `slug-3`… when it is reserved (`index`, `404`, `assets`) or in `taken`
 * (the slugs already used in the same folder). Shortened first if the number would make it too long.
 */
export function uniqueSlug(slug: string, taken: ReadonlySet<string>): string {
  const free = (candidate: string) => !RESERVED_SLUGS.has(candidate) && !taken.has(candidate);
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
