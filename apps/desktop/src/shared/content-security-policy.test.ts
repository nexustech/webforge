import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./content-security-policy.js";

describe("buildContentSecurityPolicy", () => {
  it("allows only the app's own scripts and styles in production", () => {
    const csp = buildContentSecurityPolicy();

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self';");
    expect(csp).toContain("style-src 'self';");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("adds the dev server nonce to scripts and styles in development", () => {
    const csp = buildContentSecurityPolicy({ devNonce: "abc123" });

    expect(csp).toContain("script-src 'self' 'nonce-abc123'");
    expect(csp).toContain("style-src 'self' 'nonce-abc123'");
  });
});
