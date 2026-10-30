import { t } from "@webforge/i18n";
import { createContext, type ReactNode, useContext } from "react";
import { defineComponent } from "../define.js";
import {
  CONTENT_WIDTH_PX,
  contentWidthClass,
  defineSection,
  FULL_WIDTH_IMAGE_PX,
  narrowerWidth,
} from "../frame.js";
import type { ComponentDef } from "../library.js";
import { Picture } from "../picture.js";
import {
  BodyText,
  ButtonLink,
  RICH_TEXT_LIST_CLASSES,
  SectionIntro,
  SectionLead,
  SectionTitle,
} from "../typography.js";

const ALIGNMENTS = ["centre", "left"] as const;
const HERO_LAYOUTS = ["split", "centred", "background", "minimal"] as const;
const TEXT_IMAGE_LAYOUTS = ["imageRight", "imageLeft"] as const;
const CTA_LAYOUTS = ["banner", "split"] as const;
const FAQ_LAYOUTS = ["accordion", "columns", "open"] as const;
type FaqLayout = (typeof FAQ_LAYOUTS)[number];

/** The layout of the FAQ a question is in, which draws it: to open, or open already. */
const FaqLayoutContext = createContext<FaqLayout>("accordion");

/**
 * The large opening section of a page: title, short text, a button and an image, in one of four
 * layouts (2.6): the image beside the text (the first, as Heroes were before), the text centred
 * with the image below, the image behind the text (its focal point kept in view), or text only.
 */
const hero = defineSection({
  label: t("section.hero"),
  name: "hero",
  // Its image field draws its own background, behind the text, with its own overlay.
  background: false,
  category: t("category.heroes"),
  variants: HERO_LAYOUTS.map((value) => ({
    label: t(`field.heroLayout.${value}`),
    value,
    // Text only has no image; centred is always centred (#311).
    ...(value === "minimal" ? { hides: ["image"] as const } : {}),
    ...(value === "centred" ? { hides: ["alignment"] as const } : {}),
  })),
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
  // Its layouts' widths before 3.21 were Wide, Medium (centred) and Narrow (text only); format 10
  // keeps those saved then.
  defaults: {
    title: t("starter.heroTitle"),
    text: t("starter.heroText"),
    buttonLabel: t("starter.heroButton"),
    alignment: "centre",
    contentWidth: "wide",
  },
  // The image behind the text fills the whole section, its padding too, behind a dark overlay. It
  // doesn't use daisyUI's `hero` grid, whose grid areas would keep the overlay inside the padding.
  frame: (values) =>
    values.variant === "background"
      ? "relative flex min-h-[28rem] items-center justify-center overflow-hidden bg-neutral"
      : values.variant === "minimal"
        ? "bg-base-200"
        : "hero bg-base-200",
  render: ({ id, values, context }) => {
    const layout = values.variant;
    // Its image is the page's first picture when it is the page's first section (3.15, SEO-4).
    const first = id === context.firstSection;
    const aligned =
      values.alignment === "centre" || layout === "centred" ? "text-center" : "text-left";
    const width = contentWidthClass(values.contentWidth);
    const placed = layout === "minimal" ? undefined : values.image;
    const image = placed === undefined ? null : context.image(placed.mediaId);
    const alt = placed?.alt ?? image?.alt ?? "";
    const copy = (
      <div className={layout === "centred" ? "mx-auto max-w-2xl" : "max-w-xl"}>
        <SectionTitle size="page">{values.title}</SectionTitle>
        <SectionLead className="py-6">{values.text}</SectionLead>
        <ButtonLink label={values.buttonLabel} link={values.buttonLink} context={context} />
      </div>
    );
    if (layout === "background") {
      // The text is set on the overlay.
      return (
        <>
          {image !== null && (
            <Picture
              image={image}
              alt={alt}
              sizes="100vw"
              eager={first}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-neutral/70" />
          <div className={`hero-content relative ${width} text-neutral-content ${aligned}`}>
            {copy}
          </div>
        </>
      );
    }
    if (layout === "minimal") {
      return <div className={`mx-auto ${width} ${aligned}`}>{copy}</div>;
    }
    const centred = layout === "centred";
    // Full: as wide as the screen, up to the widest file the export writes.
    const widthPx = CONTENT_WIDTH_PX[values.contentWidth] ?? FULL_WIDTH_IMAGE_PX;
    return (
      <div
        className={`hero-content ${width} ${centred ? "flex-col gap-10" : "flex-col gap-10 lg:flex-row-reverse"} ${aligned}`}
      >
        {centred ? copy : null}
        {image !== null && (
          <Picture
            image={image}
            alt={alt}
            sizes={
              centred
                ? `(min-width: ${widthPx}px) ${widthPx}px, 100vw`
                : "(min-width: 1024px) 50vw, 100vw"
            }
            eager={first}
            className={
              centred
                ? "h-auto w-full rounded-box shadow-lg"
                : "h-auto w-full max-w-xl rounded-box shadow-lg"
            }
          />
        )}
        {centred ? null : copy}
      </div>
    );
  },
});

/** A section of text: a title and formatted text, set in a readable column. */
const textSection = defineSection({
  label: t("section.text"),
  name: "text-section",
  category: t("category.text"),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "richtext", label: t("field.text"), inline: true },
  },
  defaults: {
    title: t("starter.textTitle"),
    text: `<p>${t("starter.textBody")}</p>`,
    contentWidth: "narrow",
  },
  frame: () => "bg-base-100",
  render: ({ values }) => (
    <div className={`mx-auto ${contentWidthClass(values.contentWidth)}`}>
      <SectionTitle>{values.title}</SectionTitle>
      <SectionIntro className="mt-4">{values.text}</SectionIntro>
    </div>
  ),
});

