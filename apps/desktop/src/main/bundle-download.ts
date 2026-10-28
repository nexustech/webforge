import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { BUNDLE_MAX_NESTED } from "../shared/ipc/site.js";

/**
 * Download and bundle (C8, 3.9): a file the site's code loads from another website, fetched once on
 * the person's click to be kept with the site, so the export loads it from its own `assets/vendor/`
 * folder. The editor's only network call besides fonts and publishing (architecture §9).
 *
 * The address comes from the site file, which may come from anyone, so the download is careful:
 * `https://` at every hop of a redirect, never a host on this computer or its network, and never
 * more than {@link BUNDLE_MAX_BYTES}, however the server answers.
 */

/** How main fetches: Electron's `net.fetch`, or a stand-in in the tests. */
export type BundleFetch = (
  url: string,
  init: { readonly signal: AbortSignal; readonly redirect: "manual" },
) => Promise<Response>;

/** How main finds a host's addresses: `dns.lookup`, or a stand-in in the tests. */
export type BundleResolve = (host: string) => Promise<readonly string[]>;

/** The network Download and bundle uses. */
export type BundleNetwork = { readonly fetch: BundleFetch; readonly resolve: BundleResolve };

/**
 * Why a file couldn't be downloaded: its address (or one it redirects to) isn't `https://`, or is
 * on this computer or its network (`local`), not another website; the website couldn't be reached
 * in time or gave no file there; it's over {@link BUNDLE_MAX_BYTES}; or it isn't a kind of file a
 * page loads (a script, a stylesheet, a font, an image, a sound or a video).
 */
export type DownloadFailure =
  | "not-https"
  | "local"
  | "offline"
  | "not-found"
  | "too-large"
  | "not-a-file";

/** A downloaded file: its address, its name in `assets/vendor/`, its type and its bytes. */
export type DownloadedFile = {
  readonly url: string;
  readonly file: string;
  readonly mime: string;
  readonly data: Uint8Array;
};

/** The largest file Download and bundle keeps: well over a web font or a script library. */
export const BUNDLE_MAX_BYTES = 10_000_000;

/** How long one request may take. */
const TIMEOUT_MS = 30_000;

/** How long a file and all a stylesheet names may take together. */
const DEADLINE_MS = 60_000;

/** How many of a stylesheet's files are fetched at once. */
const AT_ONCE = 5;

/** How many redirects a download follows. */
const MAX_REDIRECTS = 5;

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

/** An IPv4 address's four numbers. */
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * Whether `address` (an IP address) is this computer or its own network, never another website:
 * loopback, private, link-local, carrier-grade NAT, "this network", multicast and reserved IPv4,
 * and IPv6's loopback, unspecified, unique local and link-local addresses, an IPv4 one inside IPv6
 * by its IPv4 address.
 */
export function isLocalAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  const v4 = IPV4.exec(mapped ?? address);
  if (v4 !== null) {
    const [a = 0, b = 0] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = address.toLowerCase();
  return (
    v6 === "::" || v6 === "::1" || /^f[cd][0-9a-f]{2}:/.test(v6) || /^fe[89ab][0-9a-f]:/.test(v6)
  );
}

/**
 * Whether `url`'s host is another website: each address it resolves to is outside this computer
 * and its network; `unknown` when it resolves to none. Checked before each request, this narrows DNS rebinding (an answer that changes
 * between the check and the request) but can't close it, as the request resolves the host again;
 * `https://` with the certificate checked is what stands between a rebound host and a local
 * server that has no certificate for it.
 */
async function whereIs(
  url: URL,
  resolve: BundleResolve,
): Promise<"elsewhere" | "local" | "unknown"> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) !== 0) return isLocalAddress(host) ? "local" : "elsewhere";
  if (host === "localhost" || host.endsWith(".localhost")) return "local";
  let addresses: readonly string[];
  try {
    addresses = await resolve(host);
  } catch {
    return "unknown";
  }
  if (addresses.length === 0) return "unknown";
  return addresses.some(isLocalAddress) ? "local" : "elsewhere";
}

/** The body of `response`, read as it comes, or `too-large` once it passes the limit. */
async function bodyOf(response: Response): Promise<Uint8Array | "too-large"> {
  const reader = response.body?.getReader();
  if (reader === undefined) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > BUNDLE_MAX_BYTES) {
      await reader.cancel().catch(() => undefined);
      return "too-large";
    }
    chunks.push(value);
  }
  const data = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    data.set(chunk, at);
    at += chunk.byteLength;
  }
  return data;
}

/** The address `address` is, `//` taking `https:`; undefined when it isn't one. */
function urlOf(address: string, base?: string): URL | undefined {
  try {
    return new URL(address.startsWith("//") ? `https:${address}` : address, base);
  } catch {
    return undefined;
  }
}

/**
 * Fetches the file at `address`, checked as {@link DownloadFailure} says: following redirects
 * itself, each to `https://` on another website, before `deadline`.
 */
