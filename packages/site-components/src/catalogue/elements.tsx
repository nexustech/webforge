import { t } from "@webforge/i18n";
import { type Breakpoint, type Responsive, resolveResponsive } from "@webforge/model";
import { useContext } from "react";
import { defineComponent } from "../define.js";
import { MARGIN_FIELD, marginClasses } from "../frame.js";
import { type ComponentDef, linkAttributes, responsiveClasses } from "../library.js";
import { Picture } from "../picture.js";
import type { FieldDef, ResolvedImage } from "../schema.js";
import { BODY_TEXT_CLASSES, BUTTON_CLASSES } from "../typography.js";
import {
  COLUMN_LAYOUT_CLASS,
  COLUMN_LAYOUTS,
  type ColumnLayout,
  ColumnsLayoutContext,
  imageSizes,
} from "./column-layouts.js";

const ALIGNMENTS = ["left", "centre", "right"] as const;
/** Where an element sits across its section: Left, Centre or Right. */
const ALIGNMENT_FIELD = {
  kind: "select",
  label: t("field.alignment"),
  options: ALIGNMENTS.map((value) => ({ label: t(`field.alignment.${value}`), value })),
} as const satisfies FieldDef;

const IMAGE_WIDTHS = ["small", "medium", "large", "full"] as const;
/**
 * An Image's width tokens (2.17's handles snap to them): at most this wide, never wider than its
 * column. Full width says so, so a narrower width on a smaller device doesn't carry on above it.
 */
const IMAGE_WIDTH_CLASS = {
  small: "max-w-xs",
  medium: "max-w-md",
  large: "max-w-2xl",
  full: "max-w-none",
} as const;
/** How wide each width token lets an Image be, in pixels (`max-w-xs` is 20rem); full has no cap. */
const IMAGE_WIDTH_PX = { small: 320, medium: 448, large: 672, full: undefined } as const;
/** An Image across its section, by its alignment. */
const IMAGE_ALIGN_CLASS = { left: "mr-auto", centre: "mx-auto", right: "ml-auto" } as const;

/**
 * An Image's picture, asking for a file no wider than it shows (X2): its width token on each
 * device, and in Columns the widest its column can be. A component, so it can read the Columns
 * it is in on the canvas as in the export.
 */
function ImagePicture({
  image,
  alt,
  width,
  rounded,
}: {
  readonly image: ResolvedImage;
  readonly alt: string;
  readonly width: Responsive<(typeof IMAGE_WIDTHS)[number]>;
  readonly rounded: boolean;
}) {
  const layout = useContext(ColumnsLayoutContext);
  const maxPx = (breakpoint: Breakpoint) => IMAGE_WIDTH_PX[resolveResponsive(width, breakpoint)];
  return (
    <Picture
      image={image}
      alt={alt}
      sizes={imageSizes(maxPx, layout)}
      className={rounded ? "h-auto w-full rounded-box" : "h-auto w-full"}
    />
  );
}

/**
 * An image from Media (F-ED-5), as wide as its width token lets it, with its focal point kept in
 * view (F-ED-21) and an optional caption. Without an image it shows a hint on the canvas and
 * nothing in the export.
 */
const image = defineComponent({
  label: t("element.image"),
  category: t("category.media"),
  fields: {
    image: { kind: "media", label: t("field.image") },
    width: {
      kind: "slider",
      label: t("field.imageWidth"),
      responsive: true,
      steps: IMAGE_WIDTHS.map((value) => ({ label: t(`field.imageWidth.${value}`), value })),
    },
    alignment: ALIGNMENT_FIELD,
    rounded: { kind: "toggle", label: t("field.rounded"), group: "style" },
    caption: { kind: "text", label: t("field.caption") },
    margin: MARGIN_FIELD,
  },
  defaults: { width: "full", alignment: "centre", rounded: false, caption: "" },
  render: ({ values, context }) => {
    const placed = values.image;
    const resolved = placed === undefined ? null : context.image(placed.mediaId);
    const width = responsiveClasses(values.width, (value) => IMAGE_WIDTH_CLASS[value]);
    const frame = `site-image w-full ${IMAGE_ALIGN_CLASS[values.alignment]} ${width}${marginClasses(values.margin)}`;
    if (resolved === null) {
      const hint = context.emptyImage?.();
      return hint === undefined ? null : (
        <div
          className={`${frame} flex aspect-video items-center justify-center rounded-box border-2 border-base-300 border-dashed p-4 text-center text-sm`}
        >
          {hint}
        </div>
      );
    }
    const caption = values.caption.trim();
    return (
      <figure className={frame}>
        <ImagePicture
          image={resolved}
          alt={placed?.alt ?? resolved.alt}
          width={values.width}
          rounded={values.rounded}
        />
        {caption === "" ? null : (
          <figcaption className="mt-2 text-center text-sm">{caption}</figcaption>
        )}
      </figure>
    );
  },
});

