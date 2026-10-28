import { describe, expect, it, vi } from "vitest";
import {
  BUNDLE_MAX_BYTES,
  type BundleFetch,
  type BundleNetwork,
  bundleNetworkFor,
  downloadForBundle,
  isLocalAddress,
} from "./bundle-download.js";

/** What a stand-in website answers: a file with its type, or a redirect. */
type Answer =
  | { readonly body: string | Uint8Array | ReadableStream<Uint8Array>; readonly type?: string }
  | { readonly redirect: string };

/**
 * A stand-in for the network: each address's answer, a 404 for the rest; every host resolves to a
 * public address unless `hosts` says otherwise.
 */
function web(
  answers: Record<string, Answer>,
  hosts: Record<string, readonly string[]> = {},
): BundleNetwork & { readonly asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    resolve: async (host) => hosts[host] ?? ["93.184.215.14"],
    fetch: async (url, init) => {
      asked.push(url);
      expect(init.redirect).toBe("manual");
      const answer = answers[url];
      if (answer === undefined) return new Response("Not found", { status: 404 });
      if ("redirect" in answer) {
        return new Response(null, { status: 302, headers: { location: answer.redirect } });
      }
      return new Response(answer.body, {
        headers: answer.type === undefined ? {} : { "content-type": answer.type },
      });
    },
  };
}

const text = (data: Uint8Array) => new TextDecoder().decode(data);

/** Why `url` couldn't be kept, or `downloaded`. */
async function reason(network: BundleNetwork, url: string) {
  const result = await downloadForBundle(network, url);
  return result.status === "failed" ? result.reason : result.status;
}

describe("downloadForBundle (C8, 3.9)", () => {
  it("downloads a script under a name of its own, with its type", async () => {
    const network = web({
      "https://cdn.example.com/lib/Widget.min.js": {
        body: "window.widget = 1;",
        type: "text/javascript; charset=utf-8",
      },
    });

    const result = await downloadForBundle(network, "https://cdn.example.com/lib/Widget.min.js");

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
    const network = web({
      "https://fonts.example.com/css/inter.css": { body: css, type: "text/css" },
      "https://fonts.example.com/inter.woff2": { body: "w2", type: "font/woff2" },
      // A relative address, from where the stylesheet came from; the server says only "bytes".
      "https://fonts.example.com/css/fonts/inter.woff": {
        body: "w1",
        type: "application/octet-stream",
      },
    });

    const result = await downloadForBundle(network, "//fonts.example.com/css/inter.css");

    expect(result.status).toBe("downloaded");
    if (result.status !== "downloaded") return;
    const [sheet, ...fonts] = result.files;
    const woff2 = fonts.find((file) => file.mime === "font/woff2");
    const woff = fonts.find((file) => file.mime === "font/woff");
    expect(text(sheet?.data ?? new Uint8Array())).toBe(
      `@font-face { src: url(${woff2?.file}) format('woff2'), url('${woff?.file}'); }\n` +
        ".bg { background: url(data:image/png;base64,AAAA); }",
    );
  });

  it("follows a redirect to another https:// address, keeping the address the code names", async () => {
    const network = web({
      "https://cdn.example.com/latest/lib.js": { redirect: "https://cdn.example.com/v2/lib.js" },
      "https://cdn.example.com/v2/lib.js": { body: "v2", type: "text/javascript" },
    });

    const result = await downloadForBundle(network, "https://cdn.example.com/latest/lib.js");

    expect(result.status === "downloaded" ? result.files[0]?.url : result).toBe(
      "https://cdn.example.com/latest/lib.js",
    );
  });

  it("follows no redirect to http://, nor to this computer or its network (security)", async () => {
    const network = web(
      {
        "https://evil.example.com/to-http.css": { redirect: "http://cdn.example.com/x.css" },
        "https://evil.example.com/to-router.css": { redirect: "https://192.168.1.1/admin" },
        "https://evil.example.com/to-name.css": { redirect: "https://router.example.com/" },
        "https://evil.example.com/loop.css": { redirect: "/loop.css" },
      },
      { "router.example.com": ["10.0.0.1"], "home.example.com": ["127.0.0.1"] },
    );

    expect(await reason(network, "https://evil.example.com/to-http.css")).toBe("not-https");
    expect(await reason(network, "https://evil.example.com/to-router.css")).toBe("local");
    expect(await reason(network, "https://evil.example.com/to-name.css")).toBe("local");
    expect(await reason(network, "https://home.example.com/x.js")).toBe("local");
    expect(await reason(network, "https://localhost/x.js")).toBe("local");
    expect(await reason(network, "https://evil.example.com/loop.css")).toBe("not-found");
    // Neither the redirect's target nor a local host was asked for.
    expect(network.asked).not.toContain("http://cdn.example.com/x.css");
    const hosts = network.asked.map((url) => new URL(url).hostname);
    expect(hosts.filter((host) => host !== "evil.example.com")).toEqual([]);
  });

  it("stops reading a file without a length once it passes the limit (security)", async () => {
    let sent = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1_000_000;
        controller.enqueue(new Uint8Array(1_000_000));
      },
    });
    const network = web({
      "https://cdn.example.com/big.js": { body: endless, type: "text/javascript" },
    });

    expect(await reason(network, "https://cdn.example.com/big.js")).toBe("too-large");
    expect(sent).toBeLessThan(BUNDLE_MAX_BYTES + 3_000_000);
  });

  it("says why a file can't be kept", async () => {
    const network = web({
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

    expect(await reason(network, "http://example.com/lib.js")).toBe("not-https");
    expect(await reason(network, "not an address")).toBe("not-https");
    expect(await reason(network, "https://example.com/gone.js")).toBe("not-found");
    expect(await reason(network, "https://example.com/page")).toBe("not-a-file");
    expect(await reason(network, "https://example.com/big.js")).toBe("too-large");
    // A stylesheet whose own files can't be had isn't kept either.
    expect(await reason(network, "https://fonts.example.com/site.css")).toBe("not-found");
    const offline: BundleFetch = () => Promise.reject(new TypeError("fetch failed"));
    expect(await reason({ ...network, fetch: offline }, "https://example.com/lib.js")).toBe(
      "offline",
    );
    const noAnswer = { ...network, resolve: () => Promise.reject(new Error("ENOTFOUND")) };
    expect(await reason(noAnswer, "https://example.com/lib.js")).toBe("offline");
  });
});