async function get(
  { fetch, resolve }: BundleNetwork,
  address: string,
  deadline: AbortSignal,
): Promise<DownloadedFile | { readonly failed: DownloadFailure }> {
  let url = urlOf(address);
  let response: Response | undefined;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (url?.protocol !== "https:") return { failed: "not-https" };
    const where = await whereIs(url, resolve);
    if (where !== "elsewhere") return { failed: where === "local" ? "local" : "offline" };
    try {
      response = await fetch(url.href, {
        signal: AbortSignal.any([deadline, AbortSignal.timeout(TIMEOUT_MS)]),
        redirect: "manual",
      });
    } catch {
      return { failed: "offline" };
    }
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || location === null) break;
    await response.body?.cancel().catch(() => undefined);
    url = urlOf(location, url.href);
    response = undefined;
  }
  if (response === undefined || url === undefined) return { failed: "not-found" };
  if (!response.ok) return { failed: "not-found" };
  if (Number(response.headers.get("content-length") ?? 0) > BUNDLE_MAX_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    return { failed: "too-large" };
  }
  const said = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
  const extension =
    EXTENSIONS[said ?? ""] ??
    (said === "application/octet-stream" || said === "" ? extensionOf(url) : undefined);
  const mime = extension === undefined ? undefined : TYPES_BY_EXTENSION[extension];
  if (extension === undefined || mime === undefined) {
    await response.body?.cancel().catch(() => undefined);
    return { failed: "not-a-file" };
  }
  let data: Uint8Array | "too-large";
  try {
    data = await bodyOf(response);
  } catch {
    return { failed: "offline" };
  }
  if (data === "too-large") return { failed: "too-large" };
  const asked = urlOf(address);
  return { url: asked?.href ?? url.href, file: vendorName(url, extension, data), mime, data };
}

/** `url(…)` in a stylesheet, quoted or not, and `@import "…"`: the address as written. */
const STYLESHEET_REFERENCE = /url\(\s*(["']?)([^"')]+?)\1\s*\)|@import\s+(["'])([^"']+)\3/gi;

/**
 * `css` with each file it names fetched too, one level deep, {@link AT_ONCE} at a time, and named by
 * its copy beside it in `assets/vendor/`: a web font's stylesheet with its fonts. An address
 * relative to the stylesheet is taken from where the stylesheet came from. A `data:` address stays
 * as it is.
 */
async function withItsFiles(
  network: BundleNetwork,
  sheet: DownloadedFile,
  deadline: AbortSignal,
): Promise<readonly DownloadedFile[] | { readonly failed: DownloadFailure }> {
  const css = new TextDecoder().decode(sheet.data);
  /** The address `written` names, from where the stylesheet came from; nothing to fetch for some. */
  const addressOf = (written: string) => {
    if (written === "" || written.startsWith("data:") || written.startsWith("#")) return undefined;
    return urlOf(written, sheet.url)?.href;
  };
  const addresses = new Set<string>();
  for (const match of css.matchAll(STYLESHEET_REFERENCE)) {
    const address = addressOf((match[2] ?? match[4] ?? "").trim());
    if (address !== undefined) addresses.add(address);
  }
  if (addresses.size > BUNDLE_MAX_NESTED) return { failed: "too-large" };
  const queue = [...addresses];
  const got: (DownloadedFile | { readonly failed: DownloadFailure })[] = [];
  const worker = async () => {
    for (let address = queue.shift(); address !== undefined; address = queue.shift()) {
      const file = await get(network, address, deadline);
      got.push(file);
      // One that fails stops the others: the stylesheet isn't kept without it.
      if ("failed" in file) queue.length = 0;
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, worker));
  const failed = got.find((file) => "failed" in file);
  if (failed !== undefined && "failed" in failed) return failed;
  const files = got.filter((file): file is DownloadedFile => !("failed" in file));
  const copies = new Map(files.map((file) => [file.url, file.file]));
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
 * stylesheet, all within {@link DEADLINE_MS}: the file first. Nothing is downloaded but on the
 * person's click.
 */
export async function downloadForBundle(
  network: BundleNetwork,
  url: string,
): Promise<
  | { readonly status: "downloaded"; readonly files: readonly DownloadedFile[] }
  | { readonly status: "failed"; readonly reason: DownloadFailure }
> {
  const deadline = AbortSignal.timeout(DEADLINE_MS);
  const file = await get(network, url, deadline);
  if ("failed" in file) return { status: "failed", reason: file.failed };
  if (file.mime !== "text/css") return { status: "downloaded", files: [file] };
  const files = await withItsFiles(network, file, deadline);
  return "failed" in files
    ? { status: "failed", reason: files.failed }
    : { status: "downloaded", files };
}

/** Each address `host` resolves to, as the request will find it. */
export const resolveHost: BundleResolve = async (host) =>
  (await lookup(host, { all: true, verbatim: true })).map((entry) => entry.address);

/** The environment variable E2E tests launch Webforge with, to stand in for the network (3.9). */
const E2E_BUNDLE_VARIABLE = "WEBFORGE_E2E_BUNDLE";

/**
 * `network`, or in an unpackaged app launched with `WEBFORGE_E2E_BUNDLE=1`, as the E2E tests launch
 * it, the stand-ins they put on main's globals (`webforgeBundleFetch`, `webforgeBundleResolve`), so
 * they make no request, nor a DNS query, to another website. Never in the installed app, nor in
 * `pnpm dev`.
 */
export function bundleNetworkFor(
  network: BundleNetwork,
  packaged: boolean,
  env: NodeJS.ProcessEnv = process.env,
): BundleNetwork {
  if (packaged || env[E2E_BUNDLE_VARIABLE] !== "1") return network;
  const stand = globalThis as {
    webforgeBundleFetch?: BundleFetch;
    webforgeBundleResolve?: BundleResolve;
  };
  return {
    fetch: (url, init) => (stand.webforgeBundleFetch ?? network.fetch)(url, init),
    resolve: (host) => (stand.webforgeBundleResolve ?? network.resolve)(host),
  };
}