const BUTTON_STYLES = ["primary", "secondary", "outline"] as const;
const BUTTON_SIZES = ["small", "medium", "large"] as const;
/** A Button's classes by its style and size, all from the catalogue's button classes (2.19). */
const BUTTON_KIND = {
  primary: { small: "primarySmall", medium: "primary", large: "primaryLarge" },
  secondary: { small: "secondarySmall", medium: "secondary", large: "secondaryLarge" },
  outline: { small: "outlineSmall", medium: "outline", large: "outlineLarge" },
} as const satisfies Record<string, Record<string, keyof typeof BUTTON_CLASSES>>;
/** A Button across its section, by its alignment. */
const BUTTON_ALIGN_CLASS = {
  left: "justify-start",
  centre: "justify-center",
  right: "justify-end",
} as const;

/** A link drawn as a button: its text, where it goes, its style and size. */
const button = defineComponent({
  label: t("element.button"),
  category: t("category.basic"),
  fields: {
    label: { kind: "text", label: t("field.buttonLabel") },
    link: { kind: "link", label: t("field.buttonLink") },
    style: {
      kind: "select",
      label: t("field.buttonStyle"),
      options: BUTTON_STYLES.map((value) => ({ label: t(`field.buttonStyle.${value}`), value })),
    },
    size: {
      kind: "select",
      label: t("field.size"),
      options: BUTTON_SIZES.map((value) => ({ label: t(`field.size.${value}`), value })),
    },
    alignment: ALIGNMENT_FIELD,
    margin: MARGIN_FIELD,
  },
  defaults: {
    label: t("starter.buttonLabel"),
    style: "primary",
    size: "medium",
    alignment: "left",
  },
  render: ({ values, context }) => {
    const label = values.label.trim();
    return (
      <div
        className={`site-button flex ${BUTTON_ALIGN_CLASS[values.alignment]}${marginClasses(values.margin)}`}
      >
        {label === "" ? null : (
          <a
            className={BUTTON_CLASSES[BUTTON_KIND[values.style][values.size]]}
            {...linkAttributes(values.link, context)}
          >
            {label}
          </a>
        )}
      </div>
    );
  },
});

const SPACER_HEIGHTS = ["small", "medium", "large", "xlarge"] as const;
const SPACER_HEIGHT_CLASS = { small: "h-4", medium: "h-8", large: "h-16", xlarge: "h-24" } as const;

/** Empty space between elements, taller or shorter per device. */
const spacer = defineComponent({
  label: t("element.spacer"),
  category: t("category.basic"),
  fields: {
    height: {
      kind: "slider",
      label: t("field.spacerHeight"),
      responsive: true,
      steps: SPACER_HEIGHTS.map((value) => ({ label: t(`field.spacerHeight.${value}`), value })),
    },
  },
  defaults: { height: "medium" },
  render: ({ values }) => (
    <div
      className={`site-spacer ${responsiveClasses(values.height, (value) => SPACER_HEIGHT_CLASS[value])}`}
      aria-hidden="true"
    />
  ),
});

/** A line between elements, with an optional word on it ("or"). */
const divider = defineComponent({
  label: t("element.divider"),
  category: t("category.basic"),
  fields: {
    text: { kind: "text", label: t("field.dividerText") },
    margin: MARGIN_FIELD,
  },
  defaults: { text: "" },
  render: ({ values }) => {
    const text = values.text.trim();
    const margin = marginClasses(values.margin);
    // A plain line is a thematic break; one with a word is daisyUI's divider, its word read out.
    return text === "" ? (
      <hr className={`site-divider my-4 border-base-content/10${margin}`} />
    ) : (
      <div className={`site-divider divider${margin}`}>{text}</div>
    );
  },
});

const COLUMN_GAPS = ["small", "medium", "large"] as const;
const COLUMN_GAP_CLASS = { small: "gap-4", medium: "gap-8", large: "gap-12" } as const;

/**
 * Columns side by side (T3): one to four Column elements, each holding elements, laid out per
 * device: equal widths, one wide column, or stacked one under another, as they are on Mobile at
 * first. 2.17's toolbar adds, removes and lays them out.
 */
