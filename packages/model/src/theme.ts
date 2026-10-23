import { z } from "zod";

/**
 * A site's theme (2.1, F-DS-1): the design tokens every page is styled from, which the themes
 * package turns into the site's daisyUI theme and Tailwind settings. People change them in the
 * Theme panel (2.3) and Theme Studio (F-DS-7); each change is one undo step.
 */

/**
 * daisyUI's colour roles, which the theme keeps (decision of 23 Oct 2026). The editor names them
 * for people: Brand (primary), Accent (secondary, accent), Surface (base) and Text (base-content).
 */
export const COLOR_ROLES = [
  "base-100",
  "base-200",
  "base-300",
  "base-content",
  "primary",
  "primary-content",
  "secondary",
  "secondary-content",
  "accent",
  "accent-content",
  "neutral",
  "neutral-content",
  "info",
  "info-content",
  "success",
  "success-content",
  "warning",
  "warning-content",
  "error",
  "error-content",
] as const;

/** One of {@link COLOR_ROLES}. */
export type ColorRole = (typeof COLOR_ROLES)[number];

/** A colour in OKLCH, as daisyUI 5 writes them: lightness 0–1, chroma, hue in degrees. */
export const oklchSchema = z.strictObject({
  l: z.number().min(0).max(1),
  c: z.number().min(0).max(0.5),
  h: z.number().min(0).max(360),
});

/** See {@link oklchSchema}. */
export type Oklch = z.infer<typeof oklchSchema>;

const colorRoleSchema = z.enum(COLOR_ROLES);

/** A font the theme uses, by family name, and the kind of font to fall back on. */
export const fontRefSchema = z.strictObject({
  family: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/),
  fallback: z.enum(["sans-serif", "serif", "monospace"]),
});

/** See {@link fontRefSchema}. */
export type FontRef = z.infer<typeof fontRefSchema>;

/** Corner sizes, smallest first (C4: people choose a size, never a value). */
export const RADIUS_TOKENS = ["none", "s", "m", "l", "xl", "full"] as const;

/** Text sizes, smallest first, as Tailwind names them. */
export const TEXT_SIZES = [
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
] as const;

/** The text styles the type scale sets: headings 1–6, body text and small print. */
export const TEXT_STYLES = ["h1", "h2", "h3", "h4", "h5", "h6", "body", "small"] as const;

/** One of {@link TEXT_STYLES}. */
export type TextStyle = (typeof TEXT_STYLES)[number];

const radiusSchema = z.enum(RADIUS_TOKENS);

/** How one text style looks: its size, weight and line height. */
const textStepSchema = z.strictObject({
  size: z.enum(TEXT_SIZES),
  weight: z.number().int().min(300).max(800).multipleOf(100),
  leading: z.enum(["tight", "normal", "relaxed"]),
});

/** See {@link themeTokensSchema}. */
export const themeTokensSchema = z.strictObject({
  /** The preset the theme started from ("light"): the name it is listed under. */
  preset: z
    .string()
    .max(40)
    .regex(/^[a-z][a-z0-9-]*$/),
  /** Whether the page is light or dark: how the browser draws scrollbars and form controls. */
  scheme: z.enum(["light", "dark"]),
  /** Every colour role, for the page. */
  colors: z.record(colorRoleSchema, oklchSchema),
  /** Every colour role again, for dark sections (2.4), if the theme has them. */
  dark: z.record(colorRoleSchema, oklchSchema).optional(),
  fonts: z.strictObject({ heading: fontRefSchema, body: fontRefSchema }),
  /** Corners: of boxes (cards), fields (inputs, buttons) and selectors (checkboxes, badges). */
  radius: z.strictObject({ box: radiusSchema, field: radiusSchema, selector: radiusSchema }),
  /** How wide borders are: 1 or 2 pixels. */
  border: z.enum(["thin", "thick"]),
  /** daisyUI's depth (a slight 3D look on buttons and fields) and noise (a grain on surfaces). */
  effects: z.strictObject({ depth: z.boolean(), noise: z.boolean() }),
  /** How much room there is around and between things. */
  spacing: z.enum(["compact", "normal", "roomy"]),
  /** The type scale: each text style's size, weight and line height. */
  typeScale: z.record(z.enum(TEXT_STYLES), textStepSchema),
  /** Links in text. */
  links: z.strictObject({ underline: z.enum(["always", "hover", "never"]) }),
  buttons: z.strictObject({
    shape: z.enum(["square", "rounded", "pill"]),
    size: z.enum(["s", "m", "l"]),
    style: z.enum(["filled", "outline", "ghost"]),
  }),
  /** The shadow scale: how strong shadows are, if any. */
  shadow: z.enum(["none", "soft", "strong"]),
});

