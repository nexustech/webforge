import { describe, expect, it, vi } from "vitest";
import {
  BUNDLE_MAX_BYTES,
  type BundleFetch,
  bundleFetchFor,
  downloadForBundle,
} from "./bundle-download.js";

/** A stand-in for the network: each address's body and type, or no answer for the rest. */
function web(files: Record<string, { body: string | Uint8Array; type?: string }>): BundleFetch {
  return async (url) => {
    const file = files[url];
    if (file === undefined) return new Response("Not found", { status: 404 });
    return new Response(file.body, {
      headers: file.type === undefined ? {} : { "content-type": file.type },
    });
  };
}

const text = (data: Uint8Array) => new TextDecoder().decode(data);

describe("downloadForBundle (C8, 3.9)", () => {
  it("downloads a script under a name of its own, with its type", async () => {
    const fetch = web({
      "https://cdn.example.com/lib/Widget.min.js": {
        body: "window.widget = 1;",
        type: "text/javascript; charset=utf-8",
      },
    });

    const result = await downloadForBundle(fetch, "https://cdn.example.com/lib/Widget.min.js");

    expect(result.status).toBe("downloaded");
    if (result.status !== "downloaded") return;
    const [file] = result.files;
    expect(file?.url).toBe("https://cdn.example.com/lib/Widget.min.js");
    expect(file?.file).toMatch(/^widget-min-[0-9a-f]{8}\.js$/);
    expect(file?.mime).toBe("text/javascript");
    expect(text(file?.data ?? new Uint8Array())).toBe("window.widget = 1;");
  });

  it("downloads a stylesheet with the files it names, each pointed at its copy", async () => {
    const css =
      "@font-face { src: url(https://fonts.example.com/inter.woff2) format('woff2'), url('fonts/inter.woff'); }\n" +
      ".bg { background: url(data:image/png;base64,AAAA); }";
    const fetch = web({
      "https://fonts.example.com/css/inter.css": { body: css, type: "text/css" },
      "https://fonts.example.com/inter.woff2": { body: "w2", type: "font/woff2" },
      // A relative address, from where the stylesheet came from; the server says only "bytes".
      "https://fonts.example.com/css/fonts/inter.woff": {
        body: "w1",
        type: "application/octet-stream",
      },
    });

    const result = await downloadForBundle(fetch, "//fonts.example.com/css/inter.css");

    expect(result.status).toBe("downloaded");
    if (result.status !== "downloaded") return;
    const [sheet, woff2, woff] = result.files;
    expect(woff2?.mime).toBe("font/woff2");
    expect(woff?.mime).toBe("font/woff");
    expect(text(sheet?.data ?? new Uint8Array())).toBe(
      `@font-face { src: url(${woff2?.file}) format('woff2'), url('${woff?.file}'); }\n` +
        ".bg { background: url(data:image/png;base64,AAAA); }",
    );
  });

  it("says why a file can't be kept", async () => {
    const fetch = web({
      "https://example.com/page": { body: "<html>", type: "text/html" },
      "https://example.com/big.js": {
        body: new Uint8Array(BUNDLE_MAX_BYTES + 1),
        type: "text/javascript",
      },
      "https://fonts.example.com/site.css": {
        body: "@import url(missing.css);",
        type: "text/css",
      },
    });
    const reason = async (url: string, fetcher: BundleFetch = fetch) => {
      const result = await downloadForBundle(fetcher, url);
      return result.status === "failed" ? result.reason : result.status;
    };

    expect(await reason("http://example.com/lib.js")).toBe("not-https");
    expect(await reason("not an address")).toBe("not-https");
    expect(await reason("https://example.com/gone.js")).toBe("not-found");
    expect(await reason("https://example.com/page")).toBe("not-a-file");
    expect(await reason("https://example.com/big.js")).toBe("too-large");
    // A stylesheet whose own files can't be had isn't kept either.
    expect(await reason("https://fonts.example.com/site.css")).toBe("not-found");
    const offline: BundleFetch = () => Promise.reject(new TypeError("fetch failed"));
    expect(await reason("https://example.com/lib.js", offline)).toBe("offline");
  });
});

describe("bundleFetchFor", () => {
  const real: BundleFetch = vi.fn(async () => new Response("real"));
  const stand = vi.fn(async () => new Response("stand-in"));

  it("uses the E2E tests' stand-in only in an unpackaged E2E launch", async () => {
    Object.assign(globalThis, { webforgeBundleFetch: stand });
    try {
      const signal = new AbortController().signal;
      await bundleFetchFor(real, false, { WEBFORGE_E2E_BUNDLE: "1" })("https://a.test/x.js", {
        signal,
      });
      expect(stand).toHaveBeenCalledOnce();
      await bundleFetchFor(real, true, { WEBFORGE_E2E_BUNDLE: "1" })("https://a.test/x.js", {
        signal,
      });
      await bundleFetchFor(real, false, {})("https://a.test/x.js", { signal });
      expect(real).toHaveBeenCalledTimes(2);
    } finally {
      Object.assign(globalThis, { webforgeBundleFetch: undefined });
    }
  });
});
