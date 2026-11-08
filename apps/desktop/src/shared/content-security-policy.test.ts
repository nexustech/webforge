import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./content-security-policy.js";
import { MEDIA_SCHEME } from "./ipc/media.js";

/** `FONT_SCHEME` in main/fonts.ts, which shared code can't import. */
const FONT_SCHEME = "webforge-font";

/** The policy's directives, by name. */
function directives(csp: string): Map<string, string> {
  return new Map(
    csp.split("; ").map((directive) => {
      const [name = "", ...sources] = directive.split(" ");
      return [name, sources.join(" ")];
    }),
  );
}

describe("buildContentSecurityPolicy", () => {
  it("allows only the app's own scripts in production", () => {
    const csp = buildContentSecurityPolicy();

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self';");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("lets no frame load anything (R13d)", () => {
    expect(buildContentSecurityPolicy()).toMatch(/(^|; )frame-src 'none'(;|$)/);
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

  it("gives the editor its whole policy by default", () => {
    expect(buildContentSecurityPolicy({ page: "editor" })).toBe(buildContentSecurityPolicy());
    expect(directives(buildContentSecurityPolicy())).toEqual(
      new Map([
        ["default-src", "'none'"],
        ["script-src", "'self'"],
        ["style-src", "'self' 'unsafe-inline'"],
        ["img-src", `'self' data: blob: ${MEDIA_SCHEME}:`],
        ["font-src", `'self' ${FONT_SCHEME}:`],
        ["connect-src", "'self'"],
        ["base-uri", "'none'"],
        ["form-action", "'none'"],
        ["object-src", "'none'"],
        ["frame-src", "'none'"],
      ]),
    );
  });

  it("gives the Help page only what it uses: no Media, fonts or connections (S35)", () => {
    const csp = buildContentSecurityPolicy({ page: "help" });

    expect(directives(csp)).toEqual(
      new Map([
        ["default-src", "'none'"],
        ["script-src", "'self'"],
        ["style-src", "'self' 'unsafe-inline'"],
        ["img-src", "'none'"],
        ["font-src", "'none'"],
        ["connect-src", "'none'"],
        ["base-uri", "'none'"],
        ["form-action", "'none'"],
        ["object-src", "'none'"],
        ["frame-src", "'none'"],
      ]),
    );
    expect(csp).not.toContain(MEDIA_SCHEME);
    expect(csp).not.toContain(FONT_SCHEME);
  });

  it("lets the Help page reach only the dev server in development", () => {
    const help = directives(buildContentSecurityPolicy({ page: "help", devNonce: "abc123" }));

    expect(help.get("script-src")).toBe("'self' 'nonce-abc123'");
    expect(help.get("connect-src")).toBe("'self'");
    expect(help.get("img-src")).toBe("'none'");
  });
});
