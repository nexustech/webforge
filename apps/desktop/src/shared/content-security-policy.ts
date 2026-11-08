/** The app's pages, each with its own policy. */
export type ContentSecurityPolicyPage = "editor" | "help";

/** Options for {@link buildContentSecurityPolicy}. */
export type ContentSecurityPolicyOptions = {
  /** Which page the policy is for: the editor's window (the default) or the Help window's (5.4b). */
  readonly page?: ContentSecurityPolicyPage;
  /**
   * Nonce for the inline scripts the Vite dev server injects (HMR client, React Refresh).
   * Only set in development; production builds load scripts from files only.
   */
  readonly devNonce?: string;
};

/**
 * Builds the Content Security Policy of one of the app's pages. No page loads anything from the
 * network: every script, style, font and image comes from the app itself.
 *
 * Styles allow `'unsafe-inline'` because the canvas engine injects `<style>` elements at runtime
 * (Puck's canvas interaction styles inside the iframe, Tiptap's editor styles), some with
 * per-drag content that no hash can cover (ADR 0004). Scripts stay strict. Inline CSS cannot load
 * anything from elsewhere either: images and fonts are limited to the app by `img-src`/`font-src`.
 * No nonce goes on `style-src`: with a nonce present, browsers ignore `'unsafe-inline'`.
 *
 * The editor shows the site's Media through `webforge-media:` (`MEDIA_SCHEME`, 1.16) and its fonts
 * through `webforge-font:` (`FONT_SCHEME`, 2.2); this file is also loaded by the Vite config, so it
 * names the schemes itself. The Help window's page needs neither: its pages are bundled Markdown,
 * drawn with no pictures and the app's own styles, and it fetches nothing, so it gets no images,
 * fonts or connections (S35). Its window shares the editor's session, where both schemes are
 * registered, so the policy is what keeps them from it. In development, Vite's client still
 * connects to the dev server to reload the page.
 */
export function buildContentSecurityPolicy(options: ContentSecurityPolicyOptions = {}): string {
  const development = options.devNonce !== undefined;
  const nonce = development ? ` 'nonce-${options.devNonce}'` : "";
  const sources =
    options.page === "help"
      ? ["img-src 'none'", "font-src 'none'", `connect-src ${development ? "'self'" : "'none'"}`]
      : [
          "img-src 'self' data: blob: webforge-media:",
          "font-src 'self' webforge-font:",
          "connect-src 'self'",
        ];
  const directives = [
    "default-src 'none'",
    `script-src 'self'${nonce}`,
    "style-src 'self' 'unsafe-inline'",
    ...sources,
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
    // No frame loads anything, so none shows another site (R13d): `default-src` says so already,
    // and this says it outright. The canvas's iframe loads nothing: the editor writes it.
    "frame-src 'none'",
  ];
  return directives.join("; ");
}
