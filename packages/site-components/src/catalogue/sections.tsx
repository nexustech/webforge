import { t } from "@webforge/i18n/components";
import { createContext, type ReactNode, useContext } from "react";
import { gradientLayerClasses } from "../appearance.js";
import { overlayLayer } from "../background.js";
import { defineComponent } from "../define.js";
import { Disclosure } from "../disclosure.js";
import {
  CONTENT_WIDTH_PX,
  type ContentWidth,
  contentWidthClass,
  defineSection,
  narrowerWidth,
} from "../frame.js";
import type { ComponentDef } from "../library.js";
import { Picture } from "../picture.js";
import { BodyText, ButtonLink, SectionIntro, SectionLead, SectionTitle } from "../typography.js";

const ALIGNMENTS = ["centre", "left"] as const;
const HERO_LAYOUTS = ["split", "centred", "background", "minimal"] as const;
/** How tall the Hero is (HH-4): as its content, most of the window, or all of it. */
const HERO_HEIGHTS = ["fit", "tall", "screen"] as const;
type HeroHeight = (typeof HERO_HEIGHTS)[number];

/**
 * Where a Whole screen Hero is (HH-4): anywhere it keeps the whole window; first on its page,
 * under a Header with its own band, or with a Header joined to it, it leaves the room of what's
 * above it.
 */
type HeroPlace = "free" | "belowHeader" | "joined";

/**
 * The least height of a Whole screen Hero that's first on its page (#1489), floored or not: the
 * window less where it starts, which `joined.js` measures (`--wf-above-h`, the canvas too). Until
 * then, an estimate: an Announcement bar above the Header (`--wf-bar-h`, {@link BAR_ESTIMATE}),
 * and the Header's band (`--wf-header-h`, its own estimate) unless the Header is joined to it.
 * Written out whole, as Tailwind finds classes so.
 */
const FIRST_SCREEN: Readonly<Record<Exclude<HeroPlace, "free">, readonly [string, string]>> = {
  belowHeader: [
    "min-h-[max(28rem,calc(var(--wf-viewport-h,100svh)_-_var(--wf-above-h,calc(var(--wf-bar-h,0px)_+_var(--wf-header-h,0px)))))]",
    "min-h-[calc(var(--wf-viewport-h,100svh)_-_var(--wf-above-h,calc(var(--wf-bar-h,0px)_+_var(--wf-header-h,0px))))]",
  ],
  joined: [
    "min-h-[max(28rem,calc(var(--wf-viewport-h,100svh)_-_var(--wf-above-h,var(--wf-bar-h,0px))))]",
    "min-h-[calc(var(--wf-viewport-h,100svh)_-_var(--wf-above-h,var(--wf-bar-h,0px)))]",
  ],
};

/**
 * An Announcement bar's height, one line of small text with its padding (2.25 rem), where one is
 * above the page's `<main>`, with or without a Header after it (#1489); a bar placed on a page is
 * inside `<main>`, not above it: {@link FIRST_SCREEN}'s estimate before `joined.js` measures. Without
 * the script the bar is always shown, so the Hero ends within a few pixels of the window's foot
 * (more where the bar's text wraps).
 */
const BAR_ESTIMATE = "[:root:has([data-wf-announcement]~main)_&]:[--wf-bar-h:2.25rem]";

/**
 * Every class a Whole screen Hero has only as its page's first section ({@link FIRST_SCREEN} and
 * {@link BAR_ESTIMATE}), which the canvas compiles whatever the page (#1489): it collects a page's
 * classes without its Header, so it never draws the Hero first under one.
 */
export const FIRST_SCREEN_CLASSES: readonly string[] = [
  ...FIRST_SCREEN.belowHeader,
  ...FIRST_SCREEN.joined,
  BAR_ESTIMATE,
];

/**
 * The Hero's least height (HH-4), never below its layout's floor (28 rem with its picture behind
 * the text), and always a minimum: content taller still shows whole. The window's height is the
 * canvas's in the editor (`--wf-viewport-h`, its frame growing with the page), the small viewport's
 * elsewhere, so a phone's toolbar doesn't hide its foot. First on its page, the Whole screen leaves
 * the room above it ({@link FIRST_SCREEN}): an Announcement bar's, and a Header's with its own band.
 */
