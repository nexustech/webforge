import { t } from "@webforge/i18n";
import type { ImageValue } from "@webforge/model";
import { createContext, type ReactNode, useContext } from "react";
import { defineComponent } from "../define.js";
import { contentWidthClass, defineSection } from "../frame.js";
import { LucideIcon } from "../icons.js";
import type { ComponentDef } from "../library.js";
import { CARD_HOVER_FIELDS, hoverClasses } from "../motion.js";
import { Picture } from "../picture.js";
import type { RenderContext } from "../schema.js";
import { BODY_TEXT_CLASSES, SectionTitle } from "../typography.js";

const TESTIMONIALS_LAYOUTS = ["cards", "large", "photos"] as const;
type TestimonialsLayout = (typeof TESTIMONIALS_LAYOUTS)[number];

/** The grid each layout lays its testimonials out in, the slot's own element. */
const GRID_CLASS = {
  cards: "grid gap-6 md:grid-cols-3",
  large: "mx-auto grid max-w-3xl gap-16",
  photos: "grid gap-10 md:grid-cols-2",
} as const satisfies Record<TestimonialsLayout, string>;

/** The layout of the Testimonials section a testimonial is in, and its cards' hover effect's classes. */
const TestimonialsContext = createContext<{
  readonly layout: TestimonialsLayout;
  readonly hover: string;
}>({
  layout: "cards",
  hover: "",
});

/**
 * What customers say (F-ED-6's testimonials): a title and testimonials, each a quote, a name, what
 * they are ("Owner, Hightown Plumbing") and a photo, edited on the canvas and as a list in the Edit
 * panel. Laid out as cards, as large quotes one under another, or with each photo beside its quote.
 * Each is a `<figure>`: the quote a `<blockquote>`, the name its caption.
 */
const testimonials = defineSection({
  label: t("section.testimonials"),
  name: "testimonials",
  category: t("category.testimonials"),
  variants: TESTIMONIALS_LAYOUTS.map((value) => ({
    label: t(`field.testimonialsLayout.${value}`),
    value,
  })),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    items: { kind: "slot", label: t("field.testimonials"), allow: ["Testimonial"] },
    // Every card alike under the pointer, those added later too (F-DS-5, 2.12).
    ...CARD_HOVER_FIELDS,
  },
  defaults: {
    contentWidth: "wide",
    title: t("starter.testimonialsTitle"),
    items: [0, 1, 2].map((index) => ({
      type: "Testimonial",
      props: {
        // Placing the section gives every testimonial an id of its own.
        id: `testimonial-${index}`,
        quote: t("starter.testimonialQuote"),
        name: t("starter.testimonialName"),
        role: t("starter.testimonialRole"),
      },
    })),
  },
  frame: () => "bg-base-100",
  render: ({ values, slots }) => {
    const Items = slots.items;
    return (
      <div className={`mx-auto ${contentWidthClass(values.contentWidth)} space-y-10`}>
        <div className="text-center">
          <SectionTitle>{values.title}</SectionTitle>
        </div>
        <TestimonialsContext value={{ layout: values.variant, hover: hoverClasses(values) }}>
          <Items className={GRID_CLASS[values.variant]} />
        </TestimonialsContext>
      </div>
    );
  },
});

/** A testimonial's photo, round (`className` sizes it); nothing without one. */
function Photo({
  photo,
  context,
  className,
}: {
  readonly photo: ImageValue | undefined;
  readonly context: RenderContext;
  readonly className: string;
}) {
  const image = photo === undefined ? null : context.image(photo.mediaId);
  if (photo === undefined || image === null) return null;
  return (
    <Picture
      image={image}
      // Its alt text here, else Media's own (G15).
      alt={photo.alt ?? image.alt}
      sizes="96px"
      className={`${className} shrink-0 rounded-full object-cover`}
    />
  );
}

/** A testimonial as its section's layout draws it. */
function TestimonialView({
  quote,
  name,
  role,
  photo,
  context,
}: {
  readonly quote: ReactNode;
  readonly name: ReactNode;
  readonly role: ReactNode;
  readonly photo: ImageValue | undefined;
  readonly context: RenderContext;
}) {
  const { layout, hover } = useContext(TestimonialsContext);
  const caption = (
    <figcaption>
      <span className="block font-semibold">{name}</span>
      <span className="block text-sm opacity-80">{role}</span>
    </figcaption>
  );
  if (layout === "photos") {
    return (
      <figure className={`site-testimonial flex items-start gap-6${hover}`}>
        <Photo photo={photo} context={context} className="size-24" />
        <div className="space-y-4">
          <blockquote className={BODY_TEXT_CLASSES}>
            <p>{quote}</p>
          </blockquote>
          {caption}
        </div>
      </figure>
    );
  }
  if (layout === "large") {
    return (
      <figure className={`site-testimonial flex flex-col items-center gap-6 text-center${hover}`}>
        {/* A pull quote, larger than running text. */}
        <blockquote className="font-heading text-2xl leading-snug italic">
          <p>{quote}</p>
        </blockquote>
        <div className="flex items-center gap-4 text-left">
          <Photo photo={photo} context={context} className="size-14" />
          {caption}
        </div>
      </figure>
    );
  }
  return (
    <figure
      className={`site-testimonial wf-card flex flex-col gap-4 rounded-box bg-base-200 p-6${hover}`}
    >
      <LucideIcon name="quote" className="size-8 text-primary" />
      <blockquote className={`flex-1 ${BODY_TEXT_CLASSES}`}>
        <p>{quote}</p>
      </blockquote>
      <div className="flex items-center gap-4">
        <Photo photo={photo} context={context} className="size-12" />
        {caption}
      </div>
    </figure>
  );
}

/** One testimonial: a quote, who said it, and their photo. */
const testimonial = defineComponent({
  label: t("element.testimonial"),
  place: "child",
  fields: {
    quote: { kind: "text", label: t("field.quote"), inline: true },
    name: { kind: "text", label: t("field.testimonialName"), inline: true },
    role: { kind: "text", label: t("field.testimonialRole"), inline: true },
    photo: { kind: "media", label: t("field.photo") },
  },
  defaults: {
    quote: t("starter.testimonialQuote"),
    name: t("starter.testimonialName"),
    role: t("starter.testimonialRole"),
  },
  render: ({ values, context }) => (
    <TestimonialView
      quote={values.quote}
      name={values.name}
      role={values.role}
      photo={values.photo}
      context={context}
    />
  ),
});

/** The Testimonials section and its testimonials. */
export const testimonialsComponents: Readonly<Record<string, ComponentDef>> = {
  Testimonials: testimonials,
  Testimonial: testimonial,
};
