import { t } from "@webforge/i18n";
import { defineComponent } from "../define.js";
import { boxClasses, type ComponentDef, linkAttributes } from "../library.js";
import { Picture } from "../picture.js";
import type { RenderContext } from "../schema.js";
import { MARGIN_FIELD, marginClasses, PADDING_FIELD, SECTION_PADDING } from "./basic.js";

const ALIGNMENTS = ["centre", "left"] as const;
const HERO_LAYOUTS = ["split", "centred", "background", "minimal"] as const;
const TEXT_IMAGE_LAYOUTS = ["imageRight", "imageLeft"] as const;
const CTA_LAYOUTS = ["banner", "split"] as const;

/** A section's own padding and margin classes, its padding from {@link SECTION_PADDING}. */
const sectionBox = (values: { readonly padding?: unknown; readonly margin?: unknown }) =>
  `${boxClasses(values.padding, "padding", SECTION_PADDING)}${marginClasses(values.margin)}`;

/** A section's button, if it has a label: a link styled as a button. */
function SectionButton({
  label,
  link,
  context,
  className,
}: {
  readonly label: string;
  readonly link: unknown;
  readonly context: RenderContext;
  readonly className: string;
}) {
  if (label === "") return null;
  return (
    <a className={className} {...linkAttributes(link, context)}>
      {label}
    </a>
  );
}

/**
 * The large opening section of a page: title, short text, a button and an image, in one of four
 * layouts (2.6): the image beside the text (the first, as Heroes were before), the text centred
 * with the image below, the image behind the text (its focal point kept in view), or text only.
 */
const hero = defineComponent({
  label: t("section.hero"),
  place: "section",
  category: t("category.heroes"),
  variants: HERO_LAYOUTS.map((value) => ({ label: t(`field.heroLayout.${value}`), value })),
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
    const layout = values.variant;
    const aligned =
      values.alignment === "centre" || layout === "centred" ? "text-center" : "text-left";
    const placed = layout === "minimal" ? undefined : values.image;
    const image = placed === undefined ? null : context.image(placed.mediaId);
    const alt = placed?.alt ?? image?.alt ?? "";
    const copy = (
      <div className={layout === "centred" ? "mx-auto max-w-2xl" : "max-w-xl"}>
        <h1 className="text-4xl font-bold md:text-5xl">{values.title}</h1>
        <p className="py-6 text-lg">{values.text}</p>
        <SectionButton
          label={values.buttonLabel}
          link={values.buttonLink}
          context={context}
          className="btn btn-primary"
        />
      </div>
    );
    if (layout === "background") {
      // The image fills the whole section, its padding too, behind a dark overlay; the text is set
      // on the overlay. Not daisyUI's `hero` grid, whose grid areas would keep the overlay inside
      // the padding.
      return (
        <section
          className={`site-hero relative flex min-h-[28rem] items-center justify-center overflow-hidden bg-neutral ${sectionBox(values)}`}
        >
          {image !== null && (
            <Picture
              image={image}
              alt={alt}
              sizes="100vw"
              eager
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-neutral/70" />
          <div className={`hero-content relative max-w-6xl text-neutral-content ${aligned}`}>
            {copy}
          </div>
        </section>
      );
    }
    if (layout === "minimal") {
      return (
        <section className={`site-hero bg-base-200 ${sectionBox(values)}`}>
          <div className={`mx-auto max-w-3xl ${aligned}`}>{copy}</div>
        </section>
      );
    }
    const centred = layout === "centred";
    return (
      <section className={`site-hero hero bg-base-200 ${sectionBox(values)}`}>
        <div
          className={`hero-content ${centred ? "max-w-4xl flex-col gap-10" : "max-w-6xl flex-col gap-10 lg:flex-row-reverse"} ${aligned}`}
        >
          {centred ? copy : null}
          {image !== null && (
            <Picture
              image={image}
              alt={alt}
              sizes={
                centred ? "(min-width: 896px) 896px, 100vw" : "(min-width: 1024px) 50vw, 100vw"
              }
              eager
              className={
                centred
                  ? "h-auto w-full rounded-box shadow-lg"
                  : "h-auto w-full max-w-xl rounded-box shadow-lg"
              }
            />
          )}
          {centred ? null : copy}
        </div>
      </section>
    );
  },
});

/** A section of text: a title and formatted text, set in a readable column. */
const textSection = defineComponent({
  label: t("section.text"),
  place: "section",
  category: t("category.text"),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "richtext", label: t("field.text"), inline: true },
    padding: PADDING_FIELD,
    margin: MARGIN_FIELD,
  },
  defaults: { title: t("starter.textTitle"), text: `<p>${t("starter.textBody")}</p>` },
  render: ({ values }) => (
    <section className={`site-text-section bg-base-100 ${sectionBox(values)}`}>
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-bold">{values.title}</h2>
        <div className="mt-4 text-lg leading-relaxed [&_a]:underline [&_p+p]:mt-4">
          {values.text}
        </div>
      </div>
    </section>
  ),
});

