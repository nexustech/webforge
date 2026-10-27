import { t } from "@webforge/i18n";
import {
  type Breakpoint,
  isResponsiveValue,
  type Responsive,
  resolveResponsive,
} from "@webforge/model";
import { APPEARANCE_GROUP, DEVICES, perDevice } from "./appearance.js";
import type { BehaviourName } from "./behaviours/index.js";
import { onAnyDevice } from "./library.js";
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

/** The entrance's transition, only while it moves in, so a hover's (2.28) is the only one after. */
const ENTERING = "motion-safe:wf-entering:";

/**
 * An entrance's classes, with a space before them to append to others, or "" for none. It moves
 * only on the way in: while it waits it has no transition, so when the page is marked it goes from
 * as drawn to its start at once, rather than fading out where a fast scroll or a checker sees it.
 */
export function entranceClasses(values: EntranceValues): string {
  const entrance = entranceOf(values);
  if (entrance === undefined) return "";
  const delay = DELAYS.find((each) => each === values.entranceDelay) ?? "none";
  return ` ${ENTERING}transition-[opacity,translate,scale] ${ENTERING}duration-700 ${ENTERING}ease-out ${HIDDEN}transition-none ${ENTRANCE_START[entrance]}${DELAY_CLASS[delay]}`;
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
 * and Underline came with the Appearance group's hover row (2.22); Tilt and Lift and shadow with its
 * transform presets (2.28, ST-7).
 */
const HOVERS = [
  "none",
  "lift",
  "grow",
  "tilt",
  "liftShadow",
  "shadow",
  "darken",
  "underline",
] as const;
type Hover = (typeof HOVERS)[number];

/** How long the hover takes (2.28): Fast is the browser's usual 150 ms, as before. */
const SPEEDS = ["fast", "medium", "slow"] as const;
/** How it moves (2.28): Smooth eases in and out, as before; Springy overshoots a little. */
const EASINGS = ["smooth", "gentle", "springy"] as const;

/** The hover row's place: the Style tab's Appearance group, a value per device (2.28). */
const IN_ROW = { group: "style", optionGroup: APPEARANCE_GROUP, responsive: true } as const;

/**
 * The hover row (F-DS-5, ST-2): *When hovered*, in the Appearance group under its colours and
 * shadow, on the Button, the Image and the Icon (2.22). CSS only, with no script; what moves does
 * so only under `motion-safe`.
 */
const HOVER_FIELD = {
  kind: "select",
  label: t("field.hoverEffect"),
  ...IN_ROW,
  options: HOVERS.map((value) => ({ label: t(`field.hoverEffect.${value}`), value })),
} as const satisfies FieldDef;

const isHover = (value: unknown): value is Hover => HOVERS.some((each) => each === value);

/** An effect that changes over time, so its speed and easing count: all but None and Underline. */
const takesTime = (value: unknown) => value !== "none" && value !== "underline" && isHover(value);

/** Why the speed and easing can't be set: the effect is instant on every device. */
const instant = (values: Readonly<Record<string, unknown>>) =>
  onAnyDevice(values.hover, takesTime) ? undefined : t("field.hoverTiming.unavailable");

/**
 * The hover's speed and easing (2.28, ST-7), beside its effect: one transition, the effect's, timed
 * by theme tokens (Tailwind's durations and easings, and the theme's `--ease-spring`).
 */
const TIMING_FIELDS = {
  hoverSpeed: {
    kind: "slider",
    label: t("field.hoverSpeed"),
    ...IN_ROW,
    steps: SPEEDS.map((value) => ({ label: t(`field.hoverSpeed.${value}`), value })),
    unavailable: instant,
  },
  hoverEasing: {
    kind: "select",
    label: t("field.hoverEasing"),
    ...IN_ROW,
    options: EASINGS.map((value) => ({ label: t(`field.hoverEasing.${value}`), value })),
    unavailable: instant,
  },
} as const satisfies Readonly<Record<string, FieldDef>>;

/** The hover row's fields, by the names a component keeps them under: its effect, speed, easing. */
export const HOVER_FIELDS = { hover: HOVER_FIELD, ...TIMING_FIELDS } as const;

/**
 * The hover row on an element without text of its own to underline (2.22b): the Image, whose
 * Underline would reach only its caption, and the Icon.
 */
export const PICTURE_HOVER_FIELDS = {
  ...HOVER_FIELDS,
  hover: {
    ...HOVER_FIELD,
    options: HOVER_FIELD.options.filter((option) => option.value !== "underline"),
  },
} as const satisfies Readonly<Record<string, FieldDef>>;

/**
 * The cards' hover row (F-DS-5), set on a section for all its cards (2.7's Features,
 * Testimonials, Team and Pricing), so every card does the same, those added later too.
 */
export const CARD_HOVER_FIELDS = {
  ...HOVER_FIELDS,
  hover: { ...HOVER_FIELD, label: t("field.cardHoverEffect") },
} as const satisfies Readonly<Record<string, FieldDef>>;

/** The shadow a hover adds: its own (`--wf-hover-shadow`), so a theme without shadows keeps it. */
const HOVER_SHADOW = "hover:shadow-(--wf-hover-shadow)!";

/**
 * What each effect does when hovered. The shadow is marked to win, as the Appearance group's shadow
 * is (2.22), so the hover state, written after it, beats it.
 */
const HOVER_CLASS: Readonly<Record<Hover, string>> = {
  none: "",
  lift: "motion-safe:hover:-translate-y-1",
  grow: "motion-safe:hover:scale-105",
  tilt: "motion-safe:hover:rotate-2",
  liftShadow: `motion-safe:hover:-translate-y-1 ${HOVER_SHADOW}`,
  shadow: HOVER_SHADOW,
  darken: "hover:brightness-90",
  underline: "hover:underline",
};

/**
 * Each speed's and easing's classes; the first of each adds none, so a hover set before 2.28 draws
 * as it did. Like the transition they time, only under `motion-safe`.
 */
const SPEED_CLASS: Readonly<Record<(typeof SPEEDS)[number], string>> = {
  fast: "",
  medium: " motion-safe:duration-300",
  slow: " motion-safe:duration-500",
};
const EASING_CLASS: Readonly<Record<(typeof EASINGS)[number], string>> = {
  smooth: "",
  gentle: " motion-safe:ease-out",
  springy: " motion-safe:ease-spring",
};

/** The hover row's values among a component's, as its render or the document has them. */
type HoverValues = {
  readonly hover?: unknown;
  readonly hoverSpeed?: unknown;
  readonly hoverEasing?: unknown;
  readonly [field: string]: unknown;
};

/** `value` as it is on `device`, whether it is set per device or not. */
const on = (value: unknown, device: Breakpoint) =>
  isResponsiveValue(value as Responsive<unknown>)
    ? resolveResponsive(value as Responsive<unknown>, device)
    : value;

/** The hover effect on `device`, `none` for no value or an unknown one. */
export function hoverOn(values: HoverValues, device: Breakpoint): Hover {
  const hover = on(values.hover, device);
  return isHover(hover) ? hover : "none";
}

/**
 * The hover row's classes on `device`, as if `effect` were its effect there: the effect, and for
 * one that takes time a single transition with its speed and easing. Visitors who prefer less
 * motion see the effect at once, and nothing moves for them: not even the transition a component
 * has of its own (daisyUI's buttons fade their colours).
 */
export function hoverClassesOn(values: HoverValues, device: Breakpoint, effect: Hover): string {
  if (!takesTime(effect)) return HOVER_CLASS[effect];
  const speed = SPEEDS.find((each) => each === on(values.hoverSpeed, device)) ?? "fast";
  const easing = EASINGS.find((each) => each === on(values.hoverEasing, device)) ?? "smooth";
  return `motion-safe:transition-all${SPEED_CLASS[speed]}${EASING_CLASS[easing]} motion-reduce:transition-none ${HOVER_CLASS[effect]}`;
}

/**
 * The hover row's classes, with a space before them to append to others, or "" for none: each
 * device's only across its own widths where the row is set per device (F-ED-4).
 */
export function hoverClasses(values: HoverValues): string {
  const byDevice = Object.fromEntries(
    DEVICES.map((device) => [device, hoverClassesOn(values, device, hoverOn(values, device))]),
  );
  const drawn = perDevice({ $responsive: byDevice }, (value) =>
    typeof value === "string" ? value : "",
  );
  return drawn === "" ? "" : ` ${drawn}`;
}
