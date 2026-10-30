import { t } from "@webforge/i18n";
import { defineComponent } from "../define.js";
import { contentWidthClass, defineSection, MARGIN_FIELD, marginClasses } from "../frame.js";
import { boundText, type ComponentDef, colorClass, responsiveClasses } from "../library.js";
import {
  ENTRANCE_FIELDS,
  entranceAttributes,
  entranceBehaviours,
  entranceClasses,
} from "../motion.js";
import { BODY_TEXT_CLASSES, TITLE_CLASSES } from "../typography.js";

const SIZES = ["large", "medium", "small"] as const;
const HEADING_TAG = { large: "h1", medium: "h2", small: "h3" } as const;
/** A Heading's size, in the catalogue's title sizes (see `typography.tsx`). */
const HEADING_CLASS = {
  large: TITLE_CLASSES.page,
  medium: TITLE_CLASSES.section,
  small: TITLE_CLASSES.small,
} as const;

/** Space between a section's elements, smallest first (the slider's steps). */
const GAPS = ["none", "small", "medium", "large"] as const;
const GAP_CLASS = {
  none: "space-y-0",
  small: "space-y-3",
  medium: "space-y-6",
  large: "space-y-10",
};

/** Text colours from the site's theme; `default` adds no class. */
/** The theme colours a Heading offers first; its field takes any colour ref (1.37, ADR 0009). */
const COLOURS = ["default", "primary", "secondary", "accent"] as const;

/** A page band holding elements. Keeps the `site-section` hook for tests and developers. */
const section = defineSection({
  label: t("section.section"),
  name: "section",
  category: t("category.basic"),
  // No title of its own: no Text controls in its Appearance group (2.22b).
  titled: false,
  fields: {
    gap: {
      kind: "slider",
      label: t("field.gap"),
      responsive: true,
      steps: GAPS.map((value) => ({ label: t(`field.gap.${value}`), value })),
    },
    // Every element, those of families added later too (createLibrary lists them).
    content: { kind: "slot", label: t("field.content"), accepts: "element" },
  },
  // Wide, as Features and the other grids, so a new Section lines up with them (3.21, PF-4).
  // Sections saved before then are Medium (format 10).
  defaults: { gap: "medium", contentWidth: "wide", content: [] },
  // At Medium on the page's colours, the section itself is the 896 px column, padding included, as
  // every Section was before 3.21, so one made then doesn't move. Otherwise (and on reversed
  // colours, 2.4) it is a band across the page, with its column inside it.
  frame: (values) => {
    if (!boxedColumn(values)) return "";
    return `mx-auto max-w-4xl ${responsiveClasses(values.gap, (value) => GAP_CLASS[value])}`;
  },
  render: ({ values, slots }) => {
    const Content = slots.content;
    if (boxedColumn(values)) return <Content />;
    const gap = responsiveClasses(values.gap, (value) => GAP_CLASS[value]);
    return <Content className={`mx-auto ${contentWidthClass(values.contentWidth)} ${gap}`} />;
  },
});

/** Whether a Section is its own column, as before 3.21: at Medium on the page's colours. */
function boxedColumn(values: { readonly contentWidth: string; readonly colors: string }) {
  return values.contentWidth === "medium" && values.colors !== "inverse";
}

/** A heading; its size also sets the heading level. */
const heading = defineComponent({
  label: t("element.heading"),
  category: t("category.text"),
  fields: {
    text: {
      kind: "text",
      label: t("field.text"),
      inline: true,
      bindable: [
        "general.name",
        "contact.businessName",
        "contact.phone",
        "contact.email",
        "contact.address",
        "contact.openingHoursNote",
      ],
    },
    size: {
      kind: "select",
      label: t("field.size"),
      options: SIZES.map((size) => ({ label: t(`field.size.${size}`), value: size })),
    },
    color: {
      kind: "color",
      label: t("field.color"),
      options: COLOURS.map((value) => ({ label: t(`field.color.${value}`), value })),
    },
    margin: MARGIN_FIELD,
    ...ENTRANCE_FIELDS,
  },
  defaults: { text: t("element.heading"), size: "medium", color: "default" },
  behaviours: entranceBehaviours,
  // Its level, which its size sets.
  textStyle: (values) => HEADING_TAG[values.size],
  render: ({ values, context }) => {
    const size = values.size;
    const Tag = HEADING_TAG[size];
    const colour = colorClass("text", values.color);
    const content = boundText(values, "text", context);
    // Bound to an empty Site Settings value in the export: no empty heading.
    if (content === null) return null;
    return (
      <Tag
        className={`site-heading ${HEADING_CLASS[size]}${colour === "" ? "" : ` ${colour}`}${marginClasses(values.margin)}${entranceClasses(values)}`}
        {...entranceAttributes(values)}
      >
        {content}
      </Tag>
    );
  },
});

/** Formatted text (paragraphs, bold, links, lists). */
const text = defineComponent({
  label: t("element.text"),
  category: t("category.text"),
  fields: {
    text: { kind: "richtext", label: t("field.text"), inline: true },
    margin: MARGIN_FIELD,
    ...ENTRANCE_FIELDS,
  },
  defaults: { text: `<p>${t("element.text")}</p>` },
  behaviours: entranceBehaviours,
  textStyle: () => "body",
  render: ({ values }) => (
    <div
      className={`site-text ${BODY_TEXT_CLASSES}${marginClasses(values.margin)}${entranceClasses(values)}`}
      {...entranceAttributes(values)}
    >
      {values.text}
    </div>
  ),
});

/** The basic components: a Section, and the Heading and Text that go in it. */
export const basicComponents: Readonly<Record<string, ComponentDef>> = {
  Section: section,
  Heading: heading,
  Text: text,
};
