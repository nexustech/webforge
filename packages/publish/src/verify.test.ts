import { describe, expect, it, vi } from "vitest";
import type { BuildOutput } from "./publisher.js";
import { verifyPublished } from "./verify.js";

const bytes = (text: string) => new TextEncoder().encode(text);
const build = (files: Record<string, string>): BuildOutput => ({
  files: new Map(Object.entries(files).map(([path, text]) => [path, bytes(text)])),
});
const site = build({ "index.html": "<h1>Rosa's Bakery</h1>", "about.html": "<h1>About</h1>" });

/** A host that answers each request with the next of `answers`, the last one from then on. */
function host(...answers: (string | number | Error)[]) {
  const asked: URL[] = [];
  const fetch = vi.fn(async (input: Parameters<typeof globalThis.fetch>[0]) => {
    asked.push(new URL(String(input)));
    const answer = answers[Math.min(asked.length, answers.length) - 1];
    if (answer instanceof Error) throw answer;
    return typeof answer === "number"
      ? new Response("", { status: answer })
      : new Response(answer, { status: 200 });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, asked };
}

describe("verifyPublished (08, step 5)", () => {
  it("finds the home page just published at the address, past any cache", async () => {
    const { fetch, asked } = host("<h1>Rosa's Bakery</h1>");

    const result = await verifyPublished("https://rosas.example", site, { fetch, delayMs: 0 });

    expect(result).toEqual({ status: "live" });
    expect(asked).toHaveLength(1);
    expect(asked[0]?.origin + (asked[0]?.pathname ?? "")).toBe("https://rosas.example/");
    expect(asked[0]?.searchParams.get("webforge-check")).toMatch(/^[0-9a-f]{12}$/);
  });

  it("asks again while a cache serves the old page or the deploy isn't there yet", async () => {
    const { fetch, asked } = host(404, "<h1>Old</h1>", "<h1>Rosa's Bakery</h1>");

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

  it("checks nothing without an https address or a home page", async () => {
    const { fetch, asked } = host("<h1>Rosa's Bakery</h1>");

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
