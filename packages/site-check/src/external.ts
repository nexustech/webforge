/**
 * The outside files a site's own code loads (C8, 3.9): what Site Check stops the export for unless
 * Settings allow their address, since a site that loads nothing from elsewhere works from any folder
 * or host, and from disk. Links to other websites (`<a href>`) aren't files the page loads, and are
 * fine.
 */

/** What an outside file is, by how the code loads it. */
type ExternalKind = "script" | "style" | "font" | "image" | "media" | "frame" | "other";

/** An outside file the code loads: its address as written, and what it is. */
export type ExternalResource = { readonly url: string; readonly kind: ExternalKind };

/** An address on another website: `https://…`, `http://…` or `//…`. */
const EXTERNAL = /^(?:https?:)?\/\//i;

/** Whether `url` is on another website. */
const isExternalUrl = (url: string): boolean => EXTERNAL.test(url.trim());

/** What a file is by its name's extension, for an address a script or a stylesheet names. */
function kindByExtension(url: string): ExternalKind | undefined {
  const path = url.split(/[?#]/)[0]?.toLowerCase() ?? "";
  if (/\.m?js$/.test(path)) return "script";
  if (/\.css$/.test(path)) return "style";
  if (/\.(?:woff2?|ttf|otf|eot)$/.test(path)) return "font";
  if (/\.(?:png|jpe?g|gif|webp|avif|svg|ico|bmp)$/.test(path)) return "image";
  if (/\.(?:mp4|webm|ogg|mp3|wav|m4a|vtt)$/.test(path)) return "media";
  return undefined;
}

/** `found`, each address once, the first kind it was found as. */
function unique(found: readonly ExternalResource[]): ExternalResource[] {
  const seen = new Map<string, ExternalResource>();
  for (const resource of found) {
    if (!seen.has(resource.url)) seen.set(resource.url, resource);
  }
  return [...seen.values()];
}

/** A CSS comment. */
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;

/** `@import url("…")` or `@import "…"`: the address imported. */
const CSS_IMPORT = /@import\s+(?:url\(\s*)?(["']?)([^"')\s;]+)\1/gi;

/** `url(…)`, quoted or not: the address. */
const CSS_URL = /url\(\s*(["']?)([^"')]+?)\1\s*\)/gi;

/** An `@font-face` rule's body, whose addresses are fonts whatever their names. */
const FONT_FACE = /@font-face\s*\{[^}]*\}/gi;

/** The outside files `css` loads: stylesheets it imports, fonts and images it names in `url()`. */
export function cssResources(css: string): ExternalResource[] {
  const text = css.replace(CSS_COMMENT, "");
  const found: ExternalResource[] = [];
  for (const match of text.matchAll(CSS_IMPORT)) {
    const url = match[2] ?? "";
    if (isExternalUrl(url)) found.push({ url, kind: "style" });
  }
  const fonts = new Set(
    Array.from(text.matchAll(FONT_FACE), (match) =>
      Array.from(match[0].matchAll(CSS_URL), (url) => url[2] ?? ""),
    ).flat(),
  );
  for (const match of text.matchAll(CSS_URL)) {
    const url = (match[2] ?? "").trim();
    if (!isExternalUrl(url)) continue;
    found.push({ url, kind: fonts.has(url) ? "font" : (kindByExtension(url) ?? "image") });
  }
  return unique(found);
}

/**
 * A string or template literal: its quote, then anything but that quote unless escaped. A `"…"` or
 * `'…'` string ends with its line, so an apostrophe in a comment or a regular expression is tried
 * to its line's end only, never to the end of a long script.
 */
const STRING_LITERAL = /"((?:\\.|[^"\\\n])*)"|'((?:\\.|[^'\\\n])*)'|`((?:\\[\s\S]|[^`\\])*)`/g;

/**
 * The other websites `script` uses, as far as it can be read without running it: every address in
 * its strings, a script, a stylesheet, a font, an image or a sound or video by its name, and
 * anything else as `other`. A script may send to an address as well as load from it (`fetch`,
 * `sendBeacon`), and the site then depends on that website too, or gives it its visitors' data
 * (#649, S1), so an address with no file name counts as well.
 */
export function scriptResources(script: string): ExternalResource[] {
  const found: ExternalResource[] = [];
  for (const match of script.matchAll(STRING_LITERAL)) {
    const url = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!isExternalUrl(url)) continue;
    found.push({ url, kind: kindByExtension(url) ?? "other" });
  }
  return unique(found);
}

/** An HTML comment. */
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

/**
 * A start tag: its name and its attributes' text. A quoted value is taken whole, so a `>` in it
 * (`alt="Price > £5"`) doesn't end the tag.
 */
const START_TAG = /<([a-z][a-z0-9-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;

/** One attribute: its name, and its value however it is quoted. */
const ATTRIBUTE = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

/** A `<style>` or `<script>` element's contents. */
const STYLE_ELEMENT = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
const SCRIPT_ELEMENT = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;

/** The attributes of a start tag, by lower-case name. */
function attributesOf(text: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of text.matchAll(ATTRIBUTE)) {
    const name = (match[1] ?? "").toLowerCase();
    if (!attributes.has(name)) attributes.set(name, match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

/** The addresses of a `srcset`: the first word of each of its candidates. */
const srcsetUrls = (srcset: string) =>
  srcset.split(",").flatMap((candidate) => candidate.trim().split(/\s+/, 1));

/** What a `<link>` loads, by its `rel` (and its `as`, for a preload). */
function linkKind(attributes: ReadonlyMap<string, string>): ExternalKind | undefined {
  const rel = (attributes.get("rel") ?? "").toLowerCase().split(/\s+/);
  if (rel.includes("stylesheet")) return "style";
  if (rel.some((token) => token === "icon" || token === "apple-touch-icon")) return "image";
  if (rel.includes("modulepreload")) return "script";
  if (rel.includes("preload") || rel.includes("prefetch")) {
    const as = (attributes.get("as") ?? "").toLowerCase();
    if (as === "script" || as === "style" || as === "font" || as === "image") return as;
    return "other";
  }
  if (rel.includes("manifest")) return "other";
  return undefined;
}

/** Each address a start tag `name` loads, and what it is. */
function tagResources(name: string, attributes: ReadonlyMap<string, string>): ExternalResource[] {
  const found: ExternalResource[] = [];
  const add = (url: string | undefined, kind: ExternalKind) => {
    if (url !== undefined && isExternalUrl(url)) found.push({ url: url.trim(), kind });
  };
  const src = attributes.get("src");
  switch (name) {
    case "script":
      add(src, "script");
      break;
    case "link": {
      const kind = linkKind(attributes);
      if (kind !== undefined) add(attributes.get("href"), kind);
      break;
    }
    case "img":
    case "input":
      add(src, "image");
      for (const url of srcsetUrls(attributes.get("srcset") ?? "")) add(url, "image");
      break;
    case "source":
      add(src, "media");
      for (const url of srcsetUrls(attributes.get("srcset") ?? "")) add(url, "image");
      break;
    case "video":
    case "audio":
    case "track":
    case "embed":
      add(src, "media");
      add(attributes.get("poster"), "image");
      break;
    case "object":
      add(attributes.get("data"), "media");
      break;
    case "iframe":
    case "frame":
      add(src, "frame");
      break;
  }
  const style = attributes.get("style");
  if (style !== undefined) found.push(...cssResources(style));
  return found;
}

/**
 * The outside files `html` loads (C8): scripts, stylesheets, images, sounds and videos, frames, the
 * fonts and images its styles name, and what its scripts load.
 */
export function htmlResources(html: string): ExternalResource[] {
  const text = html.replace(HTML_COMMENT, "");
  const found: ExternalResource[] = [];
  for (const match of text.matchAll(START_TAG)) {
    found.push(...tagResources((match[1] ?? "").toLowerCase(), attributesOf(match[2] ?? "")));
  }
  for (const match of text.matchAll(STYLE_ELEMENT)) found.push(...cssResources(match[1] ?? ""));
  for (const match of text.matchAll(SCRIPT_ELEMENT)) {
    found.push(...scriptResources(match[1] ?? ""));
  }
  return unique(found);
}

/** `url` with its scheme: an address that starts `//` is taken as `https://`. */
const withScheme = (url: string) => (url.startsWith("//") ? `https:${url}` : url);

/**
 * Whether Settings allow `url` (C8): it is one of `allowed`, or under one of them that ends with
 * `/` (`https://cdn.example.com/lib/` allows everything in that folder). An address that starts
 * `//` matches its `https://` form.
 */
export function isAllowed(url: string, allowed: readonly string[]): boolean {
  const address = withScheme(url.trim());
  return allowed.some((entry) => {
    const trimmed = entry.trim();
    return trimmed === address || (trimmed.endsWith("/") && address.startsWith(trimmed));
  });
}
