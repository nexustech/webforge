import { t } from "@webforge/i18n";
import { type ComponentDef, optionValue, slotComponent, textValue } from "../library.js";

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

/** A page band holding elements. Keeps the `site-section` hook for tests and developers. */
export const section: ComponentDef = {
  label: t("section.section"),
  fields: {
    padding: {
      kind: "select",
      label: t("field.padding"),
      options: PADDINGS.map((value) => ({ label: t(`field.padding.${value}`), value })),
    },
    content: {
      kind: "slot",
      label: t("field.content"),
      allow: ["Heading", "Text", "Faq"],
    },
  },
  defaults: { padding: "medium", content: [] },
  render: (props) => {
    const Content = slotComponent(props, "content");
    const padding = PADDING_CLASS[optionValue(props.values.padding, PADDINGS)];
    return (
      <section className={`site-section mx-auto max-w-4xl space-y-6 px-4 ${padding}`}>
        <Content />
      </section>
    );
  },
};

/** A heading; its size also sets the heading level. */
export const heading: ComponentDef = {
  label: t("element.heading"),
  fields: {
    text: { kind: "text", label: t("field.text"), inline: true },
    size: {
      kind: "select",
      label: t("field.size"),
      options: SIZES.map((size) => ({ label: t(`field.size.${size}`), value: size })),
    },
  },
  defaults: { text: t("element.heading"), size: "medium" },
  render: ({ values }) => {
    const size = optionValue(values.size, SIZES);
    const Tag = HEADING_TAG[size];
    return <Tag className={`site-heading ${HEADING_CLASS[size]}`}>{textValue(values.text)}</Tag>;
  },
};

/** Formatted text (paragraphs, bold, links, lists). */
export const text: ComponentDef = {
  label: t("element.text"),
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
