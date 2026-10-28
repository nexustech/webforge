import { createHash } from "node:crypto";

/**
 * Download and bundle (C8, 3.9): a file the site's code loads from another website, fetched once on
 * the person's click to be kept with the site, so the export loads it from its own `assets/vendor/`
 * folder. The editor's only network call besides fonts and publishing (architecture §9).
 */

/** How main fetches: Electron's `net.fetch`, or a stand-in in the tests. */
export type BundleFetch = (
  url: string,
  init: { readonly signal: AbortSignal },
) => Promise<Response>;

/**
 * Why a file couldn't be downloaded: its address isn't `https://`, the website couldn't be reached
 * or gave no file there, it's over {@link BUNDLE_MAX_BYTES}, or it isn't a kind of file a page loads
 * (a script, a stylesheet, a font, an image, a sound or a video).
 */
export type DownloadFailure = "not-https" | "offline" | "not-found" | "too-large" | "not-a-file";

/** A downloaded file: its address, its name in `assets/vendor/`, its type and its bytes. */
export type DownloadedFile = {
  readonly url: string;
  readonly file: string;
  readonly mime: string;
  readonly data: Uint8Array;
};

/** The largest file Download and bundle keeps: well over a web font or a script library. */
export const BUNDLE_MAX_BYTES = 10_000_000;

/** How long a download may take. */
const TIMEOUT_MS = 30_000;

/** The most files a stylesheet may name for downloading with it (fonts, images). */
export const BUNDLE_MAX_NESTED = 30;

/** The kinds of file a page loads, by MIME type, and the extension each one's name takes. */
const EXTENSIONS: Readonly<Record<string, string>> = {
  "text/javascript": "js",
  "application/javascript": "js",
  "application/x-javascript": "js",
  "text/css": "css",
  "font/woff2": "woff2",
  "font/woff": "woff",
  "font/ttf": "ttf",
  "font/otf": "otf",
  "application/font-woff": "woff",
  "application/font-woff2": "woff2",
  "application/x-font-ttf": "ttf",
  "application/vnd.ms-fontobject": "eot",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "text/vtt": "vtt",
};

/** The types of the files Download and bundle keeps with a site: never a site document's (JSON). */
export const BUNDLE_MIME_TYPES: ReadonlySet<string> = new Set(Object.keys(EXTENSIONS));

/** Each extension's MIME type, for a server that says only `application/octet-stream`. */
const TYPES_BY_EXTENSION: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(EXTENSIONS)
    .reverse()
    .map(([mime, extension]) => [extension, mime]),
);

/** The extension of `url`'s file name, lower case, if it has one. */
function extensionOf(url: URL): string | undefined {
  const name = url.pathname.split("/").at(-1) ?? "";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : undefined;
}

/**
 * The name a file takes in `assets/vendor/`: its own name's letters and digits, then the start of its
 * bytes' hash, so two files never share one and a changed file gets a new one.
 */
function vendorName(url: URL, extension: string, data: Uint8Array): string {
  const name = (url.pathname.split("/").at(-1) ?? "").replace(/\.[^.]*$/, "");
  const stem = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const hash = createHash("sha256").update(data).digest("hex").slice(0, 8);
  return `${stem === "" ? "file" : stem}-${hash}.${extension}`;
}

