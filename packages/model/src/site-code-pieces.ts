import { isNodeDoc, type NodeDoc } from "./documents.js";
import type { SiteDoc } from "./site-doc.js";
import { type ElementPlace, eachElement } from "./site-elements.js";

/** The Custom Code element's type (2.11): HTML the person wrote, exported as it is. */
const CUSTOM_CODE = "CustomCode";

/** The parts of Settings' Custom Code that run for the site's visitors: CSS isn't one. */
export type RunningCodePart = "js" | "head" | "bodyEnd";

const RUNNING_PARTS: readonly RunningCodePart[] = ["head", "bodyEnd", "js"];

/**
 * A piece of the site's own code that runs for its visitors, or lets other code in (#649, S1):
 * a part of Settings' Custom Code, a Custom Code element, or the addresses Settings allow. Its
 * `text` is what the owner confirms, and what a build keeps or leaves out.
 */
export type SiteCodePiece =
  | { readonly kind: "code"; readonly part: RunningCodePart; readonly text: string }
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
 * Each piece of `site`'s code that isn't blank: Settings' Head, End of page and Script, then each
 * Custom Code element the export draws (none hidden in Layers), then the allowed addresses.
 */
export function siteCodePieces(site: SiteDoc): SiteCodePiece[] {
  const pieces: SiteCodePiece[] = [];
  for (const part of RUNNING_PARTS) {
    const text = site.code[part];
    if (text.trim() !== "") pieces.push({ kind: "code", part, text });
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
 * `site` with the running code `keeps` doesn't keep blanked, as a build that leaves it out draws
 * it: Settings' parts and Custom Code elements, in shared sections too. The allowed addresses
 * stay; Site Check applies them only once confirmed.
 */
export function withKeptCode(site: SiteDoc, keeps: (text: string) => boolean): SiteDoc {
  /** Blank code is kept whatever `keeps` says: there's nothing in it to leave out. */
  const leaves = (text: string) => text.trim() !== "" && !keeps(text);
  const part = (text: string) => (leaves(text) ? "" : text);
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
  };
}