/** Text beside an image, the image on the right or the left (2.6). */
const textImage = defineComponent({
  label: t("section.textImage"),
  place: "section",
  category: t("category.text"),
  variants: TEXT_IMAGE_LAYOUTS.map((value) => ({
    label: t(`field.textImageLayout.${value}`),
    value,
  })),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "richtext", label: t("field.text"), inline: true },
    image: { kind: "media", label: t("field.image") },
    padding: PADDING_FIELD,
    margin: MARGIN_FIELD,
  },
  defaults: { title: t("starter.textImageTitle"), text: `<p>${t("starter.textImageBody")}</p>` },
  render: ({ values, context }) => {
    const placed = values.image;
    const image = placed === undefined ? null : context.image(placed.mediaId);
    return (
      <section className={`site-text-image bg-base-100 ${sectionBox(values)}`}>
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
          {/* The text comes first, as it is read; on wide screens CSS puts the image left. */}
          <div>
            <h2 className="text-3xl font-bold">{values.title}</h2>
            <div className="mt-4 text-lg leading-relaxed [&_a]:underline [&_p+p]:mt-4">
              {values.text}
            </div>
          </div>
          {image !== null && (
            <div className={values.variant === "imageLeft" ? "md:order-first" : undefined}>
              <Picture
                image={image}
                alt={placed?.alt ?? image.alt}
                sizes="(min-width: 768px) 50vw, 100vw"
                className="h-auto w-full rounded-box shadow-lg"
              />
            </div>
          )}
        </div>
      </section>
    );
  },
});

/**
 * Asks visitors to do one thing, with a button: a centred banner in the theme's dark colour (whose
 * text every theme keeps readable, unlike its main colour's), or the text with the button beside
 * it (2.6).
 */
const callToAction = defineComponent({
  label: t("section.callToAction"),
  place: "section",
  category: t("category.callToAction"),
  variants: CTA_LAYOUTS.map((value) => ({ label: t(`field.ctaLayout.${value}`), value })),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "text", label: t("field.text"), inline: true },
    buttonLabel: { kind: "text", label: t("field.buttonLabel") },
    buttonLink: { kind: "link", label: t("field.buttonLink") },
    padding: PADDING_FIELD,
    margin: MARGIN_FIELD,
  },
  defaults: {
    title: t("starter.ctaTitle"),
    text: t("starter.ctaText"),
    buttonLabel: t("starter.ctaButton"),
  },
  render: ({ values, context }) => {
    const banner = values.variant === "banner";
    return (
      <section
        className={`site-cta ${banner ? "bg-neutral text-neutral-content" : "bg-base-200"} ${sectionBox(values)}`}
      >
        <div
          className={
            banner
              ? "mx-auto max-w-3xl text-center"
              : "mx-auto flex max-w-6xl flex-col items-start gap-6 md:flex-row md:items-center md:justify-between"
          }
        >
          <div>
            <h2 className="text-3xl font-bold">{values.title}</h2>
            <p className="mt-4 text-lg">{values.text}</p>
          </div>
          <SectionButton
            label={values.buttonLabel}
            link={values.buttonLink}
            context={context}
            className={banner ? "btn btn-primary btn-lg mt-8" : "btn btn-primary btn-lg shrink-0"}
          />
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

/** Ready-made sections: a Hero, Text, Text + Image, a Call to action, and an FAQ. */
export const sectionsComponents: Readonly<Record<string, ComponentDef>> = {
  Hero: hero,
  TextSection: textSection,
  TextImage: textImage,
  CallToAction: callToAction,
  Faq: faq,
  FaqItem: faqItem,
};
