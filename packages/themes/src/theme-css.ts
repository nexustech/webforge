import {
  COLOR_ROLES,
  type FontRef,
  INVERSE_THEME,
  type Oklch,
  SHADE_STEPS,
  SHADED_ROLES,
  TEXT_SIZES,
  TEXT_STYLES,
  type ThemeTokens,
} from "@webforge/model";
import { inverseColors, shadeOf } from "./colors.js";

/** Each corner token in CSS, as daisyUI's own themes use them. */
const RADIUS: Readonly<Record<ThemeTokens["radius"]["box"], string>> = {
  none: "0rem",
  s: "0.25rem",
  m: "0.5rem",
  l: "1rem",
  xl: "2rem",
  full: "9999px",
};

/** Each text size token in CSS, as Tailwind's own scale has them. */
const TEXT_SIZE: Readonly<Record<ThemeTokens["typeScale"]["h1"]["size"], string>> = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
  "4xl": "2.25rem",
  "5xl": "3rem",
  "6xl": "3.75rem",
};

const LEADING: Readonly<Record<ThemeTokens["typeScale"]["h1"]["leading"], string>> = {
  tight: "1.25",
  normal: "1.5",
  relaxed: "1.625",
};

/** Narrower than this, a page is on a phone: Tailwind's `md`, where layouts change. */
const PHONE_WIDTH = "48rem";

/** The largest page title on a phone: a 375 px screen fits a few words of it per line. */
const PHONE_H1_MAX = "4xl";

/** Tailwind's spacing unit for each spacing token: every padding, margin and gap scales with it. */
const SPACING_UNIT: Readonly<Record<ThemeTokens["spacing"], string>> = {
  compact: "0.225rem",
  normal: "0.25rem",
  roomy: "0.275rem",
};

const BUTTON_RADIUS: Readonly<Record<ThemeTokens["buttons"]["shape"], string>> = {
  square: "0rem",
  rounded: "0.5rem",
  pill: "9999px",
};

const BUTTON_HEIGHT: Readonly<Record<ThemeTokens["buttons"]["size"], string>> = {
  s: "2rem",
  m: "2.5rem",
  l: "3rem",
};

const SHADOW: Readonly<Record<ThemeTokens["shadow"], string>> = {
  none: "none",
  soft: "0 4px 12px rgb(0 0 0 / 0.08)",
  strong: "0 10px 30px rgb(0 0 0 / 0.2)",
};

const FALLBACKS: Readonly<Record<FontRef["fallback"], string>> = {
  "sans-serif": "ui-sans-serif, system-ui, sans-serif",
  serif: "ui-serif, Georgia, serif",
  monospace: "ui-monospace, monospace",
};

/** `color` as daisyUI writes it: `oklch(55% 0.2 30)`. */
export function oklchCss({ l, c, h }: Oklch): string {
  const round = (value: number, places: number) => Number(value.toFixed(places));
  return `oklch(${round(l * 100, 3)}% ${round(c, 4)} ${round(h, 3)})`;
}

/** `font` as a CSS font stack. The model's family names never contain `"`, `\` or `;`. */
const fontStack = (font: FontRef) => `"${font.family}", ${FALLBACKS[font.fallback]}`;

/** One daisyUI theme of `tokens`, with `colors`, by `name`. */
function daisyTheme(
  tokens: ThemeTokens,
  name: string,
  colors: ThemeTokens["colors"],
  options: { readonly default: boolean; readonly scheme: ThemeTokens["scheme"] },
): string {
  return [
    '@plugin "daisyui/theme" {',
    `  name: "${name}";`,
    `  default: ${options.default};`,
    `  color-scheme: ${options.scheme};`,
    ...COLOR_ROLES.map((role) => `  --color-${role}: ${oklchCss(colors[role])};`),
    `  --radius-selector: ${RADIUS[tokens.radius.selector]};`,
    `  --radius-field: ${RADIUS[tokens.radius.field]};`,
    `  --radius-box: ${RADIUS[tokens.radius.box]};`,
    // The same in every daisyUI theme.
    "  --size-selector: 0.25rem;",
    "  --size-field: 0.25rem;",
    `  --border: ${tokens.border === "thick" ? "2px" : "1px"};`,
    `  --depth: ${tokens.effects.depth ? 1 : 0};`,
    `  --noise: ${tokens.effects.noise ? 1 : 0};`,
    "}",
  ].join("\n");
}

