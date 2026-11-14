import { t } from "@webforge/i18n";
import {
  elementsAt,
  findNode,
  isImageMeta,
  isNodeDoc,
  isPageIn,
  languageTagSchema,
  type MediaId,
  mediaItem,
  type NodeDoc,
  PAGE_DESCRIPTION_MAX,
  type PageId,
  type SiteDoc,
} from "@webforge/model";
import type { Finding } from "@webforge/site-check";
import type { ComponentLibrary } from "@webforge/site-components";
import { DRAFT_TEXT_MAX, type DraftRequest } from "../../shared/ipc/assistant.js";
import { assistantLabel } from "../assistant/index.js";
import type { EditorSession } from "../editor/editor-session.js";
import { describePlace } from "./describe.js";

/**
 * What Site Check can ask the assistant to write (G25b, SEO-10, #873): a page's description, or
 * an image's alt text, for the person to review.
 */
export type DraftAsk =
  | { readonly kind: "description"; readonly pageId: PageId }
  | {
      readonly kind: "alt";
      readonly mediaId: MediaId;
      /** Where the image is placed, for the text near it. */
      readonly finding: Finding;
    };

/** The most of a page's text a description's draft reads (the draft's own limit). */
const PAGE_TEXT_MAX = 2 * DRAFT_TEXT_MAX;

/** The description a draft of a page leaves room for: what search results show. */
export const DESCRIPTION_MAX = PAGE_DESCRIPTION_MAX;

/** The alt text a draft gives at the most (main fits it to this). */
export const ALT_MAX = 250;

/** `html`'s text as a visitor reads it: tags gone, entities read, spaces collapsed. */
function plain(html: string): string {
  const text = new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
  return text.replace(/\s+/g, " ").trim();
}

/** The text of `nodes` and the elements in them, in order: what their text fields say. */
function textOf(nodes: readonly NodeDoc[], library: ComponentLibrary, max: number): string {
  const lines: string[] = [];
  let length = 0;
  const walk = (list: readonly NodeDoc[]) => {
    for (const node of list) {
      if (length >= max || node.props.hidden === true) continue;
      const fields = library.components[node.type]?.fields ?? {};
      for (const [name, field] of Object.entries(fields)) {
        const value = node.props[name];
        if ((field.kind !== "text" && field.kind !== "richtext") || typeof value !== "string") {
          continue;
        }
        const line = plain(value);
        if (line === "") continue;
        lines.push(line);
        length += line.length + 1;
      }
      for (const value of Object.values(node.props)) {
        if (Array.isArray(value)) walk(value.filter(isNodeDoc));
      }
    }
  };
  walk(nodes);
  return lines.join("\n").slice(0, max);
}

/** The site's language, as the draft takes it: Site Settings', or English if it isn't one. */
const languageOf = (site: SiteDoc) => {
  const { language } = site.settings.general;
  return languageTagSchema.safeParse(language).success ? language : "en";
};

/** Whether the assistant could write for `finding` of `rule`, from the finding alone. */
export function mayWrite(rule: string, { place, values }: Finding): boolean {
  return (
    (rule === "pageDescriptions" && place.kind === "page") ||
    (rule === "altText" && place.kind === "element" && typeof values?.mediaId === "string")
  );
}

/** What the assistant could write for `finding` of `rule`, if anything. */
export function draftAskFor(rule: string, finding: Finding, site: SiteDoc): DraftAsk | undefined {
  const { place } = finding;
  if (rule === "pageDescriptions" && place.kind === "page" && isPageIn(site.pages, place.pageId)) {
    return { kind: "description", pageId: place.pageId };
  }
  const mediaId = finding.values?.mediaId;
  const meta = typeof mediaId === "string" ? mediaItem(site.media, mediaId) : undefined;
  if (rule === "altText" && place.kind === "element" && meta !== undefined && isImageMeta(meta)) {
    return { kind: "alt", mediaId: meta.id, finding };
  }
  return undefined;
}

/**
 * The draft `ask` needs, from `site` as it is: a page's title and text, or an image's file name,
 * where it is and the text of the section it's in. Never the image itself (ADR 0026 §6).
 * Undefined if there's nothing to write from.
 */
export function draftRequestFor(
  ask: DraftAsk,
  site: SiteDoc,
  library: ComponentLibrary,
): DraftRequest | undefined {
  const language = languageOf(site);
  if (ask.kind === "description") {
    const page = site.pages[ask.pageId];
    if (page === undefined) return undefined;
    const text = textOf(page.doc.content, library, PAGE_TEXT_MAX) || page.title.trim();
    if (text === "") return undefined;
    return {
      kind: "description",
      language,
      site: site.settings.general.name.slice(0, 200),
      page: { title: page.title.slice(0, 200), text },
    };
  }
  const meta = mediaItem(site.media, ask.mediaId);
  const { place } = ask.finding;
  if (meta === undefined || place.kind !== "element") return undefined;
  // The section the image is in: the words around it.
  const section = elementsAt(site, place.on).find(
    (top) => findNode([top], (node) => node.props.id === place.nodeId) !== undefined,
  );
  return {
    kind: "alt",
    language,
    fileName: meta.fileName.slice(0, 300),
    page: describePlace(ask.finding, site, library).slice(0, 200),
    nearby: section === undefined ? "" : textOf([section], library, DRAFT_TEXT_MAX),
  };
}

/** A name for `ask`'s subject, for its dialog: the page's title, or the image's file name. */
export function subjectOf(ask: DraftAsk, site: SiteDoc): string {
  return ask.kind === "description"
    ? (site.pages[ask.pageId]?.title ?? "")
    : (mediaItem(site.media, ask.mediaId)?.fileName ?? "");
}

/**
 * Keeps `text`, the person's reviewed draft, as one undo step labelled as the assistant's: the
 * page's description, or the image's own alt text in Media, which every placement of it shows
 * unless a placement has its own (G15).
 */
export function keepDraftText(
  session: Pick<EditorSession, "edit">,
  ask: DraftAsk,
  site: SiteDoc,
  text: string,
): void {
  const subject = subjectOf(ask, site);
  if (ask.kind === "description") {
    session.edit(
      "props",
      assistantLabel(t("assistant.write.history.description", { page: subject })),
      (draft) => {
        const page = draft.pages[ask.pageId];
        if (page !== undefined) page.settings.description = text.slice(0, DESCRIPTION_MAX);
      },
    );
    return;
  }
  session.edit("props", assistantLabel(t("site.media.history.alt", { name: subject })), (draft) => {
    const meta = draft.media[ask.mediaId];
    if (meta !== undefined && isImageMeta(meta)) meta.alt = text.slice(0, ALT_MAX);
  });
}
