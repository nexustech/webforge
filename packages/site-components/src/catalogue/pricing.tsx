import { t } from "@webforge/i18n";
import { createContext, type ReactNode, useContext } from "react";
import { defineComponent } from "../define.js";
import { defineSection } from "../frame.js";
import type { ComponentDef } from "../library.js";
import { CARD_HOVER_FIELD, hoverClasses } from "../motion.js";
import type { RenderContext } from "../schema.js";
import { BodyText, ButtonLink, SectionTitle } from "../typography.js";

const PRICING_LAYOUTS = ["cards", "list"] as const;
type PricingLayout = (typeof PRICING_LAYOUTS)[number];

/** The grid each layout lays its plans out in, the slot's own element. */
const GRID_CLASS = {
  cards: "grid items-stretch gap-6 md:grid-cols-3",
  list: "mx-auto grid max-w-3xl gap-4",
} as const satisfies Record<PricingLayout, string>;

/** The layout of the Pricing section a plan is in, and its cards' hover effect's classes. */
const PricingContext = createContext<{ readonly layout: PricingLayout; readonly hover: string }>({
  layout: "cards",
  hover: "",
});

/** The starter plans: three steps up, the middle one highlighted. */
const STARTER_PLANS = [
  { name: "starter.planNameBasic", price: "starter.planPriceBasic", featured: false },
  { name: "starter.planNameStandard", price: "starter.planPriceStandard", featured: true },
  { name: "starter.planNamePremium", price: "starter.planPricePremium", featured: false },
] as const;

/**
 * Prices (F-ED-6's prices, the spec's Pricing / Price list): a title, an introduction and plans,
 * each a name, a price, what it's per, what's included and a button, edited on the canvas and as a
 * list in the Edit panel. Laid out as cards side by side, or as a price list, one plan to a row.
 * Each plan's own *Highlight this plan* draws it in the brand colour, in either layout, for as many
 * plans as the person chooses.
 */
const pricing = defineSection({
  label: t("section.pricing"),
  name: "pricing",
  category: t("category.pricing"),
  variants: PRICING_LAYOUTS.map((value) => ({ label: t(`field.pricingLayout.${value}`), value })),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "richtext", label: t("field.text"), inline: true },
    items: { kind: "slot", label: t("field.plans"), allow: ["PricingPlan"] },
    // Every card alike under the pointer, those added later too (F-DS-5, 2.12).
    hover: CARD_HOVER_FIELD,
  },
  defaults: {
    title: t("starter.pricingTitle"),
    text: `<p>${t("starter.pricingText")}</p>`,
    items: STARTER_PLANS.map((plan, index) => ({
      type: "PricingPlan",
      props: {
        // Placing the section gives every plan an id of its own.
        id: `pricing-plan-${index}`,
        name: t(plan.name),
        price: t(plan.price),
        period: t("starter.planPeriod"),
        details: `<p>${t("starter.planDetails")}</p>`,
        buttonLabel: t("starter.planButton"),
        featured: plan.featured,
      },
    })),
  },
  frame: () => "bg-base-100",
  render: ({ values, slots }) => {
    const Items = slots.items;
    return (
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="mx-auto max-w-3xl text-center">
          <SectionTitle>{values.title}</SectionTitle>
          <BodyText className="mt-4">{values.text}</BodyText>
        </div>
        <PricingContext value={{ layout: values.variant, hover: hoverClasses(values.hover) }}>
          <Items className={GRID_CLASS[values.variant]} />
        </PricingContext>
      </div>
    );
  },
});

/** A plan as its section's layout draws it. */
function PricingPlanView({
  name,
  price,
  period,
  details,
  buttonLabel,
  link,
  featured,
  context,
}: {
  readonly name: ReactNode;
  readonly price: ReactNode;
  readonly period: ReactNode;
  readonly details: ReactNode;
  readonly buttonLabel: string;
  readonly link: unknown;
  readonly featured: boolean;
  readonly context: RenderContext;
}) {
  const { layout, hover } = useContext(PricingContext);
  const amount = (size: string) => (
    <p>
      <span className={`${size} font-bold`}>{price}</span>{" "}
      <span className="text-sm opacity-80">{period}</span>
    </p>
  );
  if (layout === "list") {
    return (
      <div
        className={`site-pricing-plan flex flex-col gap-4 rounded-box p-5 sm:flex-row sm:items-start sm:justify-between ${
          featured ? "border-l-4 border-primary bg-base-200" : "border border-base-300"
        }${hover}`}
        data-featured={featured ? "" : undefined}
      >
        <div>
          <SectionTitle size="small">{name}</SectionTitle>
          <BodyText className="mt-2">{details}</BodyText>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          {amount("text-2xl")}
          <ButtonLink
            label={buttonLabel}
            link={link}
            context={context}
            kind={featured ? "primarySmall" : "outlineSmall"}
          />
        </div>
      </div>
    );
  }
  return (
    <div
      className={`site-pricing-plan flex flex-col gap-4 rounded-box p-6 ${
        // A ring, which takes no room: the plans line up with or without it.
        featured
          ? "border border-primary bg-base-200 ring-1 ring-primary"
          : "border border-base-300"
      }${hover}`}
      data-featured={featured ? "" : undefined}
    >
      <SectionTitle size="small">{name}</SectionTitle>
      {amount("text-4xl")}
      <BodyText className="flex-1">{details}</BodyText>
      <ButtonLink
        label={buttonLabel}
        link={link}
        context={context}
        kind={featured ? "primary" : "outline"}
      />
    </div>
  );
}

/** One plan of a Pricing section: a name, a price, what's included and a button. */
const pricingPlan = defineComponent({
  label: t("element.pricingPlan"),
  place: "child",
  fields: {
    name: { kind: "text", label: t("field.planName"), inline: true },
    price: { kind: "text", label: t("field.planPrice"), inline: true },
    period: { kind: "text", label: t("field.pricePeriod"), inline: true },
    details: { kind: "richtext", label: t("field.planDetails"), inline: true },
    buttonLabel: { kind: "text", label: t("field.buttonLabel") },
    link: { kind: "link", label: t("field.buttonLink") },
    featured: {
      kind: "toggle",
      label: t("field.featuredPlan"),
      help: t("field.featuredPlan.help"),
    },
  },
  defaults: {
    name: t("starter.planNameStandard"),
    price: t("starter.planPriceStandard"),
    period: t("starter.planPeriod"),
    details: `<p>${t("starter.planDetails")}</p>`,
    buttonLabel: t("starter.planButton"),
    featured: false,
  },
  render: ({ values, context }) => (
    <PricingPlanView
      name={values.name}
      price={values.price}
      period={values.period}
      details={values.details}
      buttonLabel={values.buttonLabel.trim()}
      link={values.link}
      featured={values.featured}
      context={context}
    />
  ),
});

/** The Pricing section and its plans. */
export const pricingComponents: Readonly<Record<string, ComponentDef>> = {
  Pricing: pricing,
  PricingPlan: pricingPlan,
};
