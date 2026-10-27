import { t } from "@webforge/i18n";
import {
  type Breakpoint,
  type ImageValue,
  imageValueSchema,
  isResponsiveValue,
  type Responsive,
  resolveResponsive,
} from "@webforge/model";
import { APPEARANCE_GROUP } from "./appearance.js";
import { Picture } from "./picture.js";
import type { FieldDef, RenderContext } from "./schema.js";

/** How strongly the overlay covers a section's background image, weakest first (ST-5). */
export const OVERLAYS = ["0", "20", "40", "60", "80"] as const;
type Overlay = (typeof OVERLAYS)[number];

/** The overlay's colour: the theme's page colour (`base-100`) or its neutral one. */
const OVERLAY_COLORS = ["base", "neutral"] as const;
type OverlayColor = (typeof OVERLAY_COLORS)[number];

/**
 * A new section's overlay, and the one a value it doesn't know falls back to: strong, in the
 * page's colour. For a section given an image without the Edit panel (a document, an AI app's
 * command); the panel starts a first image's overlay at what the site's theme needs (ST-9).
 */
export const BACKGROUND_DEFAULTS = { overlay: "60", overlayColor: "base" } as const;

/** The overlay's controls: in the Style tab's Appearance group, beside the background colour (2.22). */
const IN_GROUP = { group: "style", optionGroup: APPEARANCE_GROUP } as const;

/**
 * A section's background image (2.26, ST-5): an image from Media behind its content (in the
 * Content tab, as images are content), with its focal point kept in view, and an overlay over it
 * in the theme's page or neutral colour, so the text on it stays readable. The same on every
 * section (defineSection's frame); its classes come from {@link backgroundClasses}, and
 * {@link SectionBackground} draws the image and overlay.
 */
export const BACKGROUND_FIELDS = {
  backgroundImage: {
    kind: "media",
    label: t("field.backgroundImage"),
    help: t("field.backgroundImage.help"),
    // An image is content (C4): Content mode can swap it, as it can the Hero's.
    group: "content",
  },
  overlay: {
    kind: "slider",
    label: t("field.overlay"),
    help: t("field.overlay.help"),
    ...IN_GROUP,
    steps: OVERLAYS.map((value) => ({ label: t(`field.overlay.${value}`), value })),
  },
  overlayColor: {
    kind: "select",
    label: t("field.overlayColor"),
    ...IN_GROUP,
    options: OVERLAY_COLORS.map((value) => ({ label: t(`field.overlayColor.${value}`), value })),
  },
} as const satisfies Readonly<Record<string, FieldDef>>;

/** The names of {@link BACKGROUND_FIELDS}, which a section using them mustn't declare itself. */
export const BACKGROUND_FIELD_NAMES = Object.keys(BACKGROUND_FIELDS) as readonly (
  | "backgroundImage"
  | "overlay"
  | "overlayColor"
)[];

/** The background fields' values among a section's, as its render or the document has them. */
type BackgroundValues = {
  readonly backgroundImage?: unknown;
  readonly overlay?: unknown;
  readonly overlayColor?: unknown;
  readonly [field: string]: unknown;
};

/** The image field's value, checked as every image field's is; `undefined` for none. */
const placedImage = (value: unknown): ImageValue | undefined => {
  const parsed = imageValueSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

/** The overlay's strength and colour, the defaults for a value it doesn't know. */
export function overlayOf(values: BackgroundValues): {
  readonly opacity: Overlay;
  readonly color: OverlayColor;
} {
  return {
    opacity: OVERLAYS.find((each) => each === values.overlay) ?? BACKGROUND_DEFAULTS.overlay,
    color:
      OVERLAY_COLORS.find((each) => each === values.overlayColor) ??
      BACKGROUND_DEFAULTS.overlayColor,
  };
}

/**
 * Each overlay's classes, written out whole so the site's stylesheet finds them in the pages. Over
 * the neutral colour, the section's text takes neutral's content colour.
 */
const OVERLAY_CLASSES: Readonly<Record<OverlayColor, Readonly<Record<Overlay, string>>>> = {
  base: {
    "0": "",
    "20": "bg-base-100/20",
    "40": "bg-base-100/40",
    "60": "bg-base-100/60",
    "80": "bg-base-100/80",
  },
  neutral: {
    "0": "",
    "20": "bg-neutral/20",
    "40": "bg-neutral/40",
    "60": "bg-neutral/60",
    "80": "bg-neutral/80",
  },
};

/** Whether `values` place a background image. */
const hasBackground = (values: BackgroundValues) =>
  placedImage(values.backgroundImage) !== undefined;

/**
 * The frame's classes for its background, or "" for none: a stacking context the image and overlay sit at the back of, cut to the section; over the
 * neutral colour, its content colour for the text.
 */
export function backgroundClasses(values: BackgroundValues): string {
  if (!hasBackground(values)) return "";
  const { color } = overlayOf(values);
  return `relative isolate overflow-hidden${color === "neutral" ? " text-neutral-content" : ""}`;
}

/**
 * The background image and its overlay, behind the section's content (2.26): a responsive
 * `<picture>` (WebP with a JPEG or PNG fallback, X2), loaded lazily below the fold and at once in
 * the page's first section (`eager`), as the Hero's is, cut to the section with its focal point
 * kept in view, and no CSS `background-image`, so the image pipeline's sizes apply. Nothing when
 * there's no image, or it was deleted from Media.
 */
export function SectionBackground({
  values,
  context,
  eager = false,
}: {
  readonly values: BackgroundValues;
  readonly context: RenderContext;
  readonly eager?: boolean;
}) {
  const placed = placedImage(values.backgroundImage);
  const image = placed === undefined ? null : context.image(placed.mediaId);
  if (image === null) return null;
  const { opacity, color } = overlayOf(values);
  const overlay = OVERLAY_CLASSES[color][opacity];
  return (
    <>
      {/* Decorative, whatever alt text the image has: what the section says is in its content. */}
      <Picture
        image={image}
        alt=""
        sizes="100vw"
        eager={eager}
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      />
      {overlay === "" ? null : (
        <div aria-hidden="true" className={`absolute inset-0 -z-10 ${overlay}`} />
      )}
    </>
  );
}

/**
 * The overlay a section's values draw, for the contrast check of its text over it (2.26: the
 * themes package's `overlayContrastIssue`), or `null` without a background image. A reversed
 * section (2.4) is checked in the reversed colours, and a text colour the person set (the
 * Appearance group's Colour, on any device) as well as the overlay colour's own.
 */
export function sectionOverlay(values: BackgroundValues): {
  readonly color: OverlayColor;
  readonly opacity: number;
  readonly inverse: boolean;
  readonly text: readonly (string | undefined)[];
} | null {
  if (!hasBackground(values)) return null;
  const { opacity, color } = overlayOf(values);
  return {
    color,
    opacity: Number(opacity) / 100,
    inverse: values.colors === "inverse",
    text: textColorsOf(values.lookColor),
  };
}

/**
 * A section's text colour on each device, from its Appearance group's Colour (set once or per
 * device): a colour ref, or `undefined` where it keeps its own ("default", or none).
 */
function textColorsOf(value: unknown): (string | undefined)[] {
  const one = (each: unknown) =>
    typeof each === "string" && each !== "default" ? each : undefined;
  if (!isResponsiveValue(value as Responsive<unknown>)) return [one(value)];
  const devices: readonly Breakpoint[] = ["mobile", "tablet", "desktop"];
  return devices.map((device) => one(resolveResponsive(value as Responsive<unknown>, device)));
}
