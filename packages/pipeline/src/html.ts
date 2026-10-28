import beautify from "js-beautify";

/** Escapes text for use in HTML content and double-quoted attributes. */
export function escapeHtml(text: string): string {
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
  /** Relative URL of the site's own `custom.css` (3.9), after the stylesheet, if it has one. */
  readonly customStylesheet?: string;
  /** Relative URL of `webforge.js`, if the page needs it. */
  readonly script: string | undefined;
  /** Relative URL of the site's own `custom.js` (3.9), after `webforge.js`, if it has one. */
  readonly customScript?: string;
  readonly header: string;
  readonly main: string;
  readonly footer: string;
  /** The back-to-top button (F-CM-9), after the Footer, or nothing when the page has none. */
  readonly backToTop?: string;
  /** Google Analytics' consent banner (3.8), after the back-to-top button: whole, safe HTML. */
  readonly consent?: string;
  /**
   * More lines for the `<head>`, in order, after the stylesheet: the favicon set's links first
   * (3.4), then the share and search tags (3.5). Each is whole, safe HTML that the build made.
   */
  readonly head?: readonly string[];
  /** The site's own HTML for every page's `<head>` (3.9), last in it, as the person wrote it. */
  readonly customHead?: string;
  /** The site's own HTML for the end of every page's `<body>` (3.9), as the person wrote it. */
  readonly customBodyEnd?: string;
};

/** A file of the site's icon set (3.4): where it is, its sizes and its type, as a manifest lists it. */
export type SiteIcon = {
  readonly path: string;
  /** `16x16 32x32 48x48` for the `.ico`, `180x180` for one PNG. */
  readonly sizes: string;
  readonly type: "image/x-icon" | "image/png";
  /** Linked from the pages' `<head>`; the larger PNGs are the manifest's only (3.5). */
  readonly link?: "icon" | "apple-touch-icon";
};

/** The `<link>`s to `icons` from a page `prefix` (`../` per folder) away from the site's root. */
export function iconLinks(icons: readonly SiteIcon[], prefix: string): string[] {
  return icons.flatMap((icon) =>
    icon.link === undefined
      ? []
      : [
          icon.type === "image/x-icon"
            ? `<link rel="icon" href="${prefix}${icon.path}" sizes="${icon.sizes}">`
            : `<link rel="${icon.link}" type="${icon.type}" sizes="${icon.sizes}" href="${prefix}${icon.path}">`,
        ],
  );
}

/** A shared region with its marker comment, or nothing when the page hides it. */
function sharedRegion(name: "Header" | "Footer", html: string): string {
  return html === "" ? "" : `<!-- ${name} (shared) -->\n${html}`;
}

/**
 * A complete, readable HTML document (X4): classic deferred scripts only, no modules (X1), and
 * comments marking the shared Header and Footer. The site's own code (3.9) goes in as the person
 * wrote it. Without `format`, as it is before pretty-printing, for *Minify output*.
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
    page.customStylesheet === undefined
      ? ""
      : `<link rel="stylesheet" href="${page.customStylesheet}">`,
    ...(page.head ?? []),
    page.script === undefined ? "" : `<script defer src="${page.script}"></script>`,
    page.customScript === undefined ? "" : `<script defer src="${page.customScript}"></script>`,
    page.customHead?.trim() ?? "",
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
${page.backToTop ?? ""}${page.consent ?? ""}${page.customBodyEnd?.trim() ?? ""}
</body>
</html>`;
  return format ? formatHtml(html) : html;
}

/**
 * Pretty-prints HTML with two-space indentation and no line wrapping (X4). What's in a script or
 * style element (Custom Code's, 2.11), a `pre` or a `textarea` is left as written.
 */
export function formatHtml(html: string): string {
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