/** The colour roles' shades in `colors`, as the variables the shade utilities read. */
const roleShades = (colors: ThemeTokens["colors"]) =>
  SHADED_ROLES.flatMap((role) =>
    SHADE_STEPS.map(
      (step) => `  --wf-color-${role}-${step}: ${oklchCss(shadeOf(colors[role], step))};`,
    ),
  );

/** Whether `colors` make a dark page: a dark surface. */
const schemeOf = (colors: ThemeTokens["colors"]): ThemeTokens["scheme"] =>
  colors["base-100"].l < 0.5 ? "dark" : "light";

/**
 * The site's theme as Tailwind and daisyUI source (2.1), for the site's stylesheet after Tailwind's
 * own imports:
 * - daisyUI with none of its built-in themes, and the site's own: every colour role, the corners,
 *   the border, depth and noise, named after the preset and the page's default;
 * - a second theme for sections that invert the page (`INVERSE_THEME`, 2.4): the theme's
 *   inverse colours, or its fallback (`inverseColors`);
 * - Tailwind's `@theme`: the fonts (`font-sans` for body text, `font-heading`), the spacing unit
 *   every padding, margin and gap is measured in, the type scale as `text-h1` … `text-small`, each
 *   with its weight and line height;
 * - shades 50–950 of the colour roles (`primary-300`), read where they're used (`@theme inline`)
 *   from variables each theme sets, so they follow inverse sections. They're fixed values: Safari
 *   16.4–17 can't compute relative colours;
 * - the links' underline, the buttons' shape and height, and the shadow, as `--wf-*` variables
 *   components style with (the buttons' style picks their daisyUI classes instead).
 *
 * Every value is a token the model checked, so nothing from a site can reach the CSS as written.
 */
export function themeCss(tokens: ThemeTokens): string {
  const inverse = inverseColors(tokens);
  // On phones the page title is a size smaller (#419), and never above 4xl, so a display size
  // (a 6xl title) doesn't overflow a phone's width; the default theme's 5xl is 4xl there.
  const h1 = TEXT_SIZES.indexOf(tokens.typeScale.h1.size);
  const phoneStep = Math.min(Math.max(h1 - 1, 0), TEXT_SIZES.indexOf(PHONE_H1_MAX));
  const phoneH1 = TEXT_SIZE[TEXT_SIZES[phoneStep] ?? tokens.typeScale.h1.size];
  const themes = [
    daisyTheme(tokens, tokens.preset, tokens.colors, { default: true, scheme: tokens.scheme }),
    daisyTheme(tokens, INVERSE_THEME, inverse, {
      default: false,
      scheme: schemeOf(inverse),
    }),
  ];
  const typeScale = TEXT_STYLES.flatMap((style) => {
    const step = tokens.typeScale[style];
    return [
      `  --text-${style}: ${TEXT_SIZE[step.size]};`,
      `  --text-${style}--line-height: ${LEADING[step.leading]};`,
      `  --text-${style}--font-weight: ${step.weight};`,
    ];
  });
  return [
    '@plugin "daisyui" { themes: false; }',
    ...themes,
    "@theme {",
    `  --font-sans: ${fontStack(tokens.fonts.body)};`,
    `  --font-heading: ${fontStack(tokens.fonts.heading)};`,
    `  --spacing: ${SPACING_UNIT[tokens.spacing]};`,
    ...typeScale,
    "}",
    `@media (width < ${PHONE_WIDTH}) {`,
    "  :root {",
    `    --text-h1: ${phoneH1};`,
    "  }",
    "}",
    "@theme inline {",
    ...SHADED_ROLES.flatMap((role) =>
      SHADE_STEPS.map((step) => `  --color-${role}-${step}: var(--wf-color-${role}-${step});`),
    ),
    "}",
    `:root, [data-theme="${tokens.preset}"] {`,
    `  --wf-link-decoration: ${tokens.links.underline === "always" ? "underline" : "none"};`,
    `  --wf-link-hover-decoration: ${tokens.links.underline === "never" ? "none" : "underline"};`,
    `  --wf-button-radius: ${BUTTON_RADIUS[tokens.buttons.shape]};`,
    `  --wf-button-height: ${BUTTON_HEIGHT[tokens.buttons.size]};`,
    `  --wf-shadow: ${SHADOW[tokens.shadow]};`,
    ...roleShades(tokens.colors),
    "}",
    `[data-theme="${INVERSE_THEME}"] {`,
    ...roleShades(inverse),
    "}",
  ].join("\n");
}