/** Text beside an image, the image on the right or the left (2.6). */
const textImage = defineSection({
  label: t("section.textImage"),
  name: "text-image",
  category: t("category.text"),
  variants: TEXT_IMAGE_LAYOUTS.map((value) => ({
    label: t(`field.textImageLayout.${value}`),
    value,
  })),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "richtext", label: t("field.text"), inline: true },
    image: { kind: "media", label: t("field.image") },
  },
  defaults: {
    title: t("starter.textImageTitle"),
    text: `<p>${t("starter.textImageBody")}</p>`,
    contentWidth: "wide",
  },
  frame: () => "bg-base-100",
  render: ({ values, context }) => {
    const placed = values.image;
    const image = placed === undefined ? null : context.image(placed.mediaId);
    return (
      // Without an image yet, the text alone, in the Text section's readable measure at most.
      <div
        className={
          image === null
            ? `mx-auto ${contentWidthClass(narrowerWidth(values.contentWidth, "narrow"))}`
            : `mx-auto grid ${contentWidthClass(values.contentWidth)} items-center gap-10 md:grid-cols-2`
        }
      >
        {/* The text comes first, as it is read; on wide screens CSS puts the image left. */}
        <div>
          <SectionTitle>{values.title}</SectionTitle>
          <SectionIntro className="mt-4">{values.text}</SectionIntro>
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
    );
  },
});

/**
 * Asks visitors to do one thing, with a button: a centred banner in the theme's dark colour (whose
 * text every theme keeps readable, unlike its main colour's), or the text with the button beside
 * it (2.6).
 */
