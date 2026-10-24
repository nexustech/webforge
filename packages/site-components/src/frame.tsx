import { t } from "@webforge/i18n";
import type { ReactNode } from "react";
import { type ComponentSpec, defineFramedSection } from "./define.js";
import { boxClasses, type ComponentDef } from "./library.js";
import type { DefaultsOf, FieldDef, RenderPropsOf, ValuesOf } from "./schema.js";

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

/** The fields every section has, which {@link defineSection} adds. */
type FrameFields = { readonly padding: typeof PADDING_FIELD; readonly margin: typeof MARGIN_FIELD };

/** The fields of a section: its own, and its frame's. */
type Fields = Readonly<Record<string, FieldDef>>;

/** What {@link defineSection} takes: a section's own fields, and how to draw its frame and inside. */
export type SectionSpec<F extends Fields, Variant extends string = never> = Omit<
  ComponentSpec<F & FrameFields, Variant>,
  "place" | "fields" | "render"
> & {
  /** Its own fields; its padding and margin are added (a field of either name is refused). */
  readonly fields: F & { readonly padding?: never; readonly margin?: never };
  /** Its name in the `site-<name>` class every exported page and test finds it by: "hero". */
  readonly name: string;
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
 * A section (2.19): {@link defineComponent} for a page band, which adds what every section has.
 * It gets a padding (from {@link SECTION_PADDING} for the sides left unset) and a margin, and is
 * drawn in one frame: `<section class="site-<name> <its frame's classes> <padding> <margin>">`,
 * holding what `render` draws. `defineComponent` refuses a section, so every section has the
 * same frame and the same spacing fields.
 */
export function defineSection<const F extends Fields, const Variant extends string = never>(
  spec: SectionSpec<F, Variant> & { readonly defaults: NoInfer<DefaultsOf<F & FrameFields>> },
): ComponentDef {
  const { name, frame, frameAttributes, render, fields, ...rest } = spec;
  for (const own of ["padding", "margin"]) {
    if (Object.hasOwn(fields, own)) {
      throw new Error(`'${spec.label}' declares its own "${own}": defineSection adds it`);
    }
  }
  return defineFramedSection<F & FrameFields, Variant>({
    ...rest,
    place: "section",
    fields: { ...fields, padding: PADDING_FIELD, margin: MARGIN_FIELD },
    render: (props) => {
      const { values } = props;
      // Every section's values have these two, which generic types can't see through.
      const stored: Readonly<Record<string, unknown>> = values;
      const classes = [
        `site-${name}`,
        frame?.(values) ?? "",
        `${boxClasses(stored.padding, "padding", SECTION_PADDING)}${marginClasses(stored.margin)}`,
      ].filter((part) => part !== "");
      return (
        <section className={classes.join(" ")} {...(frameAttributes?.(values) ?? {})}>
          {render(props)}
        </section>
      );
    },
  });
}