const columns = defineComponent({
  label: t("element.columns"),
  category: t("category.layout"),
  fields: {
    columns: { kind: "slot", label: t("field.columns"), allow: ["Column"] },
    layout: {
      kind: "select",
      label: t("field.columnLayout"),
      responsive: true,
      options: COLUMN_LAYOUTS.map((value) => ({ label: t(`field.columnLayout.${value}`), value })),
    },
    gap: {
      kind: "slider",
      label: t("field.columnGap"),
      responsive: true,
      steps: COLUMN_GAPS.map((value) => ({ label: t(`field.columnGap.${value}`), value })),
    },
    margin: MARGIN_FIELD,
  },
  defaults: {
    columns: [0, 1].map((index) => ({
      type: "Column",
      props: {
        // Placing a Columns gives every element in it an id of its own.
        id: `column-${index}`,
        content: [
          {
            type: "Text",
            props: { id: `column-${index}-text`, text: `<p>${t("starter.columnText")}</p>` },
          },
        ],
      },
    })),
    layout: { $responsive: { desktop: "equal", mobile: "stacked" } },
    gap: "medium",
  },
  render: ({ values, slots }) => {
    const Columns = slots.columns;
    const layout: Responsive<ColumnLayout> = values.layout;
    const placing = responsiveClasses(layout, (value) => COLUMN_LAYOUT_CLASS[value]);
    const gap = responsiveClasses(values.gap, (value) => COLUMN_GAP_CLASS[value]);
    return (
      <div className={`site-columns${marginClasses(values.margin)}`}>
        <ColumnsLayoutContext value={layout}>
          {/* The grid is the slot's own element, so the canvas lays them out as the export does. */}
          <Columns className={`grid ${placing} ${gap}`} />
        </ColumnsLayoutContext>
      </div>
    );
  },
});

/** One column of a Columns element: elements one under another. */
const column = defineComponent({
  label: t("element.column"),
  place: "child",
  fields: {
    content: { kind: "slot", label: t("field.content"), accepts: "element" },
  },
  defaults: { content: [] },
  // `site-column` is what 2.17's column outlines find on the canvas.
  render: ({ slots }) => {
    const Content = slots.content;
    return (
      <div className="site-column min-w-0">
        <Content className="flex flex-col gap-4" />
      </div>
    );
  },
});

const LIST_STYLES = ["bullets", "numbers", "plain"] as const;
/** A List's markers, and the space between its items. */
const LIST_CLASS = {
  bullets: "list-disc space-y-2 pl-6",
  numbers: "list-decimal space-y-2 pl-6",
  plain: "list-none space-y-2",
} as const;

/** A list of short texts: bullets, numbers or none, each item edited on the canvas. */
const list = defineComponent({
  label: t("element.list"),
  category: t("category.text"),
  fields: {
    items: { kind: "slot", label: t("field.listItems"), allow: ["ListItem"] },
    style: {
      kind: "select",
      label: t("field.listStyle"),
      options: LIST_STYLES.map((value) => ({ label: t(`field.listStyle.${value}`), value })),
    },
    margin: MARGIN_FIELD,
  },
  defaults: {
    items: [0, 1, 2].map((index) => ({
      type: "ListItem",
      props: { id: `list-item-${index}`, text: t("starter.listItem") },
    })),
    style: "bullets",
  },
  render: ({ values, slots }) => {
    const Items = slots.items;
    const className = `site-list ${BODY_TEXT_CLASSES} ${LIST_CLASS[values.style]}${marginClasses(values.margin)}`;
    // Without a class the slot adds no element, so its items are the list's own <li>s.
    return values.style === "numbers" ? (
      <ol className={className}>
        <Items />
      </ol>
    ) : (
      <ul className={className}>
        <Items />
      </ul>
    );
  },
});

/** One item of a List. */
const listItem = defineComponent({
  label: t("element.listItem"),
  place: "child",
  fields: {
    text: { kind: "text", label: t("field.text"), inline: true },
  },
  defaults: { text: t("starter.listItem") },
  render: ({ values }) => <li className="site-list-item">{values.text}</li>,
});

/** The basic elements (2.9): Image, Button, Spacer, Divider, Columns and List. */
export const elementsComponents: Readonly<Record<string, ComponentDef>> = {
  Image: image,
  Button: button,
  Spacer: spacer,
  Divider: divider,
  Columns: columns,
  Column: column,
  List: list,
  ListItem: listItem,
};
