import { t } from "@webforge/i18n";
import { INVERSE_THEME } from "@webforge/model";
import type { ReactNode } from "react";
import {
  APPEARANCE_FIELD_NAMES,
  APPEARANCE_FIELDS,
  APPEARANCE_FIELDS_WITHOUT_TEXT,
  appearanceBoxClasses,
  appearanceSubtitleClasses,
  appearanceTextClasses,
  DIALOG_FIELDS,
  DIALOG_TITLE_FIELDS,
} from "./appearance.js";
import {
  BACKGROUND_DEFAULTS,
  BACKGROUND_FIELD_NAMES,
  BACKGROUND_FIELDS,
  backgroundClasses,
  SectionBackground,
} from "./background.js";
import { type ComponentSpec, defineFramedSection } from "./define.js";
import { boxClasses, type ComponentDef } from "./library.js";
import {
  ENTRANCE_FIELD_NAMES,
  ENTRANCE_FIELDS,
  entranceAttributes,
  entranceBehaviours,
  entranceClasses,
} from "./motion.js";
import type { DefaultsOf, FieldDef, RenderPropsOf, ValuesOf } from "./schema.js";
import { SectionSubtitleAppearance, SectionTitleAppearance } from "./typography.js";

/** A section's own padding (`px-4 py-16`), for the sides left unset (1.32). */
export const SECTION_PADDING = { top: 16, right: 4, bottom: 16, left: 4 } as const;

/** A section's padding, per side and device (1.32). */
export const PADDING_FIELD = {
  kind: "box",
  label: t("field.padding"),
  property: "padding",
  responsive: true,
} as const satisfies FieldDef;

/**
 * A margin above and below, per device (1.32). A section's left and right stay `auto`, centring
 * it, and an element's are its section's padding.
 */
export const MARGIN_FIELD = {
  kind: "box",
  label: t("field.margin"),
  property: "margin",
  responsive: true,
  sides: ["top", "bottom"],
} as const satisfies FieldDef;

/** The margin classes of a {@link MARGIN_FIELD} value, after a space; nothing when unset. */
export function marginClasses(value: unknown): string {
  const classes = boxClasses(value, "margin", {}, ["top", "bottom"]);
  return classes === "" ? "" : ` ${classes}`;
}

/**
 * A section's colours (2.4, F-DS-3): the page's, or the theme's reversed ones, a dark band on a
 * light theme and a light one on a dark theme. A reversed section is daisyUI's nested theme
 * (`data-theme`, {@link INVERSE_THEME}), so everything inside it takes the reversed colours.
 */
export const COLORS_FIELD = {
  kind: "select",
  label: t("field.sectionColors"),
  help: t("field.sectionColors.help"),
  options: [
    { label: t("field.sectionColors.page"), value: "page" },
    { label: t("field.sectionColors.inverse"), value: "inverse" },
  ],
} as const satisfies FieldDef;

/**
 * The fields every section has, which {@link defineSection} adds: its entrance too (F-DS-5), and
 * the Appearance group (2.22).
 */
type FrameFields = {
  readonly colors: typeof COLORS_FIELD;
  readonly padding: typeof PADDING_FIELD;
  readonly margin: typeof MARGIN_FIELD;
} & typeof ENTRANCE_FIELDS &
  typeof APPEARANCE_FIELDS &
  typeof DIALOG_FIELDS &
  Partial<typeof DIALOG_TITLE_FIELDS> &
  Partial<typeof BACKGROUND_FIELDS>;

/** The names of {@link FrameFields}, which a section can't give a field of its own. */
const FRAME_FIELDS = [
  "colors",
  "padding",
  "margin",
  ...ENTRANCE_FIELD_NAMES,
  ...APPEARANCE_FIELD_NAMES,
  ...(Object.keys(DIALOG_FIELDS) as (keyof typeof DIALOG_FIELDS)[]),
  ...(Object.keys(DIALOG_TITLE_FIELDS) as (keyof typeof DIALOG_TITLE_FIELDS)[]),
  ...BACKGROUND_FIELD_NAMES,
] as const;

/** The fields of a section: its own, and its frame's. */
type Fields = Readonly<Record<string, FieldDef>>;

/** What {@link defineSection} takes: a section's own fields, and how to draw its frame and inside. */
export type SectionSpec<F extends Fields, Variant extends string = never> = Omit<
  ComponentSpec<F & FrameFields, Variant>,
  "place" | "fields" | "render"
> & {
  /**
   * Its own fields; its colours, padding, margin, entrance and Appearance group are added (a field of those names is
   * refused).
   */
  readonly fields: F & {
    readonly colors?: never;
    readonly padding?: never;
    readonly margin?: never;
    readonly entrance?: never;
    readonly entranceDelay?: never;
  } & { readonly [Name in keyof typeof APPEARANCE_FIELDS]?: never };
  /**
   * `false` for a section with no title of its own (a plain Section): the Appearance group's Text
   * controls, which style a section's title, are left out (2.22b). A test checks every section
   * that draws no title says so.
   */
  readonly titled?: false;
  /** Its name in the `site-<name>` class every exported page and test finds it by: "hero". */
  readonly name: string;
  /**
   * `false` for a section that draws its own background image (the Hero's behind-the-text
   * layout), which then has no background image field (2.26).
   */
  readonly background?: false;
  /** The frame's classes from its values: its background and layout ("hero bg-base-200"). */
  readonly frame?: (values: ValuesOf<F & FrameFields, Variant>) => string;
  /** Attributes on the frame from its values, for its behaviour (`data-wf-gallery`). */
  readonly frameAttributes?: (
    values: ValuesOf<F & FrameFields, Variant>,
  ) => Readonly<Record<string, string>>;
  /** The inside of the frame. */
  readonly render: (props: RenderPropsOf<F & FrameFields, Variant>) => ReactNode;
};

