import { t } from "@webforge/i18n";
import { createContext, type ReactNode, useContext } from "react";
import { defineComponent } from "../define.js";
import { contentWidthClass, defineSection } from "../frame.js";
import type { ComponentDef } from "../library.js";
import { BodyText, SectionIntro, SectionTitle } from "../typography.js";

const STEPS_LAYOUTS = ["steps", "timeline"] as const;
type StepsLayout = (typeof STEPS_LAYOUTS)[number];

/** The layout of the Steps section a step is in, which draws it. */
const StepsLayoutContext = createContext<StepsLayout>("steps");

/** The starter steps: how most small businesses take on a job. */
const STARTER_STEPS = [
  { title: "starter.stepContactTitle", text: "starter.stepContactText" },
  { title: "starter.stepQuoteTitle", text: "starter.stepQuoteText" },
  { title: "starter.stepWorkTitle", text: "starter.stepWorkText" },
] as const;

/**
 * The steps' list, an ordered list whatever the layout, so a screen reader says how many steps
 * there are and which one it's on. Side by side in a row from Tablet up, one under another on
 * Mobile. A grid, as the steps sit in Puck's own wrappers on the canvas, where a rule for the
 * list's own items would find none.
 */
const LIST_CLASSES: Readonly<Record<StepsLayout, string>> = {
  steps: "grid gap-8 md:auto-cols-fr md:grid-flow-col",
  timeline: "grid gap-0 md:auto-cols-fr md:grid-flow-col md:gap-6",
};

/**
 * How it works (CC-10): a title, an introduction and numbered steps, each a title and some text,
 * edited on the canvas and as a list in the Edit panel. The numbers are the list's own (an
 * `<ol>`), drawn large above each step, so they're read as the steps' numbers. _Timeline_ shows
 * each step's date instead, along a line: down the page on Mobile, across it from Tablet up. No
 * script.
 */
const steps = defineSection({
  label: t("section.steps"),
  name: "steps",
  category: t("category.features"),
  variants: STEPS_LAYOUTS.map((value) => ({ label: t(`field.stepsLayout.${value}`), value })),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "richtext", label: t("field.text"), inline: true },
    items: { kind: "slot", label: t("field.steps"), allow: ["Step"] },
  },
  defaults: {
    contentWidth: "wide",
    title: t("starter.stepsTitle"),
    text: `<p>${t("starter.stepsText")}</p>`,
    items: STARTER_STEPS.map((step, index) => ({
      type: "Step",
      // Placing the section gives every step an id of its own.
      props: { id: `step-${index}`, title: t(step.title), text: `<p>${t(step.text)}</p>` },
    })),
  },
  frame: () => "bg-base-100",
  render: ({ values, slots }) => {
    const Items = slots.items;
    const layout = values.variant;
    return (
      <StepsLayoutContext value={layout}>
        <div className={`mx-auto ${contentWidthClass(values.contentWidth)} space-y-10`}>
          <div className="mx-auto max-w-3xl text-center">
            <SectionTitle>{values.title}</SectionTitle>
            <SectionIntro className="mt-4">{values.text}</SectionIntro>
          </div>
          <Items as="ol" className={LIST_CLASSES[layout]} />
        </div>
      </StepsLayoutContext>
    );
  },
});

/** A step as its section's layout draws it. */
function StepView({
  title,
  text,
  date,
}: {
  readonly title: ReactNode;
  readonly text: ReactNode;
  readonly date: ReactNode;
}) {
  const layout = useContext(StepsLayoutContext);
  if (layout === "timeline") {
    // A line with a dot at the step: down its start on Mobile, along its top from Tablet up. The
    // line and the dot only show where the step is, so they need no contrast with the page.
    return (
      <li className="site-step relative list-none border-s-2 border-base-300 ps-6 pb-8 before:absolute before:-start-[7px] before:top-1 before:size-3 before:rounded-full before:bg-primary md:border-s-0 md:border-t-2 md:ps-0 md:pt-6 md:pb-0 md:before:start-0 md:before:-top-[7px]">
        {/* The step's date, in the text's own colour: a theme's primary can be too light to read. */}
        <span className="block text-sm font-semibold uppercase tracking-wide opacity-80">
          {date}
        </span>
        <SectionTitle size="small">{title}</SectionTitle>
        <BodyText className="mt-2">{text}</BodyText>
      </li>
    );
  }
  // The list's number, inside the step and above its title, large in the headings' font.
  return (
    <li className="site-step list-inside list-decimal marker:font-heading marker:text-4xl marker:font-bold">
      <SectionTitle size="small">{title}</SectionTitle>
      <BodyText className="mt-2">{text}</BodyText>
    </li>
  );
}

/** One step of a Steps section: a title, some text and a date, which the Timeline shows. */
const step = defineComponent({
  label: t("element.step"),
  place: "child",
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "richtext", label: t("field.text"), inline: true },
    date: {
      kind: "text",
      label: t("field.stepDate"),
      help: t("field.stepDate.help"),
      inline: true,
    },
  },
  defaults: {
    title: t("starter.stepContactTitle"),
    text: `<p>${t("starter.stepContactText")}</p>`,
  },
  render: ({ values }) => <StepView title={values.title} text={values.text} date={values.date} />,
});

/** The Steps section and its steps. */
export const stepsComponents: Readonly<Record<string, ComponentDef>> = {
  Steps: steps,
  Step: step,
};