function heroMinHeight(height: HeroHeight, floored: boolean, place: HeroPlace): string {
  if (height === "fit") return floored ? "min-h-[28rem]" : "";
  if (height === "tall") {
    return floored
      ? "min-h-[max(28rem,calc(var(--wf-viewport-h,100svh)*0.7))]"
      : "min-h-[calc(var(--wf-viewport-h,100svh)*0.7)]";
  }
  if (place !== "free") {
    const [withFloor, without] = FIRST_SCREEN[place];
    return `${floored ? withFloor : without} ${BAR_ESTIMATE}`;
  }
  return floored
    ? "min-h-[max(28rem,var(--wf-viewport-h,100svh))]"
    : "min-h-[var(--wf-viewport-h,100svh)]";
}

/** Where the Hero's text sits on its picture, from top to bottom (HH-6). */
const HERO_TEXT_PLACES = ["middle", "bottom"] as const;

/**
 * How wide the Hero's title and text are (#1631): Narrow, a reading width, as every Hero's was;
 * or Wide, as wide as its Content width, at most Wide's own (about 1,150 px), as lines much longer
 * are hard to read (WCAG 1.4.8 suggests 80 characters).
 */
const HERO_TEXT_WIDTHS = ["narrow", "wide"] as const;

/** The Hero's copy at Wide (#1631): its section's content width, never wider than Wide's. */
const HERO_WIDE_TEXT = "w-full max-w-6xl";
const TEXT_IMAGE_LAYOUTS = ["imageRight", "imageLeft"] as const;
const CTA_LAYOUTS = ["banner", "split"] as const;
const FAQ_LAYOUTS = ["accordion", "columns", "open"] as const;
type FaqLayout = (typeof FAQ_LAYOUTS)[number];

/** The layout of the FAQ a question is in, which draws it: to open, or open already. */
const FaqLayoutContext = createContext<FaqLayout>("accordion");

/**
 * The cap of the Hero's `hero-content` at each content width (#1404): a section's, plus the 1rem
 * of padding daisyUI gives it on each side. So at a capped width its content lines up with other
 * sections' and the Header's, and on a phone that padding still gives the space it had.
 */
const HERO_CONTENT_WIDTH_CLASS: Readonly<Record<ContentWidth, string>> = {
  narrow: "max-w-[50rem]",
  medium: "max-w-[58rem]",
  wide: "max-w-[74rem]",
  full: "max-w-none",
};

/**
 * The large opening section of a page: title, short text, a button and an image, in one of four
 * layouts (2.6): the image beside the text (the first, as Heroes were before), the text centred
 * with the image below, the image behind the text (its focal point kept in view), or text only.
 */
