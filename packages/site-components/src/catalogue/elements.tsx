import { t } from "@webforge/i18n";
import { defineComponent } from "../define.js";
import { MARGIN_FIELD, marginClasses } from "../frame.js";
import { type ComponentDef, linkAttributes, responsiveClasses } from "../library.js";
import { Picture } from "../picture.js";
import type { FieldDef } from "../schema.js";
import { BUTTON_CLASSES } from "../typography.js";

const ALIGNMENTS = ["left", "centre", "right"] as const;
/** Where an element sits across its section: Left, Centre or Right. */
const ALIGNMENT_FIELD = {
  kind: "select",
  label: t("field.alignment"),
  options: ALIGNMENTS.map((value) => ({ label: t(`field.alignment.${value}`), value })),
} as const satisfies FieldDef;

const IMAGE_WIDTHS = ["small", "medium", "large", "full"] as const;
/** An Image's width tokens (2.17's handles snap to them): at most this wide, never wider than its column. */
const IMAGE_WIDTH_CLASS = {
  small: "max-w-xs",
  medium: "max-w-md",
  large: "max-w-2xl",
  full: "",
} as const;
/** An Image across its section, by its alignment. */
const IMAGE_ALIGN_CLASS = { left: "mr-auto", centre: "mx-auto", right: "ml-auto" } as const;

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
    const frame = `site-image w-full ${IMAGE_ALIGN_CLASS[values.alignment]}${width === "" ? "" : ` ${width}`}${marginClasses(values.margin)}`;
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
        <Picture
          image={resolved}
          alt={placed?.alt ?? resolved.alt}
          sizes="(min-width: 768px) 50vw, 100vw"
          className={values.rounded ? "h-auto w-full rounded-box" : "h-auto w-full"}
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
      <hr className={`site-divider my-4 border-base-300${margin}`} />
    ) : (
      <div className={`site-divider divider${margin}`}>{text}</div>
    );
  },
});

/** The basic elements (2.9): an Image, a Button, a Spacer and a Divider. */
export const elementsComponents: Readonly<Record<string, ComponentDef>> = {
  Image: image,
  Button: button,
  Spacer: spacer,
  Divider: divider,
};
