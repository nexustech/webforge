import { t } from "@webforge/i18n";
import { defineComponent } from "../define.js";
import {
  boundText,
  boxClasses,
  type ComponentDef,
  colorClass,
  type FieldDef,
  optionValue,
  responsiveClasses,
  slotComponent,
  textValue,
} from "../library.js";

const SIZES = ["large", "medium", "small"] as const;
const HEADING_TAG = { large: "h1", medium: "h2", small: "h3" } as const;
const HEADING_CLASS = {
  large: "text-4xl font-bold md:text-5xl",
  medium: "text-3xl font-bold",
  small: "text-xl font-semibold",
} as const;

/** A section's own padding (`px-4 py-16`), for the sides left unset (1.32). */
export const SECTION_PADDING = { top: 16, right: 4, bottom: 16, left: 4 } as const;

/** A section's padding, per side and device (1.32). */
export const PADDING_FIELD: FieldDef = {
  kind: "box",
  label: t("field.padding"),
  property: "padding",
  responsive: true,
};

/**
 * A margin above and below, per device (1.32). A section's left and right stay `auto`, centring
 * it, and an element's are its section's padding.
 */
export const MARGIN_FIELD: FieldDef = {
  kind: "box",
  label: t("field.margin"),
  property: "margin",
  responsive: true,
  sides: ["top", "bottom"],
};

/** The margin classes of a {@link MARGIN_FIELD} value, after a space; nothing when unset. */
export function marginClasses(value: unknown): string {
  const classes = boxClasses(value, "margin", {}, ["top", "bottom"]);
  return classes === "" ? "" : ` ${classes}`;
}

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
const section = defineComponent({
  label: t("section.section"),
  place: "section",
  category: t("category.basic"),
  fields: {
    padding: PADDING_FIELD,
    margin: MARGIN_FIELD,
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
  render: (props) => {
    const Content = slotComponent(props, "content");
    const padding = boxClasses(props.values.padding, "padding", SECTION_PADDING);
    const gap = responsiveClasses<string>(
      props.values.gap,
      (value) => GAP_CLASS[optionValue(value, ["medium", ...GAPS])],
    );
    const width = props.values.fullWidth === true ? "" : "max-w-4xl ";
    return (
      <section
        className={`site-section mx-auto ${width}${gap} ${padding}${marginClasses(props.values.margin)}`}
      >
        <Content />
      </section>
    );
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
  textStyle: (values) => HEADING_TAG[optionValue(values.size, SIZES)],
  render: ({ values, context }) => {
    const size = optionValue(values.size, SIZES);
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
    <div
      className={`site-text text-lg leading-relaxed [&_a]:underline [&_p+p]:mt-4${marginClasses(values.margin)}`}
    >
      {textValue(values.text)}
    </div>
  ),
});

/** The basic components: a Section, and the Heading and Text that go in it. */
export const basicComponents: Readonly<Record<string, ComponentDef>> = {
  Section: section,
  Heading: heading,
  Text: text,
};