/** The site's theme tokens; see {@link themeTokensSchema}. */
export type ThemeTokens = z.infer<typeof themeTokensSchema>;

/** A copy of `theme` that shares nothing with it. */
export const copyTheme = (theme: ThemeTokens): ThemeTokens =>
  JSON.parse(JSON.stringify(theme)) as ThemeTokens;

/** `value`, with it and everything in it frozen: shared defaults can't be changed by mistake. */
function frozen<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const inner of Object.values(value)) frozen(inner);
    Object.freeze(value);
  }
  return value;
}

/**
 * The tokens a new site starts with: the "light" preset, whose colours are daisyUI's light
 * theme's, so a site looks as it did when its theme was daisyUI's own. Frozen: copy it to change
 * it ({@link copyTheme}).
 */
export const DEFAULT_THEME: ThemeTokens = frozen({
  preset: "light",
  scheme: "light",
  colors: {
    "base-100": { l: 1, c: 0, h: 0 },
    "base-200": { l: 0.98, c: 0, h: 0 },
    "base-300": { l: 0.95, c: 0, h: 0 },
    "base-content": { l: 0.21, c: 0.006, h: 285.885 },
    primary: { l: 0.45, c: 0.24, h: 277.023 },
    "primary-content": { l: 0.93, c: 0.034, h: 272.788 },
    secondary: { l: 0.65, c: 0.241, h: 354.308 },
    "secondary-content": { l: 0.94, c: 0.028, h: 342.258 },
    accent: { l: 0.77, c: 0.152, h: 181.912 },
    "accent-content": { l: 0.38, c: 0.063, h: 188.416 },
    neutral: { l: 0.14, c: 0.005, h: 285.823 },
    "neutral-content": { l: 0.92, c: 0.004, h: 286.32 },
    info: { l: 0.74, c: 0.16, h: 232.661 },
    "info-content": { l: 0.29, c: 0.066, h: 243.157 },
    success: { l: 0.76, c: 0.177, h: 163.223 },
    "success-content": { l: 0.37, c: 0.077, h: 168.94 },
    warning: { l: 0.82, c: 0.189, h: 84.429 },
    "warning-content": { l: 0.41, c: 0.112, h: 45.904 },
    error: { l: 0.71, c: 0.194, h: 13.428 },
    "error-content": { l: 0.27, c: 0.105, h: 12.094 },
  },
  dark: {
    "base-100": { l: 0.2533, c: 0.016, h: 252.42 },
    "base-200": { l: 0.2326, c: 0.014, h: 253.1 },
    "base-300": { l: 0.2115, c: 0.012, h: 254.09 },
    "base-content": { l: 0.97807, c: 0.029, h: 256.847 },
    primary: { l: 0.58, c: 0.233, h: 277.117 },
    "primary-content": { l: 0.96, c: 0.018, h: 272.314 },
    secondary: { l: 0.65, c: 0.241, h: 354.308 },
    "secondary-content": { l: 0.94, c: 0.028, h: 342.258 },
    accent: { l: 0.77, c: 0.152, h: 181.912 },
    "accent-content": { l: 0.38, c: 0.063, h: 188.416 },
    neutral: { l: 0.14, c: 0.005, h: 285.823 },
    "neutral-content": { l: 0.92, c: 0.004, h: 286.32 },
    info: { l: 0.74, c: 0.16, h: 232.661 },
    "info-content": { l: 0.29, c: 0.066, h: 243.157 },
    success: { l: 0.76, c: 0.177, h: 163.223 },
    "success-content": { l: 0.37, c: 0.077, h: 168.94 },
    warning: { l: 0.82, c: 0.189, h: 84.429 },
    "warning-content": { l: 0.41, c: 0.112, h: 45.904 },
    error: { l: 0.71, c: 0.194, h: 13.428 },
    "error-content": { l: 0.27, c: 0.105, h: 12.094 },
  },
  fonts: {
    heading: { family: "Inter", fallback: "sans-serif" },
    body: { family: "Inter", fallback: "sans-serif" },
  },
  radius: { box: "m", field: "s", selector: "m" },
  border: "thin",
  effects: { depth: true, noise: false },
  spacing: "normal",
  typeScale: {
    h1: { size: "5xl", weight: 700, leading: "tight" },
    h2: { size: "3xl", weight: 700, leading: "tight" },
    h3: { size: "xl", weight: 600, leading: "tight" },
    h4: { size: "lg", weight: 600, leading: "normal" },
    h5: { size: "base", weight: 600, leading: "normal" },
    h6: { size: "sm", weight: 600, leading: "normal" },
    body: { size: "lg", weight: 400, leading: "relaxed" },
    small: { size: "sm", weight: 400, leading: "normal" },
  },
  links: { underline: "always" },
  buttons: { shape: "rounded", size: "m", style: "filled" },
  shadow: "soft",
});