const hero = defineSection({
  label: t("section.hero"),
  // Its title is the page's `<h1>` (`SectionTitle size="page"`).
  mainHeading: { field: "title" },
  studioSample: 1,
  name: "hero",
  // Its image field draws its own background, behind the text, under the overlay's fields (HH-3).
  background: "own",
  // There, the text is on the picture: its contrast can't be measured (#670).
  pictureBehind: [{ field: "image", variants: ["background"] }],
  category: t("category.heroes"),
  variants: HERO_LAYOUTS.map((value) => ({
    label: t(`field.heroLayout.${value}`),
    value,
    // Text only has no image; centred is always centred (#311). Its overlay shows only over its
    // picture behind the text (`pictureBehind`, HH-3); where its text sits, only in that layout
    // (HH-6).
    // Beside the picture, its text already has half the row: no Text width (#1631).
    ...(value === "minimal" ? { hides: ["image", "textPlace"] as const } : {}),
    ...(value === "centred" ? { hides: ["alignment", "textPlace"] as const } : {}),
    ...(value === "split" ? { hides: ["textPlace", "textWidth"] as const } : {}),
  })),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "text", label: t("field.text"), inline: true },
    buttonLabel: { kind: "text", label: t("field.buttonLabel") },
    buttonLink: { kind: "link", label: t("field.buttonLink"), button: "buttonLabel" },
    // A second button beside the first, empty until given text (HH-5). Its link is a button's, so
    // Site Check finds one with no link, and AI apps know its label, as the first's (#1256).
    secondButtonLabel: {
      kind: "text",
      label: t("field.secondButtonLabel"),
      help: t("field.secondButtonLabel.help"),
    },
    secondButtonLink: {
      kind: "link",
      label: t("field.secondButtonLink"),
      button: "secondButtonLabel",
    },
    alignment: {
      kind: "select",
      label: t("field.alignment"),
      options: ALIGNMENTS.map((value) => ({ label: t(`field.alignment.${value}`), value })),
    },
    image: { kind: "media", label: t("field.image") },
    height: {
      kind: "select",
      label: t("field.heroHeight"),
      help: t("field.heroHeight.help"),
      options: HERO_HEIGHTS.map((value) => ({ label: t(`field.heroHeight.${value}`), value })),
    },
    textPlace: {
      kind: "select",
      label: t("field.heroTextPlace"),
      help: t("field.heroTextPlace.help"),
      options: HERO_TEXT_PLACES.map((value) => ({
        label: t(`field.heroTextPlace.${value}`),
        value,
      })),
    },
    // Just before Content width, in the Style tab, so the two widths read together (#1631).
    textWidth: {
      kind: "select",
      label: t("field.heroTextWidth"),
      help: t("field.heroTextWidth.help"),
      group: "style",
      options: HERO_TEXT_WIDTHS.map((value) => ({
        label: t(`field.heroTextWidth.${value}`),
        value,
      })),
    },
  },
  // Its layouts' widths before 3.21 were Wide, Medium (centred) and Narrow (text only); format 10
  // keeps those saved then.
  defaults: {
    title: t("starter.heroTitle"),
    text: t("starter.heroText"),
    buttonLabel: t("starter.heroButton"),
    secondButtonLabel: "",
    alignment: "centre",
    height: "fit",
    textPlace: "middle",
    // A reading width, as every Hero's was, so a saved site draws as before (#1631).
    textWidth: "narrow",
    contentWidth: "wide",
    // Strong, the step nearest the 70% every Hero had, lighter so the picture shows (HH-3); in the
    // Neutral colour it had, so its text keeps its colour. Format 21 keeps 70% for those saved.
    overlay: "60",
    overlayColor: "neutral",
  },
  // The image behind the text fills the whole section, its padding too, behind its overlay, in the
  // overlay's colour without a picture. It doesn't use daisyUI's `hero` grid, whose grid areas
  // would keep the overlay inside the padding.
  // Its height (HH-4): as its content, Tall or Whole screen, the content centred from top to bottom.
  fillsWindow: (values) => values.height === "screen",
  // At Whole screen, the script that measures the Header above it (`joined.js`, HH-4).
  behaviours: (values) => (values.height === "screen" ? ["joined"] : []),
  frame: (values, place) => {
    const behind = values.variant === "background";
    const tall = heroMinHeight(
      values.height,
      behind,
      place?.belowHeader === true ? "belowHeader" : place?.joined === true ? "joined" : "free",
    );
    if (behind) {
      return `relative flex ${tall} ${values.textPlace === "bottom" ? "items-end" : "items-center"} justify-center overflow-hidden ${overlayLayer(values).ground}`;
    }
    if (values.variant === "minimal") {
      return tall === "" ? "bg-base-200" : `flex items-center bg-base-200 ${tall}`;
    }
    return tall === "" ? "hero bg-base-200" : `hero bg-base-200 ${tall}`;
  },
  render: ({ id, values, context }) => {
    const layout = values.variant;
    // Its image is the page's first picture when it is the page's first section (3.15, SEO-4).
    const first = id === context.firstSection;
    const aligned =
      values.alignment === "centre" || layout === "centred" ? "text-center" : "text-left";
    const width = contentWidthClass(values.contentWidth);
    const heroWidth = HERO_CONTENT_WIDTH_CLASS[values.contentWidth];
    const placed = layout === "minimal" ? undefined : values.image;
    const image = placed === undefined ? null : context.image(placed.mediaId);
    const alt = placed?.alt ?? image?.alt ?? "";
    // A button's text of spaces only is no text: no empty box drawn for it.
    const firstLabel = values.buttonLabel.trim() === "" ? "" : values.buttonLabel;
    const secondLabel = values.secondButtonLabel.trim() === "" ? "" : values.secondButtonLabel;
    const firstButton = (
      <ButtonLink label={firstLabel} link={values.buttonLink} context={context} />
    );
    // A second button, outlined, beside the first (HH-5), wrapping under it on a phone. A theme whose
    // main buttons are outlined already draws it as a text link (`wf-second-button`), so the two
    // never look alike; on the picture it takes the text's colour, which a brand colour can lack.
    const buttons =
      secondLabel === "" ? (
        firstButton
      ) : (
        <div
          className={
            aligned === "text-center"
              ? "flex flex-wrap justify-center gap-3"
              : "flex flex-wrap gap-3"
          }
        >
          {firstButton}
          <ButtonLink
            label={secondLabel}
            link={values.secondButtonLink}
            context={context}
            kind="outline"
            className={
              layout === "background"
                ? `wf-second-button ${overlayLayer(values).button}`
                : "wf-second-button"
            }
          />
        </div>
      );
    // Narrow, a reading width; Wide, as wide as the content width allows (#1631).
    const wide = values.textWidth === "wide" && layout !== "split";
    // Text only and centred, the box is centred in its row as its words are (#1648); behind the
    // text, the row's flex centres it already.
    const copyWidth =
      layout === "centred"
        ? "mx-auto max-w-2xl"
        : layout === "minimal" && aligned === "text-center"
          ? "mx-auto max-w-xl"
          : "max-w-xl";
    // Wide and centred, the box is centred in its row too, which at Content width Full is wider
    // than it; on the left, it keeps the row's left edge, as the sections around it do.
    const wideWidth = aligned === "text-center" ? `mx-auto ${HERO_WIDE_TEXT}` : HERO_WIDE_TEXT;
    const copy = (
      <div className={wide ? wideWidth : copyWidth}>
        <SectionTitle size="page">{values.title}</SectionTitle>
        <SectionLead className="py-6">{values.text}</SectionLead>
        {buttons}
      </div>
    );
    if (layout === "background") {
      // Over its picture, the gradient, which the picture would cover (CT-12), then the overlay.
      const gradient = image === null ? "" : gradientLayerClasses(values);
      const overlay = overlayLayer(values);
      // The text is set on the overlay, in its colour's own text colour.
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
          {gradient === "" ? null : (
            <div aria-hidden="true" className={`absolute inset-0 ${gradient}`} />
          )}
          {/* As every Hero's was before HH-3, so a saved one's export is unchanged. */}
          {overlay.layer === "" ? null : <div className={`absolute inset-0 ${overlay.layer}`} />}
          {/*
            On the left, the row spans the Hero's content width, its box at the row's left edge
            (#1658): daisyUI's hero-content centres its box otherwise, whatever the alignment.
          */}
          <div
            className={`hero-content relative ${heroWidth} ${aligned === "text-left" ? "w-full justify-start " : ""}${overlay.text} ${aligned}`}
          >
            {copy}
          </div>
        </>
      );
    }
    if (layout === "minimal") {
      // Taller than its content (HH-4), it's centred in the frame's row: full width, as before.
      const full = values.height === "fit" ? "" : "w-full ";
      return <div className={`mx-auto ${full}${width} ${aligned}`}>{copy}</div>;
    }
    const centred = layout === "centred";
    const widthPx = CONTENT_WIDTH_PX[values.contentWidth];
    return (
      <div
        className={`hero-content ${heroWidth} ${centred ? "flex-col gap-10" : "flex-col gap-10 lg:flex-row-reverse"} ${aligned}`}
      >
        {centred ? copy : null}
        {image !== null && (
          <Picture
            image={image}
            alt={alt}
            sizes={
              !centred
                ? "(min-width: 1024px) 50vw, 100vw"
                : widthPx === undefined
                  ? "100vw"
                  : `(min-width: ${widthPx}px) ${widthPx}px, 100vw`
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
 * it (2.6). Set to Reversed colours, the banner is on the reversed surface, as any section is: a
 * choice of colours wins over the layout's own band (#1257).
 */
const callToAction = defineSection({
  label: t("section.callToAction"),
  studioSample: 3,
  name: "cta",
  category: t("category.callToAction"),
  variants: CTA_LAYOUTS.map((value) => ({ label: t(`field.ctaLayout.${value}`), value })),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "text", label: t("field.text"), inline: true },
    buttonLabel: { kind: "text", label: t("field.buttonLabel") },
    buttonLink: { kind: "link", label: t("field.buttonLink"), button: "buttonLabel" },
  },
  // Its text beside the button was Wide before 3.21; format 10 keeps those saved then.
  defaults: {
    title: t("starter.ctaTitle"),
    text: t("starter.ctaText"),
    buttonLabel: t("starter.ctaButton"),
    contentWidth: "narrow",
  },
  frame: (values) =>
    values.variant !== "banner"
      ? "bg-base-200"
      : values.colors === "inverse"
        ? "bg-base-100"
        : "bg-neutral text-neutral-content",
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
  // Its two columns were Wide before 3.21; format 10 keeps those saved then. Three sample questions
  // (#1012), so a new FAQ is edited rather than built.
  defaults: {
    title: t("starter.faqTitle"),
    contentWidth: "narrow",
    items: (
      [
        ["starter.faqQuestion", "starter.faqAnswer"],
        ["starter.faqQuestion2", "starter.faqAnswer2"],
        ["starter.faqQuestion3", "starter.faqAnswer3"],
      ] as const
    ).map(([question, answer], index) => ({
      type: "FaqItem",
      props: {
        // Placing the section gives every question an id of its own.
        id: `faq-item-${index}`,
        question: t(question),
        answer: `<p>${t(answer)}</p>`,
      },
    })),
  },
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
    <Disclosure className="site-faq-item" title={question}>
      {answer}
    </Disclosure>
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
