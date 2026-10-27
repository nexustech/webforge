import { t } from "@webforge/i18n";
import { APPEARANCE_GROUP } from "./appearance.js";
import type { BehaviourName } from "./behaviours/index.js";
import type { FieldDef } from "./schema.js";

/** How a section or element moves in as visitors scroll to it (F-DS-5); `none` doesn't. */
const ENTRANCES = ["none", "fade", "slideUp", "slideLeft", "slideRight", "zoom"] as const;
type Entrance = (typeof ENTRANCES)[number];

/** How long it waits before it moves in, shortest first (the slider's steps). */
const DELAYS = ["none", "short", "medium", "long"] as const;
type Delay = (typeof DELAYS)[number];

/**
 * The entrance fields (F-DS-5), the same on every section (defineSection's frame) and on each
 * element that stands on its own in a section (Heading, Text, Image, Button, Icon, List, Columns).
 * Its classes and attribute come from {@link entranceClasses} and {@link entranceAttributes}, and
 * the `animate` behaviour plays it (see `behaviours/animate.js`).
 */
export const ENTRANCE_FIELDS = {
  entrance: {
    kind: "select",
    label: t("field.entrance"),
    help: t("field.entrance.help"),
    group: "style",
    options: ENTRANCES.map((value) => ({ label: t(`field.entrance.${value}`), value })),
  },
  entranceDelay: {
    kind: "slider",
    label: t("field.entranceDelay"),
    group: "style",
    steps: DELAYS.map((value) => ({ label: t(`field.entranceDelay.${value}`), value })),
  },
} as const satisfies Readonly<Record<string, FieldDef>>;

/** The names of {@link ENTRANCE_FIELDS}, which a component using them mustn't declare itself. */
export const ENTRANCE_FIELD_NAMES = Object.keys(ENTRANCE_FIELDS) as readonly (
  | "entrance"
  | "entranceDelay"
)[];

/** The entrance fields' values among a component's, as its render or the document has them. */
type EntranceValues = {
  readonly entrance?: unknown;
  readonly entranceDelay?: unknown;
  readonly [field: string]: unknown;
};

/** An entrance that moves: every one but `none`. */
type Moving = Exclude<Entrance, "none">;

const entranceOf = (values: EntranceValues): Moving | undefined =>
  ENTRANCES.find((each): each is Moving => each !== "none" && each === values.entrance);

/**
 * How each entrance starts, before it has moved in: drawn only under `motion-safe`, and only while
 * it waits (`wf-waiting`, the site stylesheet's variant for once the `animate` behaviour has marked
 * the page, `<html data-wf-animate>`, and not yet this one, `data-wf-shown`). Without JavaScript,
 * in print, for search engines and for visitors who prefer less motion, it shows as it is.
 */
const HIDDEN = "motion-safe:wf-waiting:";
const ENTRANCE_START: Readonly<Record<Moving, string>> = {
  fade: `${HIDDEN}opacity-0`,
  slideUp: `${HIDDEN}opacity-0 ${HIDDEN}translate-y-8`,
  slideLeft: `${HIDDEN}opacity-0 ${HIDDEN}-translate-x-8`,
  slideRight: `${HIDDEN}opacity-0 ${HIDDEN}translate-x-8`,
  zoom: `${HIDDEN}opacity-0 ${HIDDEN}scale-95`,
};
/**
 * Each delay, only while it moves in (`wf-entering`: shown, and not yet done, see `animate.js`), so
 * later changes to it (the canvas restyling it, a class of its own) don't wait.
 */
const DELAY_CLASS: Readonly<Record<Delay, string>> = {
  none: "",
  short: " motion-safe:wf-entering:delay-150",
  medium: " motion-safe:wf-entering:delay-300",
  long: " motion-safe:wf-entering:delay-600",
};

/**
 * An entrance's classes, with a space before them to append to others, or "" for none. It moves
 * only on the way in: while it waits it has no transition, so when the page is marked it goes from
 * as drawn to its start at once, rather than fading out where a fast scroll or a checker sees it.
 */
export function entranceClasses(values: EntranceValues): string {
  const entrance = entranceOf(values);
  if (entrance === undefined) return "";
  const delay = DELAYS.find((each) => each === values.entranceDelay) ?? "none";
  return ` motion-safe:transition-[opacity,translate,scale] motion-safe:duration-700 motion-safe:ease-out ${HIDDEN}transition-none ${ENTRANCE_START[entrance]}${DELAY_CLASS[delay]}`;
}

/** The attribute the `animate` behaviour finds an entrance by: `data-wf-entrance="fade"`. */
export function entranceAttributes(values: EntranceValues): Readonly<Record<string, string>> {
  const entrance = entranceOf(values);
  return entrance === undefined ? {} : { "data-wf-entrance": entrance };
}

/** The behaviours an entrance needs on the exported site: `animate`, or none. */
export function entranceBehaviours(values: EntranceValues): readonly BehaviourName[] {
  return entranceOf(values) === undefined ? [] : ["animate"];
}

/** Whether a component's values have an entrance: Layers marks it as animated (UX-12). */
export function hasEntrance(values: EntranceValues): boolean {
  return entranceOf(values) !== undefined;
}

/**
 * What a button, image, icon or card does under the pointer (F-DS-5, ST-2); `none` nothing. Darken
 * and Underline came with the Appearance group's hover row (2.22).
 */
const HOVERS = ["none", "lift", "grow", "shadow", "darken", "underline"] as const;
type Hover = (typeof HOVERS)[number];

/**
 * The hover row (F-DS-5, ST-2): *When hovered*, in the Appearance group under its colours and
 * shadow, on the Button, the Image and the Icon (2.22). CSS only, with no script; Lift and Grow
 * move, so only under `motion-safe`.
 */
export const HOVER_FIELD = {
  kind: "select",
  label: t("field.hoverEffect"),
  group: "style",
  optionGroup: APPEARANCE_GROUP,
  options: HOVERS.map((value) => ({ label: t(`field.hoverEffect.${value}`), value })),
} as const satisfies FieldDef;

/**
 * The hover row on an element without text of its own to underline (2.22b): the Image, whose
 * Underline would reach only its caption, and the Icon.
 */
export const PICTURE_HOVER_FIELD = {
  ...HOVER_FIELD,
  options: HOVER_FIELD.options.filter((option) => option.value !== "underline"),
} as const satisfies FieldDef;

/**
 * The cards' hover effect (F-DS-5), set on a section for all its cards (2.7's Features,
 * Testimonials, Team and Pricing), so every card does the same, those added later too.
 */
export const CARD_HOVER_FIELD = {
  ...HOVER_FIELD,
  label: t("field.cardHoverEffect"),
} as const satisfies FieldDef;

const HOVER_CLASS: Readonly<Record<Hover, string>> = {
  none: "",
  lift: " motion-safe:transition-all motion-safe:hover:-translate-y-1",
  grow: " motion-safe:transition-all motion-safe:hover:scale-105",
  // Its own shadow (`--wf-hover-shadow`), so a theme without shadows doesn't take away an
  // effect the person chose; marked to win, as the Appearance group's shadow is (2.22), so the
  // hover state, written after it, beats it.
  shadow: " transition-all hover:shadow-(--wf-hover-shadow)!",
  darken: " transition-[filter] hover:brightness-90",
  underline: " hover:underline",
};

/** A hover effect's classes, with a space before them to append to others, or "" for none. */
export function hoverClasses(value: unknown): string {
  return HOVER_CLASS[HOVERS.find((each) => each === value) ?? "none"];
}
