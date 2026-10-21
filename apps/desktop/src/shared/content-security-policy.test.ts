import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./content-security-policy.js";
import { MEDIA_SCHEME } from "./ipc/media.js";

describe("buildContentSecurityPolicy", () => {
  it("allows only the app's own scripts in production", () => {
    const csp = buildContentSecurityPolicy();

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self';");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("allows inline styles, which the canvas engine injects, but no inline scripts", () => {
    const csp = buildContentSecurityPolicy();

    expect(csp).toContain("style-src 'self' 'unsafe-inline';");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it("shows images from the app and Media's own scheme only", () => {
    expect(buildContentSecurityPolicy()).toContain(`img-src 'self' data: blob: ${MEDIA_SCHEME}:;`);
  });

  it("adds the dev server nonce to scripts only in development", () => {
    const csp = buildContentSecurityPolicy({ devNonce: "abc123" });

    expect(csp).toContain("script-src 'self' 'nonce-abc123'");
    // A nonce would make browsers ignore 'unsafe-inline' for styles.
    expect(csp).toContain("style-src 'self' 'unsafe-inline';");
  });
});