/** Fetches the file at `address`, checked as {@link DownloadFailure} says. */
async function get(
  fetch: BundleFetch,
  address: string,
): Promise<DownloadedFile | { readonly failed: DownloadFailure }> {
  let url: URL;
  try {
    // An address that starts `//` takes the page's scheme: https on a published site.
    url = new URL(address.startsWith("//") ? `https:${address}` : address);
  } catch {
    return { failed: "not-https" };
  }
  if (url.protocol !== "https:") return { failed: "not-https" };
  let response: Response;
  try {
    response = await fetch(url.href, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return { failed: "offline" };
  }
  if (!response.ok) return { failed: "not-found" };
  if (Number(response.headers.get("content-length") ?? 0) > BUNDLE_MAX_BYTES) {
    return { failed: "too-large" };
  }
  const said = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
  const byName = extensionOf(url);
  const extension =
    EXTENSIONS[said ?? ""] ??
    (said === "application/octet-stream" || said === "" ? byName : undefined);
  const mime = extension === undefined ? undefined : (TYPES_BY_EXTENSION[extension] ?? said);
  if (
    extension === undefined ||
    mime === undefined ||
    TYPES_BY_EXTENSION[extension] === undefined
  ) {
    return { failed: "not-a-file" };
  }
  let data: Uint8Array;
  try {
    data = new Uint8Array(await response.arrayBuffer());
  } catch {
    return { failed: "offline" };
  }
  if (data.byteLength > BUNDLE_MAX_BYTES) return { failed: "too-large" };
  return { url: url.href, file: vendorName(url, extension, data), mime, data };
}

/** `url(…)` in a stylesheet, quoted or not, and `@import "…"`: the address as written. */
const STYLESHEET_REFERENCE = /url\(\s*(["']?)([^"')]+?)\1\s*\)|@import\s+(["'])([^"']+)\3/gi;

/**
 * `css` with each file it names fetched too, one level deep, and named by its copy beside it in
 * `assets/vendor/`: a web font's stylesheet with its fonts. An address relative to the stylesheet
 * is taken from where the stylesheet came from. A `data:` address stays as it is.
 */
async function withItsFiles(
  fetch: BundleFetch,
  sheet: DownloadedFile,
): Promise<readonly DownloadedFile[] | { readonly failed: DownloadFailure }> {
  const css = new TextDecoder().decode(sheet.data);
  /** The address `written` names, from where the stylesheet came from; nothing to fetch for some. */
  const addressOf = (written: string) => {
    if (written === "" || written.startsWith("data:") || written.startsWith("#")) return undefined;
    try {
      return new URL(written, sheet.url).href;
    } catch {
      // Not an address: the browser can't load it either.
      return undefined;
    }
  };
  const addresses = new Set<string>();
  for (const match of css.matchAll(STYLESHEET_REFERENCE)) {
    const address = addressOf((match[2] ?? match[4] ?? "").trim());
    if (address !== undefined) addresses.add(address);
  }
  if (addresses.size > BUNDLE_MAX_NESTED) return { failed: "too-large" };
  const files: DownloadedFile[] = [];
  const copies = new Map<string, string>();
  for (const address of addresses) {
    const file = await get(fetch, address);
    if ("failed" in file) return file;
    files.push(file);
    copies.set(address, file.file);
  }
  // Each reference named by its copy, in its own `url()` or `@import` only.
  const rewritten = css.replace(
    STYLESHEET_REFERENCE,
    (
      whole,
      quote: string | undefined,
      url: string | undefined,
      importQuote: string | undefined,
      imported: string | undefined,
    ) => {
      const written = (url ?? imported ?? "").trim();
      const copy = copies.get(addressOf(written) ?? "");
      if (copy === undefined) return whole;
      return url !== undefined
        ? `url(${quote ?? ""}${copy}${quote ?? ""})`
        : `@import ${importQuote ?? '"'}${copy}${importQuote ?? '"'}`;
    },
  );
  return [{ ...sheet, data: new TextEncoder().encode(rewritten) }, ...files];
}

/**
 * Downloads the file at `url` for Download and bundle, and the files it names if it is a
 * stylesheet: the file first. Nothing is downloaded but on the person's click.
 */
export async function downloadForBundle(
  fetch: BundleFetch,
  url: string,
): Promise<
  | { readonly status: "downloaded"; readonly files: readonly DownloadedFile[] }
  | { readonly status: "failed"; readonly reason: DownloadFailure }
> {
  const file = await get(fetch, url);
  if ("failed" in file) return { status: "failed", reason: file.failed };
  if (file.mime !== "text/css") return { status: "downloaded", files: [file] };
  const files = await withItsFiles(fetch, file);
  return "failed" in files
    ? { status: "failed", reason: files.failed }
    : { status: "downloaded", files };
}

/** The environment variable E2E tests launch Webforge with, to stand in for the network (3.9). */
export const E2E_BUNDLE_VARIABLE = "WEBFORGE_E2E_BUNDLE";

/**
 * `fetch`, or in an unpackaged app launched with `WEBFORGE_E2E_BUNDLE=1`, as the E2E tests launch
 * it, the stand-in they put on main's globals (`webforgeBundleFetch`), so they make no request to
 * another website. Never in the installed app, nor in `pnpm dev`.
 */
export function bundleFetchFor(
  fetch: BundleFetch,
  packaged: boolean,
  env: NodeJS.ProcessEnv = process.env,
): BundleFetch {
  if (packaged || env[E2E_BUNDLE_VARIABLE] !== "1") return fetch;
  return (url, init) =>
    ((globalThis as { webforgeBundleFetch?: BundleFetch }).webforgeBundleFetch ?? fetch)(url, init);
}
