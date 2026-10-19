/** Options for {@link buildContentSecurityPolicy}. */
export type ContentSecurityPolicyOptions = {
  /**
   * Nonce for the inline scripts and styles the Vite dev server injects (HMR client, React Refresh).
   * Only set in development; production builds load scripts and styles from files only.
   */
  readonly devNonce?: string;
};

/**
 * Builds the Content Security Policy of the editor window. The editor loads nothing from the
 * network: every script, style, font and image comes from the app itself.
 */
export function buildContentSecurityPolicy(options: ContentSecurityPolicyOptions = {}): string {
  const nonce = options.devNonce === undefined ? "" : ` 'nonce-${options.devNonce}'`;
  const directives = [
    "default-src 'none'",
    `script-src 'self'${nonce}`,
    `style-src 'self'${nonce}`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ];
  return directives.join("; ");
}
