import { t } from "@webforge/i18n";
import { defineComponent } from "../define.js";
import { defineSection, MARGIN_FIELD, marginClasses } from "../frame.js";
import { boundText, type ComponentDef, colorClass, responsiveClasses } from "../library.js";
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
  fields: {
    gap: {
      kind: "slider",
      label: t("field.gap"),
      responsive: true,
      steps: GAPS.map((value) => ({ label: t(`field.gap.${value}`), value })),
    },
    fullWidth: { kind: "toggle", label: t("field.fullWidth"), group: "style" },
    // Every element, those of families added later too (createLibrary lists them).
    content: { kind: "slot", label: t("field.content"), accepts: "element" },
  },
  defaults: { gap: "medium", fullWidth: false, content: [] },
  frame: (values) => {
    const gap = responsiveClasses(values.gap, (value) => GAP_CLASS[value]);
    return values.fullWidth ? `mx-auto ${gap}` : `mx-auto max-w-4xl ${gap}`;
  },
  render: ({ slots }) => {
    const Content = slots.content;
    return <Content />;
  },
});

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
  },
  defaults: { text: t("element.heading"), size: "medium", color: "default" },
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
        className={`site-heading ${HEADING_CLASS[size]}${colour === "" ? "" : ` ${colour}`}${marginClasses(values.margin)}`}
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
  },
  defaults: { text: `<p>${t("element.text")}</p>` },
  textStyle: () => "body",
  render: ({ values }) => (
    <div className={`site-text ${BODY_TEXT_CLASSES}${marginClasses(values.margin)}`}>
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
