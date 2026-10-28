import { sha1 } from "./manifest.js";
import type { BuildOutput } from "./publisher.js";

/** What checking the live site found once a publish is done (08, step 5). */
export type Verification =
  /** The address serves the home page just published. */
  | { readonly status: "live" }
  /**
   * The address answers, but with another home page: a cache still holding the old one, a host
   * that changes the pages it serves, or an address that isn't this destination's.
   */
  | { readonly status: "different" }
  /** The address didn't answer, or answered with an error (`httpStatus`, when it answered). */
  | { readonly status: "unreachable"; readonly httpStatus?: number }
  /** Not checked: no `https:` address, no home page in the build, or cancelled. */
  | { readonly status: "unchecked" };

/** Options of {@link verifyPublished}. */
export type VerifyOptions = {
  /** Injectable for tests; defaults to the global `fetch`. */
  readonly fetch?: typeof fetch;
  /** How many times to ask, a cache or a CDN taking a moment to serve the new deploy. */
  readonly attempts?: number;
  /** How long to wait between them. */
  readonly delayMs?: number;
  readonly signal?: AbortSignal;
};

const HOME_PAGE = "index.html";

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

/**
 * Checks the site at `url` serves the home page of `build` (08, step 5): its `index.html` over
 * HTTPS, compared by digest, so nothing of the page is kept or logged. A query that changes with
 * the build gets past caches; a host or CDN still serving the old page is asked again a few times
 * before the check settles on `different`. Never throws: a publish that finished stays finished
 * whatever the check finds.
 */
export async function verifyPublished(
  url: string,
  build: BuildOutput,
  options: VerifyOptions = {},
): Promise<Verification> {
  const { fetch: get = globalThis.fetch, attempts = 5, delayMs = 2_000, signal } = options;
  const home = build.files.get(HOME_PAGE);
  let address: URL;
  try {
    address = new URL(url);
  } catch {
    return { status: "unchecked" };
  }
  if (home === undefined || address.protocol !== "https:") return { status: "unchecked" };
  const expected = sha1(home);
  // A call, not a property read: it changes while a request is out.
  const cancelled = () => signal?.aborted === true;
  if (!address.pathname.endsWith("/")) address.pathname = `${address.pathname}/`;
  address.searchParams.set("webforge-check", expected.slice(0, 12));

  let found: Verification = { status: "unreachable" };
  for (let attempt = 0; attempt < Math.max(1, attempts); attempt++) {
    if (attempt > 0) await pause(delayMs, signal);
    if (cancelled()) return { status: "unchecked" };
    try {
      const response = await get(address, {
        cache: "no-store",
        redirect: "follow",
        ...(signal === undefined ? {} : { signal }),
      });
      if (!response.ok) {
        found = { status: "unreachable", httpStatus: response.status };
        continue;
      }
      if (sha1(new Uint8Array(await response.arrayBuffer())) === expected) {
        return { status: "live" };
      }
      found = { status: "different" };
    } catch {
      if (cancelled()) return { status: "unchecked" };
      found = { status: "unreachable" };
    }
  }
  return found;
}
