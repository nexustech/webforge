import sanitizeHtml from "sanitize-html";

/**
 * The tags Custom Code keeps where it is shown in the editor (the canvas, Storybook, the class
 * collection): structure, text, lists, tables, figures, images, links and inline SVG's shapes. No
 * scripts, styles, frames, embedded objects or forms: nothing that runs, loads or posts.
 */
const TAGS = [
  // Structure and text.
  ...["div", "span", "p", "br", "hr", "section", "article", "header", "footer", "nav", "aside"],
  ...["main", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "s", "small"],
  ...["mark", "sub", "sup", "blockquote", "q", "cite", "code", "pre", "kbd", "abbr", "time"],
  ...["address", "details", "summary", "a"],
  // Lists, tables, figures and images.
  ...["ul", "ol", "li", "dl", "dt", "dd", "table", "thead", "tbody", "tfoot", "tr", "th", "td"],
  ...["caption", "colgroup", "col", "figure", "figcaption", "img"],
  // Inline SVG's shapes: not its links (`a`, `use`), animations (`animate`, `set`), images or
  // foreign objects, any of which can carry a script or a request.
  ...["svg", "g", "path", "circle", "ellipse", "line", "polyline", "polygon", "rect", "text"],
  ...["tspan", "defs", "title", "desc", "lineargradient", "radialgradient", "stop", "clippath"],
];

/** The SVG attributes a shape is drawn with. */
const SVG_ATTRIBUTES = [
  ...["viewbox", "xmlns", "fill", "fill-rule", "fill-opacity", "stroke", "stroke-width"],
  ...["stroke-linecap", "stroke-linejoin", "stroke-opacity", "opacity", "transform", "d", "cx"],
  ...["cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "points", "width", "height"],
  ...["offset", "stop-color", "stop-opacity", "gradientunits", "gradienttransform", "clip-path"],
];

/** A style that could load or run something: a URL (an image from the web), or a CSS escape. */
const RISKY_STYLE = /url\s*\(|image-set|expression\s*\(|@import|\\|javascript:|behaviou?r/i;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: TAGS,
  allowedAttributes: {
    "*": ["class", "id", "title", "lang", "dir", "role", "aria-*", "style", ...SVG_ATTRIBUTES],
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    ol: ["start", "reversed"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan", "scope"],
    time: ["datetime"],
  },
  // Nothing from the web on the canvas: no http(s) links or images, only a page's own and mail or
  // phone links, and images written into the code (`data:` on an image only).
  allowedSchemes: ["mailto", "tel"],
  allowedSchemesByTag: { img: ["data"] },
  allowedSchemesAppliedToAttributes: ["href", "src", "cite"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  // What a dropped tag held is dropped with it, not shown as text.
  nonTextTags: [
    ...["script", "style", "textarea", "option", "noscript", "template", "iframe", "object"],
    ...["xmp", "noembed", "noframes", "plaintext", "math"],
  ],
  parser: { lowerCaseAttributeNames: true },
  transformTags: {
    "*": (tagName, attribs) => {
      const { style, ...rest } = attribs;
      return {
        tagName,
        attribs: style === undefined || RISKY_STYLE.test(style) ? rest : { ...rest, style },
      };
    },
    // A link to a new tab can't reach back into the page that opened it.
    a: (tagName, attribs) => {
      const { target, rel: _rel, ...rest } = attribs;
      return {
        tagName,
        attribs: target === "_blank" ? { ...rest, target, rel: "noopener noreferrer" } : rest,
      };
    },
  },
};

/**
 * Custom Code (F-ED-15) made safe to show in the editor: its markup without anything that runs,
 * loads or posts (scripts, styles, frames, forms, event handlers, `javascript:` and web
 * addresses, risky styles). The export writes the code as it is (`RenderContext.rawCustomCode`).
 */
export function sanitizeCustomCode(code: string): string {
  return sanitizeHtml(code, OPTIONS);
}
