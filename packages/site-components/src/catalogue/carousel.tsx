import { t } from "@webforge/i18n";
import { defineComponent } from "../define.js";
import { MARGIN_FIELD, marginClasses } from "../frame.js";
import type { ComponentDef } from "../library.js";
import { Picture } from "../picture.js";
import { BUTTON_CLASSES } from "../typography.js";

const CAROUSEL_LAYOUTS = ["images", "testimonials", "logos"] as const;
const INTERVALS = ["5", "7", "10"] as const;
/** Autoplay's options, shown together in the Edit panel. */
const AUTOPLAY_GROUP = { id: "autoplay", label: t("field.autoplayGroup") };

/** A small icon for the carousel's buttons, drawn inline so the site needs no icon font (C8). */
function Icon({ path }: { readonly path: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

const PREVIOUS_ICON = "m15 18-6-6 6-6";
const NEXT_ICON = "m9 18 6-6-6-6";
const PAUSE_ICON = "M8 5v14M16 5v14";
const PLAY_ICON = "M7 4v16l13-8z";

/**
 * Slides of images, testimonials or logos (2.10, G9): one image after another in a strip that
 * swipes and scrolls by itself without JavaScript, its slides snapping into place. `webforge.js`'s
 * "carousel" behaviour adds the previous and next buttons, the arrow keys and, if it is set to play
 * automatically, a button to stop it (WCAG 2.2.2); it never plays when the visitor prefers reduced
 * motion, and pauses while the pointer or the focus is on it. On the canvas each slide shows, one
 * under another, to be edited.
 */
const carousel = defineComponent({
  label: t("element.carousel"),
  category: t("category.media"),
  variants: CAROUSEL_LAYOUTS.map((value) => ({ label: t(`field.carouselLayout.${value}`), value })),
  fields: {
    label: { kind: "text", label: t("field.carouselLabel") },
    slides: { kind: "slot", label: t("field.slides"), allow: ["CarouselSlide"] },
    autoplay: {
      kind: "toggle",
      label: t("field.autoplay"),
      help: t("field.autoplay.help"),
      optionGroup: AUTOPLAY_GROUP,
    },
    interval: {
      kind: "select",
      label: t("field.interval"),
      optionGroup: AUTOPLAY_GROUP,
      options: INTERVALS.map((value) => ({ label: t(`field.interval.${value}`), value })),
    },
    margin: MARGIN_FIELD,
  },
  defaults: { label: t("starter.carouselLabel"), slides: [], autoplay: false, interval: "7" },
  behaviours: ["carousel"],
  render: ({ values, slots }) => {
    const Slides = slots.slides;
    const button = BUTTON_CLASSES.iconSmall;
    return (
      // A labelled <section> is a region landmark: the carousel's own, named by its label.
      <section
        className={`site-carousel group/carousel space-y-3${marginClasses(values.margin)}`}
        aria-roledescription={t("siteText.carousel")}
        // Named even with its name left empty: a nameless region is no landmark (axe).
        aria-label={values.label.trim() === "" ? t("starter.carouselLabel") : values.label}
        data-layout={values.variant}
        data-wf-carousel=""
        data-slide-label={t("siteText.slide")}
        data-slide-of={t("siteText.slideOf")}
        data-slides-of={t("siteText.slidesOf")}
        {...(values.autoplay ? { "data-interval": `${Number(values.interval) * 1000}` } : {})}
      >
        {/* Shown by the script, which makes them work; the rotation button comes first (APG). */}
        <div className="flex items-center justify-end gap-1" data-wf-carousel-controls="" hidden>
          {values.autoplay ? (
            <button
              type="button"
              className={button}
              data-wf-carousel-play=""
              data-label-stop={t("siteText.stopSlides")}
              data-label-start={t("siteText.startSlides")}
              aria-label={t("siteText.stopSlides")}
            >
              <span className="hidden group-data-[playing]/carousel:inline">
                <Icon path={PAUSE_ICON} />
              </span>
              <span className="group-data-[playing]/carousel:hidden">
                <Icon path={PLAY_ICON} />
              </span>
            </button>
          ) : null}
          <button
            type="button"
            className={button}
            data-wf-carousel-previous=""
            aria-label={t("siteText.previousSlide")}
          >
            <Icon path={PREVIOUS_ICON} />
          </button>
          <button
            type="button"
            className={button}
            data-wf-carousel-next=""
            aria-label={t("siteText.nextSlide")}
          >
            <Icon path={NEXT_ICON} />
          </button>
        </div>
        {/* Focusable, so the keyboard can scroll it without the script too. */}
        {/* biome-ignore lint/a11y/useSemanticElements: a named strip of slides, not a <fieldset> of form controls. */}
        <div
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth rounded-box motion-reduce:scroll-auto"
          data-wf-carousel-track=""
          role="group"
          aria-label={t("siteText.slides")}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region the keyboard must reach (axe's scrollable-region-focusable).
          tabIndex={0}
        >
          <Slides />
        </div>
        <p className="sr-only" data-wf-carousel-status="" aria-live="polite" />
      </section>
    );
  },
});

/**
 * One slide of a Carousel: an image, a text and a name, shown as its Carousel's layout asks. Images
 * show large with the text as a caption; testimonials show the text as a quote, the name and a
 * small photo; logos show the image alone, several at once.
 */
const carouselSlide = defineComponent({
  label: t("element.carouselSlide"),
  place: "child",
  fields: {
    image: { kind: "media", label: t("field.image") },
    text: { kind: "text", label: t("field.text"), inline: true },
    name: { kind: "text", label: t("field.slideName"), inline: true },
  },
  defaults: { text: t("starter.slideText"), name: "" },
  render: ({ values, context }) => {
    const placed = values.image;
    const image = placed === undefined ? null : context.image(placed.mediaId);
    return (
      <figure className="site-carousel-slide flex shrink-0 basis-full snap-start flex-col items-center gap-4 text-center group-data-[layout=logos]/carousel:basis-1/2 group-data-[layout=logos]/carousel:justify-center md:group-data-[layout=logos]/carousel:basis-1/4">
        {image !== null && (
          <Picture
            image={image}
            alt={placed?.alt ?? image.alt}
            sizes="(min-width: 768px) 50vw, 100vw"
            className="h-auto w-full rounded-box object-cover group-data-[layout=images]/carousel:aspect-video group-data-[layout=logos]/carousel:max-h-16 group-data-[layout=logos]/carousel:w-auto group-data-[layout=logos]/carousel:rounded-none group-data-[layout=logos]/carousel:object-contain group-data-[layout=testimonials]/carousel:size-16 group-data-[layout=testimonials]/carousel:rounded-full"
          />
        )}
        <p className="max-w-2xl text-lg group-data-[layout=images]/carousel:text-base group-data-[layout=logos]/carousel:hidden group-data-[layout=testimonials]/carousel:text-xl group-data-[layout=testimonials]/carousel:italic">
          {values.text}
        </p>
        <figcaption className="font-semibold group-data-[layout=images]/carousel:hidden group-data-[layout=logos]/carousel:sr-only">
          {values.name}
        </figcaption>
      </figure>
    );
  },
});

/** The Carousel and its slides. */
export const carouselComponents: Readonly<Record<string, ComponentDef>> = {
  Carousel: carousel,
  CarouselSlide: carouselSlide,
};
