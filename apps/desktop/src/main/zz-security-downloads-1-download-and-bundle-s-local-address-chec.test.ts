// Security review S10 (docs/reviews/2026-10-30-security-review.md), restored by #654.
import { describe, expect, it, vi } from "vitest";
import { type BundleNetwork, downloadForBundle, isLocalAddress } from "./bundle-download.js";

describe("security: IPv4-mapped IPv6 literals as the URL parser writes them", () => {
  it("treats ::ffff:127.0.0.1 and ::ffff:192.168.1.1 (hex form) as local", () => {
    for (const literal of ["https://[::ffff:127.0.0.1]/", "https://[::ffff:192.168.1.1]/"]) {
      const host = new URL(literal).hostname.slice(1, -1);
      expect(isLocalAddress(host), host).toBe(true);
    }
  });

  it("refuses https://[::ffff:127.0.0.1]/x.js without fetching it", async () => {
    const fetch = vi.fn(
      async () => new Response("x", { headers: { "content-type": "text/javascript" } }),
    );
    const network: BundleNetwork = { fetch, resolve: async () => ["93.184.215.14"] };
    const result = await downloadForBundle(network, "https://[::ffff:127.0.0.1]/x.js");
    expect(fetch).not.toHaveBeenCalled();
    expect(result.status === "failed" ? result.reason : result.status).toBe("local");
  });
});
