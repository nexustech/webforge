import { t } from "@webforge/i18n/components";
import {
  altTextFor,
  eachElement,
  eachLink,
  exampleKey,
  factDetailsIn,
  findBrokenLinks,
  hasLink,
  imageValueSchema,
  isDraftPage,
  isExample,
  isSampleEmail,
  isSamplePhone,
  linkValueSchema,
  mayHoldSampleDetail,
  mediaItem,
  type NodeDoc,
  publishedSite,
  sampleDetailsIn,
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
 * Buttons with text and no link (#1256): a Hero's, a Call to action's, a Button or a pricing plan's,
 * each a link field naming the text field that labels it (`button`). The export leaves such a
 * button out, as a Buy button with no payment link. *Should fix* on export and publish alike, so it
 * never blocks publishing (product owner, 21 Nov 2026). Jumping to it selects the element, with its
 * link in the Edit panel.
 */
export const buttonLinksRule: CheckRule = {
  id: "buttonLinks",
  level: "should",
  check: (input) => {
    const found: Finding[] = [];
    eachFieldValue(input, ["text"], (placed) => {
      const component = input.catalogue[placed.node.type];
      if (component === undefined) return;
      const link = Object.entries(component.fields).find(
        ([, field]) => field.kind === "link" && field.button === placed.field,
      )?.[0];
      if (link === undefined || typeof placed.value !== "string") return;
      if (plainText(placed.value).trim() === "" || hasLink(placed.node.props[link])) return;
      found.push({ key: fieldKey({ ...placed, field: link }), place: elementPlace(placed) });
    });
    return found;
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
      // A text marked as an example is {@link sampleDetailsRule}'s: reported once (#1228).
      if (typeof value === "string" && isMarked(placed.node, placed.field)) return;
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

/**
 * Whether `html`, a text or rich text field's value, holds a made-up email address or phone
 * number. With an email link to an example domain, which is {@link placeholdersRule}'s, only a
 * sample phone beside it counts: never one finding twice, and never one hidden by the other.
 */
function holdsSampleDetail(html: string): boolean {
  const found = sampleDetailsIn(plainText(html));
  return linksToExample(html) ? found.some((detail) => !detail.includes("@")) : found.length > 0;
}

/** Whether `field` of `node`, as Site Check names it (`items.2.text`), is marked as an example. */
const isMarked = (node: NodeDoc, field: string) =>
  isExample(node.props, exampleKey(node.props, field));

/** Whether `value`, a link field's value, rings a phone number kept for drama and examples. */
function isSamplePhoneLink(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const link = linkValueSchema.safeParse(value);
  return link.success && link.data.kind === "phone" && isSamplePhone(link.data.number);
}

/**
 * Made-up contact details (#1254): an email address at a domain kept for examples, or a phone
 * number kept for drama and examples, as a template's samples are. In Site Settings' email or
 * phone, an element's text, or a link that rings it, one finding a place; a field bound to Site
 * Settings is found there. Email links to an example domain are {@link placeholdersRule}'s. *Should
 * fix*, and *Must fix* to publish: a published site would give it as the business's own.
 *
 * And every text marked as holding an example (#1228, WN-3): a detail a generated text made up,
 * or a template's sample testimonial, until the person edits it or says it's correct. Each element
 * is found once, however many of its texts are marked, naming the first detail in them that looks
 * like a fact, and never as a placeholder too.
 */
export const sampleDetailsRule: CheckRule = {
  id: "sampleDetails",
  level: "should",
  strictOnPublish: true,
  check: (input) => {
    const found: Finding[] = [];
    const { contact } = input.site.settings;
    if (contact.email !== undefined && isSampleEmail(contact.email)) {
      found.push({ key: "contact.email", place: { kind: "contact", field: "email" } });
    }
    if (contact.phone !== undefined && isSamplePhone(contact.phone)) {
      found.push({ key: "contact.phone", place: { kind: "contact", field: "phone" } });
    }
    // The finding of each element with a text marked as an example, by its place and id.
    const markedAt = new Map<string, number>();
    eachFieldValue(input, ["text", "richtext", "link"], (placed) => {
      const { node, field, value } = placed;
      const bindings = node.props.bindings;
      if (typeof bindings === "object" && bindings !== null && field in bindings) return;
      if (typeof value === "string" && isMarked(node, field)) {
        // One finding an element, however many of its texts are marked (a testimonial's quote,
        // name and role), named by the first detail of any of them.
        const [detail] = factDetailsIn(plainText(value));
        const at = `${placed.on}/${node.props.id}`;
        const index = markedAt.get(at);
        const named = detail === undefined ? {} : { values: { example: detail.text } };
        if (index === undefined) {
          markedAt.set(at, found.length);
          found.push({ key: fieldKey(placed), place: elementPlace(placed), ...named });
        } else if (detail !== undefined && found[index]?.values === undefined) {
          const first = found[index];
          if (first !== undefined) found[index] = { ...first, ...named };
        }
        return;
      }
      // Most text has no `@` and no digits: passed over before it's made plain (ADR 0016).
      const sample =
        typeof value === "string"
          ? mayHoldSampleDetail(value) && holdsSampleDetail(value)
          : isSamplePhoneLink(value);
      if (sample) found.push({ key: fieldKey(placed), place: elementPlace(placed) });
    });
    return found;
  },
};
