import { t } from "@webforge/i18n";
import {
  altTextFor,
  eachElement,
  eachLink,
  findBrokenLinks,
  imageValueSchema,
  isDraftPage,
  linkValueSchema,
  mediaItem,
  publishedSite,
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
import type { CheckRule, Finding, FindingPlace } from "../types.js";

/**
 * Links to a page, a section, a document or a Blog's list (#940) that isn't there any more (F-ED-18): *Should fix*, and
 * *Must fix* to publish (X5). Links in hidden elements aren't exported, so they don't count, nor do
 * those on a draft page. A draft page is there: links to it are {@link draftLinksRule}'s.
 */
export const brokenLinksRule: CheckRule = {
  id: "brokenLinks",
  level: "should",
  strictOnPublish: true,
  drafts: true,
  check: ({ site }) => {
    const exported = exportedPlaces(publishedSite(site));
    return findBrokenLinks(site, { skipHidden: true })
      .filter((link) => exported(link.on))
      .map((link) => ({
        key: `${link.on}/${link.nodeId}/${
          "mediaId" in link
            ? link.mediaId
            : "collectionId" in link
              ? `list:${link.collectionId}`
              : `${link.pageId}#${link.anchor ?? ""}`
        }`,
        place:
          link.on === "menu"
            ? { kind: "menu", itemId: link.nodeId }
            : { kind: "element", on: link.on, nodeId: link.nodeId },
      }));
  },
};

/**
 * Links on the published site to a draft page (G37, #864): the export leaves them out, as the page
 * isn't published. *Should fix*, and *Must fix* to publish, as a broken link is. A menu item for a
 * draft page isn't one: the menu leaves it out until the page is published, as it should.
 */
export const draftLinksRule: CheckRule = {
  id: "draftLinks",
  level: "should",
  strictOnPublish: true,
  drafts: true,
  check: ({ site }) => {
    const published = publishedSite(site);
    // A site without drafts, as most are, has no link to one: no walk of its links for it.
    if (published === site) return [];
    const exported = exportedPlaces(published);
    const found: Finding[] = [];
    eachLink(
      site,
      (on, nodeId, link) => {
        if (on === "menu" || link.kind !== "page" || !exported(on)) return;
        const page = site.pages[link.pageId];
        if (page === undefined || !isDraftPage(site, page)) return;
        found.push({
          key: `${on}/${nodeId}/${link.pageId}#${link.anchor ?? ""}`,
          place: { kind: "element", on, nodeId },
          values: { pageId: link.pageId, draftPage: page.title },
        });
      },
      { skipHidden: true },
    );
    return found;
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
 * A section's background image (2.26): drawn behind its content, so decorative, with no alt text.
 * The library knows it by this name too (`fieldsHiddenBy`).
 */
const BACKGROUND_IMAGE_FIELD = "backgroundImage";

/**
 * An image without alt text, its own or the placement's (G15): screen readers and search engines
 * need it, and an image link has no other text. A section's background image needs none.
 */
export const altTextRule: CheckRule = {
  id: "altText",
  level: "should",
  check: (input) => {
    const found: Finding[] = [];
    eachFieldValue(input, ["media"], (placed) => {
      if (placed.field === BACKGROUND_IMAGE_FIELD) return;
      const image = imageValueSchema.safeParse(placed.value);
      if (!image.success) return;
      const meta = mediaItem(input.site.media, image.data.mediaId);
      if (meta?.kind !== "image") return;
      if (altTextFor(image.data, meta).trim() === "") {
        found.push({
          key: fieldKey(placed),
          place: elementPlace(placed),
          // The image, for the assistant to write its alt text from its name (#873).
          values: { image: meta.fileName, mediaId: image.data.mediaId },
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
  // The note to the owner opening the Privacy, Terms and Cookies pages (#855, #866): left in,
  // visitors read that it isn't legal advice.
  "legalPage.note",
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

/** The catalogue's defaults as plain text, each made once: they never change while it runs. */
const DEFAULT_TEXTS = new Map<string, string>();
function defaultText(fallback: string): string {
  let text = DEFAULT_TEXTS.get(fallback);
  if (text === undefined) {
    text = plainText(fallback);
    DEFAULT_TEXTS.set(fallback, text);
  }
  return text;
}

/**
 * Whether `text` is still `placed`'s field's default where that default only names the field or
 * the element (a new Heading's *Heading*, a Text's *Text*).
 */
function isNamingDefault(text: string, placed: PlacedValue, catalogue: Catalogue): boolean {
  const component = catalogue[placed.node.type];
  const fallback = component?.defaults[placed.field];
  if (component === undefined || typeof fallback !== "string") return false;
  const named = defaultText(fallback);
  return (
    text === named && (named === component.label || named === component.fields[placed.field]?.label)
  );
}

/** Whether `value`, a link field's value, goes to an example domain. */
function isExampleLink(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const link = linkValueSchema.safeParse(value);
  if (!link.success) return false;
  if (link.data.kind === "url") return EXAMPLE_DOMAIN.test(link.data.href);
  return link.data.kind === "email" && EXAMPLE_DOMAIN.test(link.data.address);
}

/** Whether rich text's `html` links to an example domain. */
const linksToExample = (html: string) =>
  html.includes("href=") &&
  [...html.matchAll(/href="([^"]*)"/g)].some(([, href = ""]) => EXAMPLE_DOMAIN.test(href));

/** `{year}`, as the export fills it in (`@webforge/pipeline`'s `withYear`): any case. */
const YEAR_TOKEN = /\{year\}/i;

/**
 * A `<script>` or `<style>` element, which the export leaves as written: the same pattern as
 * `withYear`'s in `@webforge/pipeline` (`site-files.ts`), which this package can't import. Keep
 * them alike.
 */
const SCRIPT_OR_STYLE = /<(script|style)\b[\s\S]*?<\/\1\s*>/gi;

/** Whether the export fills in `{year}` in `html`: anywhere but in its scripts and styles. */
const showsYear = (html: string) => YEAR_TOKEN.test(html.replace(SCRIPT_OR_STYLE, ""));

/** The parts of Settings' Custom Code that go into every page's HTML. */
const PAGE_CODE_PARTS = ["head", "bodyEnd"] as const;

/**
 * The year a published site shows is out of date (F-CM-8): the export fills `{year}` in with the
 * year it's built in, anywhere in a page's HTML but its scripts and styles, and the site was last
 * published in an earlier year. A tip to publish again, at the first place that has it: an
 * element's text or Custom Code, then Settings' Custom Code, then a page's title or description.
 * Ignoring it lasts until the next year.
 */
export const outdatedYearRule: CheckRule = {
  id: "outdatedYear",
  level: "tip",
  check: (input) => {
    const { published, site } = input;
    if (published === undefined || published.year >= published.thisYear) return [];
    const using: PlacedValue[] = [];
    eachFieldValue(input, ["text", "richtext", "code"], (placed) => {
      if (typeof placed.value === "string" && showsYear(placed.value)) using.push(placed);
    });
    const [element] = using;
    const part = PAGE_CODE_PARTS.find((each) => showsYear(site.code?.[each] ?? ""));
    const page = Object.values(site.pages).find(
      ({ title, settings }) =>
        YEAR_TOKEN.test(title) || YEAR_TOKEN.test(settings.description ?? ""),
    );
    const place: FindingPlace | undefined =
      element !== undefined
        ? elementPlace(element)
        : part !== undefined
          ? { kind: "code", part }
          : page !== undefined
            ? { kind: "page", pageId: page.id }
            : undefined;
    return place === undefined
      ? []
      : [
          {
            key: `${published.year}/${published.thisYear}`,
            place,
            values: { publishedYear: published.year },
          },
        ];
  },
};
/** The Announcement bar (6.4), by its type: this package reads the components as data. */
const ANNOUNCEMENT_BAR = "AnnouncementBar";
/** A date field's value: `YYYY-MM-DD`. */
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * An Announcement bar past its last day (6.4): the export still writes it, and its script hides
 * it only once the page is drawn, so visitors see it for a moment on every page. A tip to delete
 * it, at each one. Its key has the last day, so a new last day asks again.
 */
export const pastAnnouncementRule: CheckRule = {
  id: "pastAnnouncement",
  level: "tip",
  check: ({ site, today }) => {
    if (today === undefined) return [];
    const exported = exportedPlaces(site);
    const found: Finding[] = [];
    eachElement(
      site,
      (node, on) => {
        if (node.type !== ANNOUNCEMENT_BAR || !exported(on)) return;
        const { lastDay } = node.props;
        if (typeof lastDay === "string" && DATE.test(lastDay) && lastDay < today) {
          found.push({
            key: `${on}/${node.props.id}/${lastDay}`,
            place: elementPlace({ on, node }),
          });
        }
      },
      { skipHidden: true },
    );
    return found;
  },
};

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
