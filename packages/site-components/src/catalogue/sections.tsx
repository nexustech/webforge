import { t } from "@webforge/i18n";
import { defineComponent } from "../define.js";
import { boxClasses, type ComponentDef, linkAttributes } from "../library.js";
import { Picture } from "../picture.js";
import { MARGIN_FIELD, marginClasses, PADDING_FIELD, SECTION_PADDING } from "./basic.js";

const ALIGNMENTS = ["centre", "left"] as const;

/** The large opening section of a page: title, short text, a button and an optional image. */
const hero = defineComponent({
  label: t("section.hero"),
  place: "section",
  category: t("category.heroes"),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "text", label: t("field.text"), inline: true },
    buttonLabel: { kind: "text", label: t("field.buttonLabel") },
    buttonLink: { kind: "link", label: t("field.buttonLink") },
    alignment: {
      kind: "select",
      label: t("field.alignment"),
      options: ALIGNMENTS.map((value) => ({ label: t(`field.alignment.${value}`), value })),
    },
    image: { kind: "media", label: t("field.image") },
    padding: PADDING_FIELD,
    margin: MARGIN_FIELD,
  },
  defaults: {
    title: t("starter.heroTitle"),
    text: t("starter.heroText"),
    buttonLabel: t("starter.heroButton"),
    alignment: "centre",
  },
  render: ({ values, context }) => {
    const centred = values.alignment === "centre";
    const placed = values.image;
    const image = placed === undefined ? null : context.image(placed.mediaId);
    const buttonLabel = values.buttonLabel;
    const buttonLink = linkAttributes(values.buttonLink, context);
    return (
      <section
        className={`site-hero hero bg-base-200 ${boxClasses(values.padding, "padding", SECTION_PADDING)}${marginClasses(values.margin)}`}
      >
        <div
          className={`hero-content max-w-6xl flex-col gap-10 lg:flex-row-reverse ${centred ? "text-center" : "text-left"}`}
        >
          {image !== null && (
            <Picture
              image={image}
              alt={placed?.alt ?? image.alt}
              sizes="(min-width: 1024px) 50vw, 100vw"
              eager
              className="h-auto w-full max-w-xl rounded-box shadow-lg"
            />
          )}
          <div className="max-w-xl">
            <h1 className="text-4xl font-bold md:text-5xl">{values.title}</h1>
            <p className="py-6 text-lg">{values.text}</p>
            {buttonLabel !== "" && (
              <a className="btn btn-primary" {...buttonLink}>
                {buttonLabel}
              </a>
            )}
          </div>
        </div>
      </section>
    );
  },
});

/** Questions and answers. Each item is a native `<details>`, so it works without JavaScript. */
const faq = defineComponent({
  label: t("section.faq"),
  place: "section",
  category: t("category.questions"),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    items: { kind: "slot", label: t("field.questions"), allow: ["FaqItem"] },
    margin: MARGIN_FIELD,
  },
  defaults: { title: t("starter.faqTitle"), items: [] },
  render: ({ values, slots }) => {
    const Items = slots.items;
    return (
      <div className={`site-faq space-y-4${marginClasses(values.margin)}`}>
        <h2 className="text-3xl font-bold">{values.title}</h2>
        <div className="space-y-2">
          <Items />
        </div>
      </div>
    );
  },
});

/** One question of an FAQ. */
const faqItem = defineComponent({
  label: t("element.faqItem"),
  place: "child",
  fields: {
    question: { kind: "text", label: t("field.question"), inline: true },
    answer: { kind: "richtext", label: t("field.answer"), inline: true },
  },
  defaults: { question: t("starter.faqQuestion"), answer: `<p>${t("starter.faqAnswer")}</p>` },
  render: ({ values }) => (
    <details className="site-faq-item collapse-arrow collapse border border-base-300 bg-base-100">
      <summary className="collapse-title font-semibold">{values.question}</summary>
      <div className="collapse-content [&_p+p]:mt-2">{values.answer}</div>
    </details>
  ),
});

/** Ready-made sections: a Hero, and an FAQ with its questions. */
export const sectionsComponents: Readonly<Record<string, ComponentDef>> = {
  Hero: hero,
  Faq: faq,
  FaqItem: faqItem,
};
