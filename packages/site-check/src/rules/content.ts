import { t } from "@webforge/i18n";
import {
  altTextFor,
  findBrokenLinks,
  imageValueSchema,
  linkValueSchema,
  mediaItem,
} from "@webforge/model";
import type { Catalogue } from "@webforge/site-components/catalogue-data";
import {
  eachFieldValue,
  elementPlace,
  exportedPlaces,
  fieldKey,
  type PlacedValue,
  plainText,
} from "../fields.js";
import type { CheckRule, Finding } from "../types.js";

/**
 * Links to a page, a section or a document that isn't there any more (F-ED-18): *Should fix*, and
 * *Must fix* to publish (X5). Links in hidden elements aren't exported, so they don't count.
 */
export const brokenLinksRule: CheckRule = {
  id: "brokenLinks",
  level: "should",
  strictOnPublish: true,
  check: ({ site }) => {
    const exported = exportedPlaces(site);
    return findBrokenLinks(site, { skipHidden: true })
      .filter((link) => exported(link.on))
      .map((link) => ({
        key: `${link.on}/${link.nodeId}/${"mediaId" in link ? link.mediaId : `${link.pageId}#${link.anchor ?? ""}`}`,
        place:
          link.on === "menu"
            ? { kind: "menu", itemId: link.nodeId }
            : { kind: "element", on: link.on, nodeId: link.nodeId },
      }));
  },
};

/**
 * An image placed on a page that was deleted from Media (F-ED-5): the export leaves it out, with a
 * warning, so the page has a gap there.
 */
export const missingImagesRule: CheckRule = {
  id: "missingImages",
  level: "should",
  check: (input) => {
    const found: Finding[] = [];
    eachFieldValue(input, ["media"], (placed) => {
      const image = imageValueSchema.safeParse(placed.value);
      if (!image.success) return;
      if (mediaItem(input.site.media, image.data.mediaId)?.kind !== "image") {
        found.push({ key: fieldKey(placed), place: elementPlace(placed) });
      }
    });
    return found;
  },
};

/**
 * An image without alt text, its own or the placement's (G15): screen readers and search engines
 * need it, and an image link has no other text.
 */
export const altTextRule: CheckRule = {
  id: "altText",
  level: "should",
  check: (input) => {
    const found: Finding[] = [];
    eachFieldValue(input, ["media"], (placed) => {
      const image = imageValueSchema.safeParse(placed.value);
      if (!image.success) return;
      const meta = mediaItem(input.site.media, image.data.mediaId);
      if (meta?.kind !== "image") return;
      if (altTextFor(image.data, meta).trim() === "") {
        found.push({
          key: fieldKey(placed),
          place: elementPlace(placed),
          values: { image: meta.fileName },
        });
      }
    });
    return found;
  },
};

/**
 * The starter texts that ask the person to write their own (`Say what this slide shows.`): left
 * as they are, a visitor reads an instruction. Short labels a site may keep (*Find out more*,
 * *Send*) aren't among them.
 */
const STARTER_PROMPTS = [
  "starter.text",
  "starter.heroText",
  "starter.textBody",
  "starter.textImageBody",
  "starter.ctaText",
  "starter.faqAnswer",
  "starter.featureText",
  "starter.columnText",
  "starter.listItem",
  "starter.slideText",
  "starter.tabText",
  "starter.videoText",
  "starter.mapText",
  "starter.planDetails",
  "starter.teamMemberName",
  "starter.teamMemberRole",
  "starter.teamMemberText",
  "starter.testimonialQuote",
  "starter.testimonialName",
  "starter.testimonialRole",
] as const;

/**
 * Text that is still a placeholder: dummy Latin, or a sentence telling the owner what to write
 * (*Say what…*, *Tell visitors…*, *Describe what…*, *Add your…*, *Write something…*), as the
 * starter texts and the Blank template have them. English only, as the templates are.
 */
const PROMPT_START =
  /^(say (what|how|in one|in a)|tell visitors|describe what|add your|write something)\b/i;
const LOREM = /\blorem ipsum\b/i;
/** The domains kept for examples: a link or e-mail address there goes nowhere. */
const EXAMPLE_DOMAIN = /(^|[@./])example\.(com|org|net)(?=$|[/:?#"'\s])/i;

/** Whether `text`, a field's plain text, is placeholder text. */
function isPlaceholderText(text: string, prompts: ReadonlySet<string>): boolean {
  return prompts.has(text) || LOREM.test(text) || PROMPT_START.test(text);
}

/**
 * Whether `text` is still `placed`'s field's default where that default only names the field or
 * the element (a new Heading's *Heading*, a Text's *Text*).
 */
function isNamingDefault(text: string, placed: PlacedValue, catalogue: Catalogue): boolean {
  const component = catalogue[placed.node.type];
  const fallback = component?.defaults[placed.field];
  if (component === undefined || typeof fallback !== "string") return false;
  const named = plainText(fallback);
  return (
    text === named && (named === component.label || named === component.fields[placed.field]?.label)
  );
}

/** Whether `value`, a link field's value, goes to an example domain. */
function isExampleLink(value: unknown): boolean {
  const link = linkValueSchema.safeParse(value);
  if (!link.success) return false;
  if (link.data.kind === "url") return EXAMPLE_DOMAIN.test(link.data.href);
  return link.data.kind === "email" && EXAMPLE_DOMAIN.test(link.data.address);
}

/** Whether rich text's `html` links to an example domain. */
const linksToExample = (html: string) =>
  [...html.matchAll(/href="([^"]*)"/g)].some(([, href = ""]) => EXAMPLE_DOMAIN.test(href));

/**
 * Placeholder text and links (X5): a starter text's instruction, a default naming its field, dummy
 * Latin, or a link to `example.com`. *Should fix*, and *Must fix* to publish; *Ignore* covers a false alarm.
 */
export const placeholdersRule: CheckRule = {
  id: "placeholders",
  level: "should",
  strictOnPublish: true,
  check: (input) => {
    const prompts = new Set(STARTER_PROMPTS.map((key) => plainText(t(key))));
    const found: Finding[] = [];
    eachFieldValue(input, ["text", "richtext", "link"], (placed) => {
      const { value } = placed;
      const text = typeof value === "string" ? plainText(value) : undefined;
      const placeholder =
        text === undefined
          ? isExampleLink(value)
          : isPlaceholderText(text, prompts) ||
            isNamingDefault(text, placed, input.catalogue) ||
            linksToExample(value as string);
      if (placeholder) found.push({ key: fieldKey(placed), place: elementPlace(placed) });
    });
    return found;
  },
};
