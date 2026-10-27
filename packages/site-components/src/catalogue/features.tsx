import { t } from "@webforge/i18n";
import { createContext, type ReactNode, useContext } from "react";
import { defineComponent } from "../define.js";
import { defineSection } from "../frame.js";
import { LucideIcon } from "../icons.js";
import type { ComponentDef } from "../library.js";
import { CARD_HOVER_FIELDS, hoverClasses } from "../motion.js";
import { BodyText, SectionTitle } from "../typography.js";

const FEATURES_LAYOUTS = ["cards", "centred", "list"] as const;
type FeaturesLayout = (typeof FEATURES_LAYOUTS)[number];

/** The grid each layout lays its features out in, the slot's own element (docs/components.md). */
const GRID_CLASS = {
  cards: "grid gap-6 md:grid-cols-3",
  centred: "grid gap-10 md:grid-cols-3",
  list: "grid gap-8 md:grid-cols-2",
} as const satisfies Record<FeaturesLayout, string>;

/** The layout of the Features section a feature is in, and its cards' hover effect's classes. */
const FeaturesContext = createContext<{ readonly layout: FeaturesLayout; readonly hover: string }>({
  layout: "cards",
  hover: "",
});

/** Starter features: what a small business most often says about itself. */
const STARTER_ICONS = ["sparkles", "heart-handshake", "clock"] as const;

/**
 * What a business offers, or why to choose it (F-CM-2's Features / Services grid): a title, an
 * introduction and features, each an icon, a title and a few words, edited on the canvas and as a
 * list in the Edit panel. Laid out as cards, as centred icons with text, or as a list in two
 * columns, the icon beside the text. A grid, so features read in order along each row.
 */
const features = defineSection({
  label: t("section.features"),
  name: "features",
  category: t("category.features"),
  variants: FEATURES_LAYOUTS.map((value) => ({ label: t(`field.featuresLayout.${value}`), value })),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "richtext", label: t("field.text"), inline: true },
    items: { kind: "slot", label: t("field.features"), allow: ["Feature"] },
    // Every card alike under the pointer, those added later too (F-DS-5, 2.12).
    ...CARD_HOVER_FIELDS,
  },
  defaults: {
    title: t("starter.featuresTitle"),
    text: `<p>${t("starter.featuresText")}</p>`,
    items: STARTER_ICONS.map((icon, index) => ({
      type: "Feature",
      props: {
        // Placing the section gives every feature an id of its own.
        id: `feature-${index}`,
        icon,
        title: t("starter.featureTitle"),
        text: `<p>${t("starter.featureText")}</p>`,
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
        <FeaturesContext value={{ layout: values.variant, hover: hoverClasses(values) }}>
          <Items className={GRID_CLASS[values.variant]} />
        </FeaturesContext>
      </div>
    );
  },
});

/** A feature as its section's layout draws it. */
function FeatureView({
  icon,
  title,
  text,
}: {
  readonly icon: string | undefined;
  readonly title: ReactNode;
  readonly text: ReactNode;
}) {
  const { layout, hover } = useContext(FeaturesContext);
  const symbol =
    icon === undefined ? null : layout === "centred" ? (
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary text-primary-content">
        <LucideIcon name={icon} className="size-7" />
      </span>
    ) : (
      <LucideIcon name={icon} className="size-8 shrink-0 text-primary" />
    );
  if (layout === "list") {
    return (
      <div className={`site-feature flex items-start gap-4${hover}`}>
        {symbol}
        <div>
          <SectionTitle size="small">{title}</SectionTitle>
          <BodyText className="mt-2">{text}</BodyText>
        </div>
      </div>
    );
  }
  return (
    <div
      className={`${
        layout === "cards"
          ? "site-feature wf-card flex flex-col gap-4 rounded-box bg-base-200 p-6"
          : "site-feature flex flex-col gap-4 text-center"
      }${hover}`}
    >
      {symbol}
      <SectionTitle size="small">{title}</SectionTitle>
      <BodyText>{text}</BodyText>
    </div>
  );
}

/** One feature of a Features section: an icon, a title and a few words. */
const feature = defineComponent({
  label: t("element.feature"),
  place: "child",
  fields: {
    icon: { kind: "icon", label: t("field.icon") },
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "richtext", label: t("field.text"), inline: true },
  },
  // No icon: one the person removes stays removed (a default would come back in its place). The
  // section's starter features each have one.
  defaults: {
    title: t("starter.featureTitle"),
    text: `<p>${t("starter.featureText")}</p>`,
  },
  render: ({ values }) => (
    <FeatureView icon={values.icon} title={values.title} text={values.text} />
  ),
});

/** The Features section and its features. */
export const featuresComponents: Readonly<Record<string, ComponentDef>> = {
  Features: features,
  Feature: feature,
};
