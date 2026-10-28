import { sha1 } from "./manifest.js";
import type { BuildOutput, Verification } from "./publisher.js";

export type { Verification } from "./publisher.js";

/** Options of {@link verifyPublished}. */
export type VerifyOptions = {
  /** Injectable for tests; defaults to the global `fetch`. */
  readonly fetch?: typeof fetch;
  /** How many times to ask, a cache or a CDN taking a moment to serve the new version. */
  readonly attempts?: number;
  /** How long to wait between them. */
  readonly delayMs?: number;
  /** How long one answer may take before it counts as none. */
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
};

const HOME_PAGE = "index.html";

/** The most of an answer read: a page past it isn't the one built. */
const MIN_READ_CAP = 1_048_576;

/**
 * The stylesheet a built home page names (`assets/css/site.3f9a1c2b4d.css`), hashed from the
 * site's styles: a host that adds to its pages or rewrites their forms still serves it.
 */
const STYLESHEET = /assets\/css\/site\.[0-9a-f]+\.css/;

/** Waits `ms`, or less when `signal` aborts. */
function pause(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

/** `response`'s body, or `undefined` once it passes `cap` bytes, when reading stops. */
async function readUpTo(response: Response, cap: number): Promise<Uint8Array | undefined> {
  if (response.body === null) return new Uint8Array(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > cap) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    body.set(chunk, at);
    at += chunk.byteLength;
  }
  return body;
}

/**
 * Checks the site at `url` serves the home page of `build` (08, step 5): its `index.html` over
 * HTTPS. The page as built, byte for byte, is `live` at once. A page with the build's hashed
 * stylesheet in it is this site rewritten by its host (Netlify takes `data-netlify` off its forms,
 * others add snippets), or an earlier version with the same styles still in a cache: it is asked
 * for again until the attempts run out, then counts as `live`. A query that changes with the build
 * gets past caches; each answer has `timeoutMs` and is read up to twice the page's size (1 MB at
 * least). Nothing of the page is kept or logged. Never throws: a publish that finished stays
 * finished whatever the check finds.
 */
export async function verifyPublished(
  url: string,
  build: BuildOutput,
  options: VerifyOptions = {},
): Promise<Verification> {
  const {
    fetch: get = globalThis.fetch,
    attempts = 5,
    delayMs = 2_000,
    timeoutMs = 15_000,
    signal,
  } = options;
  const home = build.files.get(HOME_PAGE);
  let address: URL;
  try {
    address = new URL(url);
  } catch {
    return { status: "unchecked" };
  }
  if (home === undefined || address.protocol !== "https:") return { status: "unchecked" };
  const expected = sha1(home);
  const stylesheet = STYLESHEET.exec(new TextDecoder().decode(home))?.[0];
  const cap = Math.max(home.byteLength * 2, MIN_READ_CAP);
  // A call, not a property read: it changes while a request is out.
  const cancelled = () => signal?.aborted === true;
  if (!address.pathname.endsWith("/")) address.pathname = `${address.pathname}/`;
  address.searchParams.set("webforge-check", expected.slice(0, 12));

  let found: Verification = { status: "unreachable" };
  for (let attempt = 0; attempt < Math.max(1, attempts); attempt++) {
    if (attempt > 0) await pause(delayMs, signal);
    if (cancelled()) return { status: "unchecked" };
    const timeout = AbortSignal.timeout(timeoutMs);
    try {
      const response = await get(address, {
        cache: "no-store",
        redirect: "follow",
        signal: signal === undefined ? timeout : AbortSignal.any([signal, timeout]),
      });
      if (!response.ok) {
        await response.body?.cancel();
        found = { status: "unreachable", httpStatus: response.status };
        continue;
      }
      const body = await readUpTo(response, cap);
      if (body !== undefined && sha1(body) === expected) return { status: "live" };
      found =
        body !== undefined &&
        stylesheet !== undefined &&
        new TextDecoder().decode(body).includes(stylesheet)
          ? { status: "live" }
          : { status: "different" };
    } catch {
      if (cancelled()) return { status: "unchecked" };
      found = { status: "unreachable" };
    }
  }
  return found;
}