/**
 * The text colour role a frame's `classes` set, as a colour ref (#544): `text-neutral-content`
 * gives `neutral-content`; `undefined` when they set none, and the section's text is the page's.
 */
function frameText(classes: string): string | undefined {
  return /(?:^|\s)text-((?:base|primary|secondary|accent|neutral|info|success|warning|error)-content)(?=\s|$)/.exec(
    classes,
  )?.[1];
}

/**
 * A section (2.19): {@link defineComponent} for a page band, which adds what every section has.
 * It gets its colours ({@link COLORS_FIELD}), a padding (from {@link SECTION_PADDING} for the sides
 * left unset) and a margin, and is drawn in one frame: `<section class="site-<name> <its frame's
 * classes> <padding> <margin>">`, with `data-theme` when its colours are reversed, holding what
 * `render` draws. `defineComponent` refuses a section, so every section has the same frame and
 * the same frame fields.
 */
export function defineSection<const F extends Fields, const Variant extends string = never>(
  spec: SectionSpec<F, Variant> & { readonly defaults: NoInfer<DefaultsOf<F & FrameFields>> },
): ComponentDef {
  const { name, frame, frameAttributes, render, fields, behaviours, titled, background, ...rest } =
    spec;
  const appearance = titled === false ? APPEARANCE_FIELDS_WITHOUT_TEXT : APPEARANCE_FIELDS;
  for (const own of FRAME_FIELDS) {
    if (Object.hasOwn(fields, own)) {
      throw new Error(`'${spec.label}' declares its own "${own}": defineSection adds it`);
    }
  }
  return defineFramedSection<F & FrameFields, Variant>({
    ...rest,
    place: "section",
    // Its corners, left to the theme, are a box's (product/11, 3.12 note 7).
    themeCorners: "box",
    // The Appearance group first, so the Style tab shows it before the section's own options.
    fields: {
      ...(appearance as typeof APPEARANCE_FIELDS),
      // Style this ‹component›…'s deeper groups (3.13b), which only the dialog shows, the Title
      // group's (below) for a section with a title of its own.
      ...DIALOG_FIELDS,
      // A background image and its overlay (2.26), in the Appearance group too.
      ...(background === false ? {} : BACKGROUND_FIELDS),
      ...(titled === false ? {} : DIALOG_TITLE_FIELDS),
      ...fields,
      colors: COLORS_FIELD,
      padding: PADDING_FIELD,
      margin: MARGIN_FIELD,
      ...ENTRANCE_FIELDS,
    },
    // Its own behaviours, and `animate` for its entrance.
    behaviours: (values) => {
      // Every section's values have the frame's fields, which generic types can't see through.
      const stored: Readonly<Record<string, unknown>> = values;
      return [
        ...(typeof behaviours === "function" ? behaviours(values) : (behaviours ?? [])),
        ...entranceBehaviours(stored),
      ];
    },
    // The text colour its frame sets for a layout, if any: the overlay check reads its text so (#544).
    sectionText: (values) => frameText(frame?.(values as ValuesOf<F & FrameFields, Variant>) ?? ""),
    // A new section has the page's colours, as one with no value has: choosing them is no change.
    // Its overlay is set too, so the Edit panel shows what a background image would get (2.26).
    defaults: {
      colors: "page",
      ...(background === false ? {} : BACKGROUND_DEFAULTS),
      ...rest.defaults,
    },
    render: (props) => {
      const { values } = props;
      // Every section's values have the frame's fields, which generic types can't see through.
      const stored: Readonly<Record<string, unknown>> = values;
      const classes = [
        `site-${name}`,
        frame?.(values) ?? "",
        `${boxClasses(stored.padding, "padding", SECTION_PADDING)}${marginClasses(stored.margin)}${entranceClasses(stored)}`,
        appearanceBoxClasses(stored),
        backgroundClasses(stored),
      ].filter((part) => part !== "");
      const theme = stored.colors === "inverse" ? { "data-theme": INVERSE_THEME } : {};
      return (
        <section
          className={classes.join(" ")}
          {...(frameAttributes?.(values) ?? {})}
          {...theme}
          {...entranceAttributes(stored)}
        >
          {/* The background image and its overlay, behind what the section draws (2.26). */}
          <SectionBackground
            values={stored}
            context={props.context}
            // The page's first section: its image is above the fold, so it loads at once.
            eager={props.id === props.context.firstSection}
          />
          <SectionTitleAppearance.Provider value={appearanceTextClasses(stored)}>
            <SectionSubtitleAppearance.Provider value={appearanceSubtitleClasses(stored)}>
              {render(props)}
            </SectionSubtitleAppearance.Provider>
          </SectionTitleAppearance.Provider>
        </section>
      );
    },
  });
}
