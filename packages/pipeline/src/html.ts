import beautify from "js-beautify";

/** Escapes text for use in HTML content and double-quoted attributes. */
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Classes on every page's `<body>`; the pipeline adds them to the CSS candidates. */
export const BODY_CLASS = "flex min-h-screen flex-col bg-base-100 font-sans text-base-content";

/** Everything one exported page's HTML document is made of. */
export type PageDocument = {
  readonly language: string;
  readonly theme: string;
  readonly title: string;
  readonly description: string | undefined;
  /** Relative URL of the stylesheet. */
  readonly stylesheet: string;
  /** Relative URL of `webforge.js`, if the page needs it. */
  readonly script: string | undefined;
  readonly header: string;
  readonly main: string;
  readonly footer: string;
  /** The back-to-top button (F-CM-9), after the Footer, or nothing when the page has none. */
  readonly backToTop?: string;
  /**
   * The favicon set's files, relative to the page (3.4): `favicon.ico`, a 192-pixel PNG, and
   * Apple's home-screen icon. Each is linked only when it was made.
   */
  readonly icons?: {
    readonly ico?: string;
    readonly png?: string;
    readonly appleTouch?: string;
  };
};

/** A shared region with its marker comment, or nothing when the page hides it. */
function sharedRegion(name: "Header" | "Footer", html: string): string {
  return html === "" ? "" : `<!-- ${name} (shared) -->\n${html}`;
}

/**
 * A complete, readable HTML document (X4): classic deferred script only, no modules (X1), and
 * comments marking the shared Header and Footer. Without `format`, as it is before pretty-printing,
 * for *Minify output*.
 */
export function pageDocument(page: PageDocument, format = true): string {
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(page.title)}</title>`,
    page.description === undefined
      ? ""
      : `<meta name="description" content="${escapeHtml(page.description)}">`,
    `<link rel="stylesheet" href="${page.stylesheet}">`,
    page.icons?.ico === undefined ? "" : `<link rel="icon" href="${page.icons.ico}">`,
    page.icons?.png === undefined
      ? ""
      : `<link rel="icon" type="image/png" sizes="192x192" href="${page.icons.png}">`,
    page.icons?.appleTouch === undefined
      ? ""
      : `<link rel="apple-touch-icon" href="${page.icons.appleTouch}">`,
    page.script === undefined ? "" : `<script defer src="${page.script}"></script>`,
  ].filter((line) => line !== "");
  const html = `<!doctype html>
<html lang="${escapeHtml(page.language)}" data-theme="${escapeHtml(page.theme)}">
<head>
${head.join("\n")}
</head>
<body class="${BODY_CLASS}">
${sharedRegion("Header", page.header)}
<main id="main" class="flex-1">
${page.main}
</main>
${sharedRegion("Footer", page.footer)}
${page.backToTop ?? ""}
</body>
</html>`;
  return format ? formatHtml(html) : html;
}

/**
 * Pretty-prints HTML with two-space indentation and no line wrapping (X4). What's in a script or
 * style element (Custom Code's, 2.11), a `pre` or a `textarea` is left as written.
 */
function formatHtml(html: string): string {
  return `${beautify.html(html, {
    indent_size: 2,
    wrap_line_length: 0,
    end_with_newline: false,
    preserve_newlines: false,
    indent_inner_html: false,
    extra_liners: [],
    content_unformatted: ["pre", "textarea", "script", "style"],
  })}\n`;
}
