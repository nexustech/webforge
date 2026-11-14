import { t } from "@webforge/i18n";
import {
  escapeHtmlText,
  findNode,
  isNodeDoc,
  languageTagSchema,
  type NodeDoc,
  type PageId,
  type SiteDoc,
} from "@webforge/model";
import { type ComponentLibrary, MAX_TEXT_LENGTH } from "@webforge/site-components";
import { DRAFT_TEXT_MAX, DRAFT_TEXTS_MAX, type DraftRequest } from "../../shared/ipc/assistant.js";
import type { EditorSession } from "../editor/editor-session.js";
import { setTextField, type TextFieldRef, textFieldsOf } from "../find/index.js";
import { assistantLabel } from "./assistant-step.js";

/**
 * One text of the home or About page the assistant writes afresh for the business (QS-7, #873):
 * where it is, what it is ("Home · Hero · Heading") and the template's sample it replaces.
 */
export type BusinessText = TextFieldRef & {
  readonly pageId: PageId;
  readonly nodeId: string;
  readonly rich: boolean;
  /** The page, the element and the field, for the model and the review. */
  readonly role: string;
  readonly sample: string;
};

/** The longest role the request takes. */
const ROLE_MAX = 100;

/** `html`'s text as a visitor reads it, paragraphs on lines of their own. */
function plain(html: string): string {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  const blocks = [...body.children].map((block) => block.textContent?.trim() ?? "");
  const text = blocks.length > 1 ? blocks.join("\n\n") : (body.textContent ?? "");
  return text.replace(/[^\S\n]+/g, " ").trim();
}

/** The pages the quick start's business words go on: the home page, then About, if there is one. */
function pagesOf(site: SiteDoc): PageId[] {
  const home = site.homePageId;
  const about = Object.values(site.pages).find(
    (page) =>
      page.id !== home &&
      page.kind === "page" &&
      page.folder === undefined &&
      page.slug === "about",
  );
  return about === undefined ? [home] : [home, about.id];
}

/**
 * The texts of the home and About pages a business's words replace (QS-7), in reading order: each
 * text field an owner writes (Find and Replace's), of elements shown, with a sample to replace. At
 * most as many as one draft takes, the home page's first.
 */
export function businessTexts(site: SiteDoc, library: ComponentLibrary): BusinessText[] {
  const texts: BusinessText[] = [];
  for (const pageId of pagesOf(site)) {
    const page = site.pages[pageId];
    if (page === undefined) continue;
    const walk = (nodes: readonly NodeDoc[]) => {
      for (const node of nodes) {
        if (node.props.hidden === true) continue;
        const nodeId = node.props.id;
        const component = library.components[node.type];
        for (const field of textFieldsOf(node, library)) {
          const sample = field.rich ? plain(field.value) : field.value.trim();
          if (sample === "" || typeof nodeId !== "string" || component === undefined) continue;
          const name = field.item?.field ?? field.field;
          const label = component.fields[field.field];
          const fieldLabel =
            field.item === undefined
              ? (label?.label ?? name)
              : label?.kind === "list"
                ? (label.fields[name]?.label ?? name)
                : name;
          texts.push({
            field: field.field,
            ...(field.item === undefined ? {} : { item: field.item }),
            rich: field.rich,
            pageId,
            nodeId,
            role: [page.title, component.label, fieldLabel].join(" · ").slice(0, ROLE_MAX),
            sample: sample.slice(0, DRAFT_TEXT_MAX),
          });
        }
        for (const value of Object.values(node.props)) {
          if (Array.isArray(value)) walk(value.filter(isNodeDoc));
        }
      }
    };
    walk(page.doc.content);
  }
  return texts.slice(0, DRAFT_TEXTS_MAX);
}

/** The site's language, as the draft takes it: Site Settings', or English if it isn't one. */
const languageOf = (site: SiteDoc) => {
  const { language } = site.settings.general;
  return languageTagSchema.safeParse(language).success ? language : "en";
};

/**
 * The draft of `texts` for the business `about` describes (QS-7): its name and type from Site
 * Settings, and each text's role and sample. Never anything else of the site (ADR 0026 §6).
 */
export function businessRequest(
  site: SiteDoc,
  about: string,
  texts: readonly BusinessText[],
): DraftRequest {
  const { name, businessType } = site.settings.general;
  return {
    kind: "business",
    language: languageOf(site),
    business: {
      name: name.trim().slice(0, 200) || t("site.untitledName"),
      type: businessType === undefined ? "" : t(`template.category.${businessType}`),
      about: about.slice(0, DRAFT_TEXT_MAX),
    },
    texts: texts.map(({ role, sample }) => ({ role, sample })),
  };
}

/** `text` as a field of its kind holds it: one line, or rich text's paragraphs. */
function fieldValue(text: string, rich: boolean): string {
  if (!rich) return text.replace(/\s+/g, " ").trim();
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph !== "")
    .map((paragraph) => `<p>${escapeHtmlText(paragraph)}</p>`)
    .join("");
}

/**
 * Keeps the person's reviewed words, `words[i]` for `texts[i]`, as one undo step labelled as the
 * assistant's. A text left empty keeps the template's sample, as does one whose element has gone.
 */
export function keepBusinessWords(
  session: Pick<EditorSession, "edit">,
  texts: readonly BusinessText[],
  words: readonly string[],
): void {
  session.edit("props", assistantLabel(t("assistant.business.history")), (draft) => {
    texts.forEach((text, index) => {
      const value = fieldValue(words[index] ?? "", text.rich);
      if (value === "" || value.length > MAX_TEXT_LENGTH) return;
      const content = draft.pages[text.pageId]?.doc.content ?? [];
      const node = findNode(content, (each) => each.props.id === text.nodeId);
      if (node !== undefined) setTextField(node, text, value);
    });
  });
}
