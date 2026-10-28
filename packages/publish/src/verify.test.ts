import { describe, expect, it, vi } from "vitest";
import type { BuildOutput } from "./publisher.js";
import { verifyPublished } from "./verify.js";

const bytes = (text: string) => new TextEncoder().encode(text);
const build = (files: Record<string, string>): BuildOutput => ({
  files: new Map(Object.entries(files).map(([path, text]) => [path, bytes(text)])),
});
const HOME =
  '<link href="assets/css/site.3f9a1c2b4d.css"><form data-netlify="true"><input name="email"></form>';
const site = build({ "index.html": HOME, "about.html": "<h1>About</h1>" });

/**
 * A host that answers each request with the next of `answers`, the last one from then on: a page,
 * an HTTP status, a network error, or `"never"`, an answer that never comes.
 */
function host(...answers: (string | number | Error)[]) {
  const asked: URL[] = [];
  const fetch = vi.fn(async (input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) => {
    asked.push(new URL(String(input)));
    const answer = answers[Math.min(asked.length, answers.length) - 1];
    if (answer instanceof Error) throw answer;
    if (answer === "never") {
      return new Promise<Response>((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
      );
    }
    return typeof answer === "number"
      ? new Response("", { status: answer })
      : new Response(answer, { status: 200 });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, asked };
}

describe("verifyPublished (08, step 5)", () => {
  it("finds the home page just published at the address, past any cache", async () => {
    const { fetch, asked } = host(HOME);

    const result = await verifyPublished("https://rosas.example", site, { fetch, delayMs: 0 });

    expect(result).toEqual({ status: "live" });
    expect(asked).toHaveLength(1);
    expect(asked[0]?.origin + (asked[0]?.pathname ?? "")).toBe("https://rosas.example/");
    expect(asked[0]?.searchParams.get("webforge-check")).toMatch(/^[0-9a-f]{12}$/);
  });

  it("asks again while a cache serves the old page or the deploy isn't there yet", async () => {
    const { fetch, asked } = host(404, "<h1>Old</h1>", HOME);

    const result = await verifyPublished("https://rosas.example/shop/", site, {
      fetch,
      delayMs: 0,
    });

    expect(result).toEqual({ status: "live" });
    expect(asked).toHaveLength(3);
    expect(asked[0]?.pathname).toBe("/shop/");
  });

  it("settles on another page, an error or no answer once it has asked enough", async () => {
    const options = { attempts: 3, delayMs: 0 };

    expect(
      await verifyPublished("https://rosas.example", site, {
        ...options,
        fetch: host("<h1>Someone else's site</h1>").fetch,
      }),
    ).toEqual({ status: "different" });
    expect(
      await verifyPublished("https://rosas.example", site, { ...options, fetch: host(503).fetch }),
    ).toEqual({ status: "unreachable", httpStatus: 503 });
    const down = host(new TypeError("fetch failed"));
    expect(
      await verifyPublished("https://rosas.example", site, { ...options, fetch: down.fetch }),
    ).toEqual({ status: "unreachable" });
    expect(down.asked).toHaveLength(3);
  });

  it("takes a page its host rewrote, its stylesheet the build's, after asking again (#600 review)", async () => {
    // Netlify's form handling, and a snippet the host adds.
    const rewritten = `<script src="/host-badge.js"></script>${HOME.replace(
      ' data-netlify="true"',
      "",
    ).replace("<form>", '<form><input type="hidden" name="form-name" value="contact">')}`;
    const { fetch, asked } = host(rewritten);

    const result = await verifyPublished("https://rosas.example", site, {
      fetch,
      attempts: 2,
      delayMs: 0,
    });

    expect(result).toEqual({ status: "live" });
    // Not at once: a cache's old version with the same styles has a moment to go.
    expect(asked).toHaveLength(2);
    expect(
      await verifyPublished("https://rosas.example", site, {
        fetch: host('<link href="assets/css/site.0000000000.css">').fetch,
        attempts: 2,
        delayMs: 0,
      }),
    ).toEqual({ status: "different" });
  });

  it("gives up on an answer that never comes, or that runs on past the page's size", async () => {
    expect(
      await verifyPublished("https://rosas.example", site, {
        fetch: host("never").fetch,
        attempts: 2,
        delayMs: 0,
        timeoutMs: 20,
      }),
    ).toEqual({ status: "unreachable" });

    let read = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        read += 65_536;
        controller.enqueue(new Uint8Array(65_536).fill(32));
      },
    });
    const fetch = vi.fn(async () => new Response(endless)) as unknown as typeof globalThis.fetch;
    expect(await verifyPublished("https://rosas.example", site, { fetch, attempts: 1 })).toEqual({
      status: "different",
    });
    expect(read).toBeLessThan(2_000_000);
  });

  it("checks nothing without an https address or a home page", async () => {
    const { fetch, asked } = host(HOME);

    for (const url of ["", "not an address", "http://rosas.example", "ftp://rosas.example"]) {
      expect(await verifyPublished(url, site, { fetch })).toEqual({ status: "unchecked" });
    }
    expect(
      await verifyPublished("https://rosas.example", build({ "about.html": "" }), { fetch }),
    ).toEqual({ status: "unchecked" });
    expect(asked).toHaveLength(0);
  });

  it("stops when cancelled, the site unchecked", async () => {
    const controller = new AbortController();
    const fetch = vi.fn(
      async (_input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) => {
        controller.abort();
        throw init?.signal?.reason ?? new Error("aborted");
      },
    ) as unknown as typeof globalThis.fetch;

    const result = await verifyPublished("https://rosas.example", site, {
      fetch,
      signal: controller.signal,
    });

    expect(result).toEqual({ status: "unchecked" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