describe("isLocalAddress", () => {
  it("knows this computer's and its network's addresses from another website's", () => {
    for (const local of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.0.10",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "::",
      "fd12:3456::1",
      "fe80::1",
      "::ffff:192.168.1.1",
    ]) {
      expect(isLocalAddress(local), local).toBe(true);
    }
    for (const elsewhere of ["93.184.215.14", "172.32.0.1", "8.8.8.8", "2606:4700::1111"]) {
      expect(isLocalAddress(elsewhere), elsewhere).toBe(false);
    }
  });
});

describe("bundleNetworkFor", () => {
  it("uses the E2E tests' stand-ins only in an unpackaged E2E launch", async () => {
    const real = {
      fetch: vi.fn<BundleFetch>(async () => new Response("real")),
      resolve: vi.fn(async () => ["93.184.215.14"]),
    };
    const stand = vi.fn<BundleFetch>(async () => new Response("stand-in"));
    const standResolve = vi.fn(async () => ["198.51.100.1"]);
    Object.assign(globalThis, { webforgeBundleFetch: stand, webforgeBundleResolve: standResolve });
    try {
      const init = { signal: new AbortController().signal, redirect: "manual" } as const;
      const e2e = bundleNetworkFor(real, false, { WEBFORGE_E2E_BUNDLE: "1" });
      await e2e.fetch("https://a.test/x.js", init);
      await e2e.resolve("a.test");
      expect(stand).toHaveBeenCalledOnce();
      expect(standResolve).toHaveBeenCalledOnce();
      await bundleNetworkFor(real, true, { WEBFORGE_E2E_BUNDLE: "1" }).fetch(
        "https://a.test/x.js",
        init,
      );
      await bundleNetworkFor(real, false, {}).fetch("https://a.test/x.js", init);
      expect(real.fetch).toHaveBeenCalledTimes(2);
    } finally {
      Object.assign(globalThis, {
        webforgeBundleFetch: undefined,
        webforgeBundleResolve: undefined,
      });
    }
  });
});
