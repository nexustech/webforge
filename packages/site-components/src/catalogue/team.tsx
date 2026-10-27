import { t } from "@webforge/i18n";
import type { ImageValue } from "@webforge/model";
import { createContext, type ReactNode, useContext } from "react";
import { defineComponent } from "../define.js";
import { defineSection } from "../frame.js";
import type { ComponentDef } from "../library.js";
import { CARD_HOVER_FIELDS, hoverClasses } from "../motion.js";
import { Picture } from "../picture.js";
import type { RenderContext } from "../schema.js";
import { BodyText, SectionTitle } from "../typography.js";

const TEAM_LAYOUTS = ["cards", "round", "list"] as const;
type TeamLayout = (typeof TEAM_LAYOUTS)[number];

/** The grid each layout lays its people out in, the slot's own element. */
const GRID_CLASS = {
  cards: "grid gap-6 sm:grid-cols-2 md:grid-cols-3",
  round: "grid gap-10 sm:grid-cols-2 md:grid-cols-4",
  list: "grid gap-8 md:grid-cols-2",
} as const satisfies Record<TeamLayout, string>;

/** The layout of the Team section a person is in, and its cards' hover effect's classes. */
const TeamContext = createContext<{ readonly layout: TeamLayout; readonly hover: string }>({
  layout: "cards",
  hover: "",
});

/**
 * The people behind the business (F-ED-6's team): a title, an introduction and people, each a photo,
 * a name, what they do and a few words, edited on the canvas and as a list in the Edit panel. Laid
 * out as cards with the photo on top, as round photos with centred text, or as a list in two
 * columns, each photo beside its words. A grid, so people read in order along each row.
 */
const team = defineSection({
  label: t("section.team"),
  name: "team",
  category: t("category.team"),
  variants: TEAM_LAYOUTS.map((value) => ({ label: t(`field.teamLayout.${value}`), value })),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "richtext", label: t("field.text"), inline: true },
    items: { kind: "slot", label: t("field.teamMembers"), allow: ["TeamMember"] },
    // Every card alike under the pointer, those added later too (F-DS-5, 2.12).
    ...CARD_HOVER_FIELDS,
  },
  defaults: {
    title: t("starter.teamTitle"),
    text: `<p>${t("starter.teamText")}</p>`,
    items: [0, 1, 2].map((index) => ({
      type: "TeamMember",
      props: {
        // Placing the section gives every person an id of its own.
        id: `team-member-${index}`,
        name: t("starter.teamMemberName"),
        role: t("starter.teamMemberRole"),
        text: `<p>${t("starter.teamMemberText")}</p>`,
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
        <TeamContext value={{ layout: values.variant, hover: hoverClasses(values) }}>
          <Items className={GRID_CLASS[values.variant]} />
        </TeamContext>
      </div>
    );
  },
});

/** A person as their section's layout draws them. */
function TeamMemberView({
  photo,
  name,
  role,
  text,
  context,
}: {
  readonly photo: ImageValue | undefined;
  readonly name: ReactNode;
  readonly role: ReactNode;
  readonly text: ReactNode;
  readonly context: RenderContext;
}) {
  const { layout, hover } = useContext(TeamContext);
  const image = photo === undefined ? null : context.image(photo.mediaId);
  const picture = (className: string, sizes: string) =>
    photo === undefined || image === null ? null : (
      <Picture
        image={image}
        // Its alt text here, else Media's own (G15).
        alt={photo.alt ?? image.alt}
        sizes={sizes}
        className={`${className} object-cover`}
      />
    );
  const words = (
    <>
      <SectionTitle size="small">{name}</SectionTitle>
      <p className="text-sm opacity-80">{role}</p>
      <BodyText className="mt-3">{text}</BodyText>
    </>
  );
  if (layout === "round") {
    return (
      <div className={`site-team-member flex flex-col items-center text-center${hover}`}>
        {picture("mb-4 size-32 rounded-full", "128px")}
        {words}
      </div>
    );
  }
  if (layout === "list") {
    return (
      <div className={`site-team-member flex items-start gap-6${hover}`}>
        {picture("size-24 shrink-0 rounded-box", "96px")}
        <div>{words}</div>
      </div>
    );
  }
  return (
    <div
      className={`site-team-member wf-card flex flex-col overflow-hidden rounded-box bg-base-200${hover}`}
    >
      {picture("aspect-square w-full", "(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw")}
      <div className="p-6">{words}</div>
    </div>
  );
}

/** One person of a Team section: a photo, a name, what they do and a few words. */
const teamMember = defineComponent({
  label: t("element.teamMember"),
  place: "child",
  fields: {
    photo: { kind: "media", label: t("field.photo") },
    name: { kind: "text", label: t("field.teamMemberName"), inline: true },
    role: { kind: "text", label: t("field.teamMemberRole"), inline: true },
    text: { kind: "richtext", label: t("field.text"), inline: true },
  },
  defaults: {
    name: t("starter.teamMemberName"),
    role: t("starter.teamMemberRole"),
    text: `<p>${t("starter.teamMemberText")}</p>`,
  },
  render: ({ values, context }) => (
    <TeamMemberView
      photo={values.photo}
      name={values.name}
      role={values.role}
      text={values.text}
      context={context}
    />
  ),
});

/** The Team section and its people. */
export const teamComponents: Readonly<Record<string, ComponentDef>> = {
  Team: team,
  TeamMember: teamMember,
};