const callToAction = defineSection({
  label: t("section.callToAction"),
  name: "cta",
  category: t("category.callToAction"),
  variants: CTA_LAYOUTS.map((value) => ({ label: t(`field.ctaLayout.${value}`), value })),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "text", label: t("field.text"), inline: true },
    buttonLabel: { kind: "text", label: t("field.buttonLabel") },
    buttonLink: { kind: "link", label: t("field.buttonLink") },
  },
  // Its text beside the button was Wide before 3.21; format 10 keeps those saved then.
  defaults: {
    title: t("starter.ctaTitle"),
    text: t("starter.ctaText"),
    buttonLabel: t("starter.ctaButton"),
    contentWidth: "narrow",
  },
  frame: (values) =>
    values.variant === "banner" ? "bg-neutral text-neutral-content" : "bg-base-200",
  render: ({ values, context }) => {
    const banner = values.variant === "banner";
    const width = contentWidthClass(values.contentWidth);
    return (
      <div
        className={
          banner
            ? `mx-auto ${width} text-center`
            : `mx-auto flex ${width} flex-col items-start gap-6 md:flex-row md:items-center md:justify-between`
        }
      >
        <div>
          <SectionTitle>{values.title}</SectionTitle>
          <SectionLead className="mt-4">{values.text}</SectionLead>
        </div>
        <ButtonLink
          label={values.buttonLabel}
          link={values.buttonLink}
          context={context}
          kind="primaryLarge"
          className={banner ? "mt-8" : "shrink-0"}
        />
      </div>
    );
  },
});

/**
 * Questions and answers, a section like the others (2.19): its own padding, its questions in a
 * readable column. As an accordion each question is a native `<details>` that opens, so it works
 * without JavaScript; in two columns, side by side on wider screens; or with every answer shown,
 * each question a heading (2.7b).
 */
const faq = defineSection({
  label: t("section.faq"),
  name: "faq",
  category: t("category.questions"),
  variants: FAQ_LAYOUTS.map((value) => ({ label: t(`field.faqLayout.${value}`), value })),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    items: { kind: "slot", label: t("field.questions"), allow: ["FaqItem"] },
  },
  // Its two columns were Wide before 3.21; format 10 keeps those saved then.
  defaults: { title: t("starter.faqTitle"), contentWidth: "narrow", items: [] },
  frame: () => "bg-base-100",
  render: ({ values, slots }) => {
    const Items = slots.items;
    const layout = values.variant;
    return (
      <div className={`mx-auto ${contentWidthClass(values.contentWidth)} space-y-4`}>
        <SectionTitle>{values.title}</SectionTitle>
        <FaqLayoutContext value={layout}>
          {layout === "columns" ? (
            <Items className="grid items-start gap-2 md:grid-cols-2 md:gap-4" />
          ) : (
            <div className={layout === "open" ? "space-y-8" : "space-y-2"}>
              <Items />
            </div>
          )}
        </FaqLayoutContext>
      </div>
    );
  },
});

/** A question as its FAQ's layout draws it: one to open, or open already. */
function FaqItemView({
  question,
  answer,
}: {
  readonly question: ReactNode;
  readonly answer: ReactNode;
}) {
  const layout = useContext(FaqLayoutContext);
  if (layout === "open") {
    return (
      <div className="site-faq-item">
        <SectionTitle size="small">{question}</SectionTitle>
        <BodyText className="mt-2">{answer}</BodyText>
      </div>
    );
  }
  return (
    <details className="site-faq-item collapse-arrow collapse border border-base-300 bg-base-100">
      <summary className="collapse-title font-semibold">{question}</summary>
      <div className={`collapse-content [&_p+p]:mt-2 ${RICH_TEXT_LIST_CLASSES}`}>{answer}</div>
    </details>
  );
}

/** One question of an FAQ. */
const faqItem = defineComponent({
  label: t("element.faqItem"),
  place: "child",
  fields: {
    question: { kind: "text", label: t("field.question"), inline: true },
    answer: { kind: "richtext", label: t("field.answer"), inline: true },
  },
  defaults: { question: t("starter.faqQuestion"), answer: `<p>${t("starter.faqAnswer")}</p>` },
  render: ({ values }) => <FaqItemView question={values.question} answer={values.answer} />,
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
