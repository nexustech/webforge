/** Options for {@link buildContentSecurityPolicy}. */
export type ContentSecurityPolicyOptions = {
  /**
   * Nonce for the inline scripts the Vite dev server injects (HMR client, React Refresh).
   * Only set in development; production builds load scripts from files only.
   */
  readonly devNonce?: string;
};

/**
 * Builds the Content Security Policy of the editor window. The editor loads nothing from the
 * network: every script, style, font and image comes from the app itself.
 *
 * Styles allow `'unsafe-inline'` because the canvas engine injects `<style>` elements at runtime
 * (Puck's canvas interaction styles inside the iframe, Tiptap's editor styles), some with
 * per-drag content that no hash can cover (ADR 0004). Scripts stay strict. Inline CSS cannot load
 * anything from elsewhere either: images and fonts are limited to the app by `img-src`/`font-src`.
 * Media images come from the main process through `webforge-media:` (`MEDIA_SCHEME`, 1.16), and the
 * site's fonts through `webforge-font:` (`FONT_SCHEME`, 2.2); this file is also loaded by the Vite
 * config, so it names the schemes itself.
 * No nonce goes on `style-src`: with a nonce present, browsers ignore `'unsafe-inline'`.
 */
export function buildContentSecurityPolicy(options: ContentSecurityPolicyOptions = {}): string {
  const nonce = options.devNonce === undefined ? "" : ` 'nonce-${options.devNonce}'`;
  const directives = [
    "default-src 'none'",
    `script-src 'self'${nonce}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: webforge-media:",
    "font-src 'self' webforge-font:",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ];
  return directives.join("; ");
}
