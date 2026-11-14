import { isNodeDoc, type NodeDoc } from "./documents.js";
import type { SiteDoc } from "./site-doc.js";
import { type ElementPlace, eachElement } from "./site-elements.js";

/** The Custom Code element's type (2.11): HTML the person wrote, exported as it is. */
const CUSTOM_CODE = "CustomCode";

/**
 * The parts of Settings' Custom Code the owner confirms (#649, S1): the three that run for the
 * site's visitors, and its CSS while it can load something or put text on its pages (#975).
 */
export type CodePart = "head" | "bodyEnd" | "js" | "css";

/** Those parts, in the order the prompt lists them. */
export const CODE_PARTS: readonly CodePart[] = ["head", "bodyEnd", "js", "css"];

/**
 * What lets CSS load a file or put text on a page (#975): an address; `url()`, `image-set()` or
 * `src()`; `@import`; a `content` property; or an escape, which can write any of them. A comment
 * holding one counts too: it costs a question, never a file let through.
 */
const CSS_REACHES = /\\|\/\/|url\(|image-set\(|src\(|@import|(?<![\w-])content\s*:/i;

/**
 * What else puts text on a page: `@counter-style`, and a quoted string in a property that prints
 * it, such as a list's markers (`list-style-type: "Call 0800 000 000: "`), a counter style's
 * `symbols`, `prefix` or `suffix`, `text-overflow`'s ellipsis, `quotes` or `hyphenate-character`.
 * `list-style: disc` has no string, and isn't asked about. A value is read only to its next `:`, so
 * each character is read about once.
 */
const CSS_PRINTS =
  /@counter-style|(?<![\w-])(?:list-style(?:-type)?|symbols|prefix|suffix|text-overflow|quotes|hyphenate-character)\s*:[^;}:]*["']/i;

/** CSS's comments, which separate what's either side of them as a space does. */
const CSS_COMMENTS = /\/\*[\s\S]*?(?:\*\/|$)/g;

/**
 * Whether the site's CSS `css` needs its owner's yes, like its scripts (#975, S1): it can load
 * files, from another website too, or change the text its pages show (a phone number, bank
 * details). CSS that only changes how the site looks never does. It's read as written, and with
 * its comments as spaces, so a comment between a property's name and its colon can't hide it.
 */
export function cssNeedsTrust(css: string): boolean {
  const reaches = (text: string) => CSS_REACHES.test(text) || CSS_PRINTS.test(text);
  return reaches(css) || reaches(css.replace(CSS_COMMENTS, " "));
}

/** Whether `text`, as part `part`, is code the owner confirms: none when it's blank. */
const confirmed = (part: CodePart, text: string) =>
  text.trim() !== "" && (part !== "css" || cssNeedsTrust(text));

/**
 * A piece of the site's own code that runs for its visitors, or lets other code in (#649, S1):
 * a part of Settings' Custom Code, a Custom Code element, or the addresses Settings allow. Its
 * `text` is what the owner confirms, and what a build keeps or leaves out.
 */
export type SiteCodePiece =
  | { readonly kind: "code"; readonly part: CodePart; readonly text: string }
  | {
      readonly kind: "element";
      readonly on: ElementPlace;
      readonly nodeId: string;
      readonly text: string;
    }
  | { readonly kind: "allowList"; readonly text: string };

/** The addresses Settings' Custom Code allows, as one piece's text: one per line. */
export const allowListText = (urls: readonly string[]): string => urls.join("\n");

/**
 * Each piece of `site`'s code that isn't blank: Settings' Head, End of page, Script and CSS (when
 * {@link cssNeedsTrust}), then each Custom Code element the export draws (none hidden in Layers),
 * then the allowed addresses.
 */
export function siteCodePieces(site: SiteDoc): SiteCodePiece[] {
  const pieces: SiteCodePiece[] = [];
  for (const part of CODE_PARTS) {
    const text = site.code[part];
    if (confirmed(part, text)) pieces.push({ kind: "code", part, text });
  }
  eachElement(
    site,
    (node, on) => {
      const text = node.props.code;
      if (node.type === CUSTOM_CODE && typeof text === "string" && text.trim() !== "") {
        pieces.push({ kind: "element", on, nodeId: node.props.id, text });
      }
    },
    { skipHidden: true },
  );
  const allowed = site.settings.allowedExternalUrls;
  if (allowed.length > 0) pieces.push({ kind: "allowList", text: allowListText(allowed) });
  return pieces;
}

/**
 * `site` with the code `keeps` doesn't keep blanked, as a build that leaves it out draws it:
 * Settings' parts (its CSS when {@link cssNeedsTrust}) and Custom Code elements, in shared sections
 * and collections' designs too (#936). The allowed addresses stay; Site Check applies them only
 * once confirmed.
 */
export function withKeptCode(site: SiteDoc, keeps: (text: string) => boolean): SiteDoc {
  /** Blank code is kept whatever `keeps` says: there's nothing in it to leave out. */
  const leaves = (text: string) => text.trim() !== "" && !keeps(text);
  const part = (text: string) => (leaves(text) ? "" : text);
  /** CSS that changes only how the site looks isn't asked about, and stays (#975). */
  const css = (text: string) => (cssNeedsTrust(text) ? part(text) : text);
  const nodes = (list: readonly NodeDoc[]): NodeDoc[] =>
    list.map((node) => {
      const props: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node.props)) {
        props[key] = Array.isArray(value)
          ? value.map((item) => (isNodeDoc(item) ? (nodes([item])[0] ?? item) : item))
          : value;
      }
      if (node.type === CUSTOM_CODE && typeof node.props.code === "string") {
        props.code = part(node.props.code);
      }
      return { ...node, props: props as NodeDoc["props"] };
    });
  return {
    ...site,
    code: {
      ...site.code,
      css: css(site.code.css),
      js: part(site.code.js),
      head: part(site.code.head),
      bodyEnd: part(site.code.bodyEnd),
    },
    layout: {
      ...site.layout,
      header: nodes(site.layout.header),
      footer: nodes(site.layout.footer),
    },
    pages: Object.fromEntries(
      Object.entries(site.pages).map(([id, page]) => [
        id,
        { ...page, doc: { ...page.doc, content: nodes(page.doc.content) } },
      ]),
    ) as SiteDoc["pages"],
    sharedSections: Object.fromEntries(
      Object.entries(site.sharedSections).map(([id, entry]) => [
        id,
        { ...entry, section: nodes([entry.section])[0] ?? entry.section },
      ]),
    ) as SiteDoc["sharedSections"],
    collections: Object.fromEntries(
      Object.entries(site.collections).map(([id, collection]) => [
        id,
        {
          ...collection,
          design: {
            before: nodes(collection.design.before),
            after: nodes(collection.design.after),
          },
        },
      ]),
    ) as SiteDoc["collections"],
  };
}
