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

/**
 * CSS as a browser reads it, as far as what it loads goes (#975): strings, `url()`s, functions, at-
 * rules and brackets, each with its escapes read (`\75rl(` is `url(`, `\2f\2f` is `//`), and comments
 * left out. Anything else is skipped. Each character is read once.
 */
type CssToken =
  | { readonly type: "string"; readonly value: string }
  | { readonly type: "url"; readonly value: string }
  | { readonly type: "function"; readonly name: string }
  | { readonly type: "at"; readonly name: string }
  | { readonly type: "open" | "close"; readonly bracket: string }
  | { readonly type: "end" };

/** Whether character `code` may start a name: a letter, `_`, `-` or anything past ASCII. */
const isNameStart = (code: number) =>
  (code >= 97 && code <= 122) ||
  (code >= 65 && code <= 90) ||
  code === 95 ||
  code === 45 ||
  code >= 128;

/** Whether character `code` may go on a name: as {@link isNameStart}, or a digit. */
const isNameCode = (code: number) => isNameStart(code) || (code >= 48 && code <= 57);

const isHex = (code: number) =>
  (code >= 48 && code <= 57) || (code >= 97 && code <= 102) || (code >= 65 && code <= 70);

const isNewline = (code: number) => code === 10 || code === 12 || code === 13;

const isCssSpace = (code: number) => code === 32 || code === 9 || isNewline(code);

/** The tokens of `css` that say what it loads. */
function cssTokens(css: string): CssToken[] {
  const tokens: CssToken[] = [];
  let at = 0;
  /** The escape at `at`, after its `\`: the character it stands for, read past. */
  const escaped = (): string => {
    let hex = "";
    while (hex.length < 6 && isHex(css.charCodeAt(at))) hex += css.charAt(at++);
    if (hex === "") return at < css.length ? css.charAt(at++) : "";
    // One space after the digits is part of the escape.
    if (isCssSpace(css.charCodeAt(at))) at += css.startsWith("\r\n", at) ? 2 : 1;
    const point = Number.parseInt(hex, 16);
    return point === 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)
      ? "\uFFFD"
      : String.fromCodePoint(point);
  };
  /** Whether a `\` at `from` starts an escape: one before a line break doesn't. */
  const escapes = (from: number) =>
    css.charAt(from) === "\\" && !isNewline(css.charCodeAt(from + 1));
  const name = (): string => {
    let read = "";
    for (;;) {
      if (escapes(at)) {
        at += 1;
        read += escaped();
      } else if (isNameCode(css.charCodeAt(at))) {
        read += css.charAt(at++);
      } else {
        return read;
      }
    }
  };
  const string = (quote: string): string => {
    let read = "";
    while (at < css.length) {
      const character = css.charAt(at);
      if (character === quote) {
        at += 1;
        return read;
      }
      // A line break ends a string left open, as a browser reads it.
      if (isNewline(css.charCodeAt(at))) return read;
      at += 1;
      if (character !== "\\") read += character;
      else if (isNewline(css.charCodeAt(at))) at += css.startsWith("\r\n", at) ? 2 : 1;
      else read += escaped();
    }
    return read;
  };
  /** An unquoted `url(…)`'s address, after its `(` and any spaces, to its `)`. */
  const unquotedUrl = (): string => {
    let read = "";
    while (at < css.length) {
      const character = css.charAt(at);
      if (character === ")") break;
      at += 1;
      if (character === "\\" && !isNewline(css.charCodeAt(at))) read += escaped();
      else read += character;
    }
    at += 1;
    return read.trim();
  };
  while (at < css.length) {
    const character = css.charAt(at);
    const code = css.charCodeAt(at);
    if (css.startsWith("/*", at)) {
      const end = css.indexOf("*/", at + 2);
      at = end === -1 ? css.length : end + 2;
    } else if (character === '"' || character === "'") {
      at += 1;
      tokens.push({ type: "string", value: string(character) });
    } else if (character === "@") {
      at += 1;
      tokens.push({ type: "at", name: name().toLowerCase() });
    } else if (escapes(at) || isNameStart(code)) {
      const read = name().toLowerCase();
      if (css.charAt(at) !== "(") continue;
      at += 1;
      if (read === "url") {
        while (isCssSpace(css.charCodeAt(at))) at += 1;
        const next = css.charAt(at);
        if (next !== '"' && next !== "'") {
          tokens.push({ type: "url", value: unquotedUrl() });
          continue;
        }
      }
      tokens.push({ type: "function", name: read });
    } else if (character === "(" || character === "[" || character === "{") {
      at += 1;
      tokens.push({ type: "open", bracket: character });
    } else if (character === ")" || character === "]" || character === "}") {
      at += 1;
      tokens.push({ type: "close", bracket: character });
    } else if (character === ";") {
      at += 1;
      tokens.push({ type: "end" });
    } else {
      at += 1;
    }
  }
  return tokens;
}

/**
 * The outside files `css` loads (C8, #975): stylesheets it imports, and the fonts and images it
 * names in `url()`, or in quotes in `image-set()`, `src()` or any other function, however its
 * escapes write them. A string outside a function (`content: "…"`, a font's name, an attribute
 * selector's value) loads nothing.
 */
export function cssResources(css: string): ExternalResource[] {
  const found: ExternalResource[] = [];
  /** The functions and brackets open, innermost last: a function by its name, a bracket as it is. */
  const open: string[] = [];
  /** How deep in braces the `@font-face` rule being read starts, or -1 outside one. */
  let fontFace = -1;
  let braces = 0;
  let fontFaceNext = false;
  let importing = false;
  const add = (url: string, kind?: ExternalKind) => {
    const address = url.trim();
    if (!isExternalUrl(address)) return;
    found.push({
      url: address,
      kind: kind ?? (fontFace !== -1 ? "font" : (kindByExtension(address) ?? "image")),
    });
  };
  for (const token of cssTokens(css)) {
    switch (token.type) {
      case "at":
        importing = token.name === "import";
        fontFaceNext = token.name === "font-face";
        break;
      case "string": {
        const inside = open.at(-1);
        if (importing && inside === undefined) add(token.value, "style");
        else if (inside === "url") add(token.value, importing ? "style" : undefined);
        // In `image-set()`, `src()` or another function; not in brackets or plain parentheses
        // that a selector or a condition has.
        else if (inside !== undefined && inside !== "[" && inside !== "(") add(token.value);
        break;
      }
      case "url":
        add(token.value, importing && open.length === 0 ? "style" : undefined);
        break;
      case "function":
        open.push(token.name);
        break;
      case "open":
        if (token.bracket === "{") {
          braces += 1;
          if (fontFaceNext) fontFace = braces;
          fontFaceNext = false;
          importing = false;
        } else {
          open.push(token.bracket);
        }
        break;
      case "close":
        if (token.bracket === "}") {
          if (braces === fontFace) fontFace = -1;
          braces = Math.max(0, braces - 1);
          open.length = 0;
        } else {
          open.pop();
        }
        break;
      case "end":
        importing = false;
        open.length = 0;
        break;
    }
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
