import {
  type ComponentLibrary,
  optionValue,
  type PageDoc,
  slotComponent,
  textValue,
} from "@webforge/engine";
import { t } from "@webforge/i18n";

const SIZES = ["large", "medium", "small"] as const;
const HEADING_TAG = { large: "h1", medium: "h2", small: "h3" } as const;

/**
 * The Phase 0 spike's components: one section and two elements. The real catalogue lives in
 * `@webforge/site-components` (daisyUI markup) from Phase 1.
 */
export const spikeLibrary: ComponentLibrary = {
  components: {
    Section: {
      label: t("section.section"),
      fields: {
        content: { kind: "slot", label: t("field.content"), allow: ["Heading", "Text"] },
      },
      defaults: { content: [] },
      render: (props) => {
        const Content = slotComponent(props, "content");
        return (
          <section className="site-section">
            <Content />
          </section>
        );
      },
    },
    Heading: {
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
        const Tag = HEADING_TAG[optionValue(values.size, SIZES)];
        return <Tag className="site-heading">{textValue(values.text)}</Tag>;
      },
    },
    Text: {
      label: t("element.text"),
      fields: {
        text: { kind: "richtext", label: t("field.text"), inline: true },
      },
      defaults: { text: `<p>${t("element.text")}</p>` },
      render: ({ values }) => <div className="site-text">{textValue(values.text)}</div>,
    },
  },
};

/** The page a new spike session starts with. */
export function starterPage(): PageDoc {
  return {
    root: { props: {} },
    content: [
      {
        type: "Section",
        props: {
          id: "section-1",
          content: [
            {
              type: "Heading",
              props: { id: "heading-1", text: t("starter.heading"), size: "large" },
            },
            { type: "Text", props: { id: "text-1", text: `<p>${t("starter.text")}</p>` } },
          ],
        },
      },
    ],
  };
}
