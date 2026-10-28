import { t } from "@webforge/i18n";
import { createContext, type ReactNode, useContext } from "react";
import { defineComponent } from "../define.js";
import { defineSection } from "../frame.js";
import type { ComponentDef } from "../library.js";
import { SectionIntro, SectionTitle } from "../typography.js";

const STATS_LAYOUTS = ["row", "cards", "split"] as const;
type StatsLayout = (typeof STATS_LAYOUTS)[number];

/** The layout of the Stats section a stat is in, which draws it. */
const StatsLayoutContext = createContext<StatsLayout>("row");

/** The starter stats: what a small business can usually say in numbers. */
const STARTER_STATS = [
  { number: "starter.statYears", label: "starter.statYearsLabel" },
  { number: "starter.statCustomers", label: "starter.statCustomersLabel" },
  { number: "starter.statRating", label: "starter.statRatingLabel" },
] as const;

/**
 * Numbers to be proud of (the spec's Stats / Numbers): a title, an introduction and stats, each a
 * number and what it counts, edited on the canvas and as a list in the Edit panel. The numbers are
 * text as written ("500+", "4.9"), never counted up; the section's entrance (2.12) is the frame's.
 * Laid out in a row, as cards, or beside the title and introduction.
 */
const stats = defineSection({
  label: t("section.stats"),
  name: "stats",
  category: t("category.stats"),
  variants: STATS_LAYOUTS.map((value) => ({ label: t(`field.statsLayout.${value}`), value })),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "richtext", label: t("field.text"), inline: true },
    items: { kind: "slot", label: t("field.stats"), allow: ["Stat"] },
  },
  defaults: {
    title: t("starter.statsTitle"),
    text: `<p>${t("starter.statsText")}</p>`,
    items: STARTER_STATS.map((stat, index) => ({
      type: "Stat",
      // Placing the section gives every stat an id of its own.
      props: { id: `stat-${index}`, number: t(stat.number), label: t(stat.label) },
    })),
  },
  frame: () => "bg-base-100",
  render: ({ values, slots }) => {
    const Items = slots.items;
    const layout = values.variant;
    const intro = (
      <>
        <SectionTitle>{values.title}</SectionTitle>
        <SectionIntro className="mt-4">{values.text}</SectionIntro>
      </>
    );
    return (
      <StatsLayoutContext value={layout}>
        {layout === "split" ? (
          <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
            <div>{intro}</div>
            <Items className="grid grid-cols-2 gap-6" />
          </div>
        ) : (
          <div className="mx-auto max-w-6xl space-y-10">
            <div className="mx-auto max-w-3xl text-center">{intro}</div>
            <Items
              className={
                layout === "cards"
                  ? "grid gap-6 sm:grid-cols-2 md:grid-cols-3"
                  : "grid gap-8 sm:grid-cols-2 md:grid-cols-3"
              }
            />
          </div>
        )}
      </StatsLayoutContext>
    );
  },
});

/** A stat as its section's layout draws it: the number large, what it counts below. */
function StatView({ number, label }: { readonly number: ReactNode; readonly label: ReactNode }) {
  const layout = useContext(StatsLayoutContext);
  // A <div>, not a <p>: on the canvas each text holds its editor.
  return (
    <div
      className={
        layout === "cards"
          ? "site-stat wf-card flex flex-col items-center gap-1 rounded-box bg-base-200 p-6 text-center"
          : layout === "split"
            ? "site-stat flex flex-col gap-1"
            : "site-stat flex flex-col items-center gap-1 text-center"
      }
    >
      {/* The text's own colour: a theme's primary can be too light to read on its background. */}
      <span className="font-heading text-4xl font-bold">{number}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}

/** One stat of a Stats section: a number and what it counts. */
const stat = defineComponent({
  label: t("element.stat"),
  place: "child",
  fields: {
    number: { kind: "text", label: t("field.statNumber"), inline: true },
    label: { kind: "text", label: t("field.statLabel"), inline: true },
  },
  defaults: {
    number: t("starter.statCustomers"),
    label: t("starter.statCustomersLabel"),
  },
  render: ({ values }) => <StatView number={values.number} label={values.label} />,
});

/** The Stats section and its stats. */
export const statsComponents: Readonly<Record<string, ComponentDef>> = {
  Stats: stats,
  Stat: stat,
};
