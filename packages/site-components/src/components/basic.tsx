import { t } from "@webforge/i18n";
import {
  type ComponentDef,
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

const PADDINGS = ["medium", "small", "large"] as const;
// Design tokens (C4): users choose a size, never a raw value.
const PADDING_CLASS = { small: "py-8", medium: "py-16", large: "py-24" } as const;

/** Space between a section's elements, smallest first (the slider's steps). */
const GAPS = ["none", "small", "medium", "large"] as const;
const GAP_CLASS = {
  none: "space-y-0",
  small: "space-y-3",
  medium: "space-y-6",
  large: "space-y-10",
};

/** Text colours from the site's theme; `default` adds no class. */
const COLOURS = ["default", "primary", "secondary", "accent"] as const;
const COLOUR_CLASS = {
  default: "",
  primary: "text-primary",
  secondary: "text-secondary",
  accent: "text-accent",
} as const;

/** A page band holding elements. Keeps the `site-section` hook for tests and developers. */
export const section: ComponentDef = {
  label: t("section.section"),
  place: "section",
  category: t("category.basic"),
  fields: {
    padding: {
      kind: "spacing",
      label: t("field.padding"),
      responsive: true,
      options: (["small", "medium", "large"] as const).map((value) => ({
        label: t(`field.padding.${value}`),
        value,
      })),
    },
    gap: {
      kind: "slider",
      label: t("field.gap"),
      responsive: true,
      steps: GAPS.map((value) => ({ label: t(`field.gap.${value}`), value })),
    },
    fullWidth: { kind: "toggle", label: t("field.fullWidth"), group: "style" },
    content: {
      kind: "slot",
      label: t("field.content"),
      allow: ["Heading", "Text", "Faq"],
    },
  },
  defaults: { padding: "medium", gap: "medium", fullWidth: false, content: [] },
  render: (props) => {
    const Content = slotComponent(props, "content");
    const padding = responsiveClasses<string>(
      props.values.padding,
      (value) => PADDING_CLASS[optionValue(value, PADDINGS)],
    );
    const gap = responsiveClasses<string>(
      props.values.gap,
      (value) => GAP_CLASS[optionValue(value, ["medium", ...GAPS])],
    );
    const width = props.values.fullWidth === true ? "" : "max-w-4xl ";
    return (
      <section className={`site-section mx-auto ${width}${gap} px-4 ${padding}`}>
        <Content />
      </section>
    );
  },
};

/** A heading; its size also sets the heading level. */
export const heading: ComponentDef = {
  label: t("element.heading"),
  category: t("category.text"),
  fields: {
    text: { kind: "text", label: t("field.text"), inline: true },
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
  },
  defaults: { text: t("element.heading"), size: "medium", color: "default" },
  render: ({ values }) => {
    const size = optionValue(values.size, SIZES);
    const Tag = HEADING_TAG[size];
    const colour = COLOUR_CLASS[optionValue(values.color, COLOURS)];
    return (
      <Tag className={`site-heading ${HEADING_CLASS[size]}${colour === "" ? "" : ` ${colour}`}`}>
        {textValue(values.text)}
      </Tag>
    );
  },
};

/** Formatted text (paragraphs, bold, links, lists). */
export const text: ComponentDef = {
  label: t("element.text"),
  category: t("category.text"),
  fields: {
    text: { kind: "richtext", label: t("field.text"), inline: true },
  },
  defaults: { text: `<p>${t("element.text")}</p>` },
  render: ({ values }) => (
    <div className="site-text text-lg leading-relaxed [&_a]:underline [&_p+p]:mt-4">
      {textValue(values.text)}
    </div>
  ),
};
