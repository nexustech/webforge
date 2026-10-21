import { t } from "@webforge/i18n";
import { imageValueSchema } from "@webforge/model";
import {
  type ComponentDef,
  linkAttributes,
  optionValue,
  slotComponent,
  textValue,
} from "../library.js";
import { Picture } from "../picture.js";

const ALIGNMENTS = ["centre", "left"] as const;

/** The large opening section of a page: title, short text, a button and an optional image. */
export const hero: ComponentDef = {
  label: t("section.hero"),
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
  },
  defaults: {
    title: t("starter.heroTitle"),
    text: t("starter.heroText"),
    buttonLabel: t("starter.heroButton"),
    alignment: "centre",
  },
  render: ({ values, context }) => {
    const centred = optionValue(values.alignment, ALIGNMENTS) === "centre";
    const placed = imageValueSchema.safeParse(values.image);
    const image = placed.success ? context.image(placed.data.mediaId) : null;
    const buttonLabel = textValue(values.buttonLabel);
    const buttonLink = linkAttributes(values.buttonLink, context);
    return (
      <section className="site-hero hero bg-base-200 px-4 py-16">
        <div
          className={`hero-content max-w-6xl flex-col gap-10 lg:flex-row-reverse ${centred ? "text-center" : "text-left"}`}
        >
          {image !== null && (
            <Picture
              image={image}
              alt={placed.data?.alt ?? image.alt}
              sizes="(min-width: 1024px) 50vw, 100vw"
              eager
              className="h-auto w-full max-w-xl rounded-box shadow-lg"
            />
          )}
          <div className="max-w-xl">
            <h1 className="text-4xl font-bold md:text-5xl">{textValue(values.title)}</h1>
            <p className="py-6 text-lg">{textValue(values.text)}</p>
            {buttonLabel !== null && buttonLabel !== "" && (
              <a className="btn btn-primary" {...buttonLink}>
                {buttonLabel}
              </a>
            )}
          </div>
        </div>
      </section>
    );
  },
};

/** Questions and answers. Each item is a native `<details>`, so it works without JavaScript. */
export const faq: ComponentDef = {
  label: t("section.faq"),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    items: { kind: "slot", label: t("field.questions"), allow: ["FaqItem"] },
  },
  defaults: { title: t("starter.faqTitle"), items: [] },
  render: (props) => {
    const Items = slotComponent(props, "items");
    return (
      <div className="site-faq space-y-4">
        <h2 className="text-3xl font-bold">{textValue(props.values.title)}</h2>
        <div className="space-y-2">
          <Items />
        </div>
      </div>
    );
  },
};

/** One question of an FAQ. */
export const faqItem: ComponentDef = {
  label: t("element.faqItem"),
  fields: {
    question: { kind: "text", label: t("field.question"), inline: true },
    answer: { kind: "richtext", label: t("field.answer"), inline: true },
  },
  defaults: { question: t("starter.faqQuestion"), answer: `<p>${t("starter.faqAnswer")}</p>` },
  render: ({ values }) => (
    <details className="site-faq-item collapse-arrow collapse border border-base-300 bg-base-100">
      <summary className="collapse-title font-semibold">{textValue(values.question)}</summary>
      <div className="collapse-content [&_p+p]:mt-2">{textValue(values.answer)}</div>
    </details>
  ),
};
