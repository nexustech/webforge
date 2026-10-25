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

/**
 * Tailwind's shadow scale for each shadow token (#423), which every `shadow-*` class draws from:
 * none at all, Tailwind's own (soft, which needs nothing written), or twice as dark.
 */
const SHADOW_SCALE: Readonly<Record<ThemeTokens["shadow"], Readonly<Record<string, string>>>> = {
  none: {
    "2xs": "0 0 #0000",
    xs: "0 0 #0000",
    sm: "0 0 #0000",
    md: "0 0 #0000",
    lg: "0 0 #0000",
    xl: "0 0 #0000",
    "2xl": "0 0 #0000",
  },
  soft: {},
  strong: {
    "2xs": "0 1px rgb(0 0 0 / 0.1)",
    xs: "0 1px 2px 0 rgb(0 0 0 / 0.1)",
    sm: "0 1px 3px 0 rgb(0 0 0 / 0.2), 0 1px 2px -1px rgb(0 0 0 / 0.2)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.2), 0 2px 4px -2px rgb(0 0 0 / 0.2)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.2), 0 4px 6px -4px rgb(0 0 0 / 0.2)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.2), 0 8px 10px -6px rgb(0 0 0 / 0.2)",
    "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.5)",
  },
};

/**
 * The Shadow hover effect's shadow (2.12), which a person chooses for an element: the theme's
 * large shadow, or Tailwind's own where the theme has none, so the effect never disappears.
 */
const HOVER_SHADOW: Readonly<Record<ThemeTokens["shadow"], string>> = {
  none: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  soft: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  strong: "0 10px 15px -3px rgb(0 0 0 / 0.2), 0 4px 6px -4px rgb(0 0 0 / 0.2)",
};

/**
 * A raised card's shadow (2.13d): the theme's medium shadow, or Tailwind's own where the theme has
 * none, so a raised card never looks flat.
 */
const RAISED_SHADOW: Readonly<Record<ThemeTokens["shadow"], string>> = {
  none: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  soft: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  strong: "0 4px 6px -1px rgb(0 0 0 / 0.2), 0 2px 4px -2px rgb(0 0 0 / 0.2)",
};

/** Headings' letter spacing for each tracking token (2.13d). */
const HEADING_TRACKING: Readonly<Record<ThemeTokens["headings"]["tracking"], number>> = {
  tight: -0.02,
  normal: 0,
  wide: 0.04,
};

/** Titles in the heading font: headings 1–6, whatever the element that sets them. */
const TITLES = ":is(h1, h2, h3, h4, h5, h6).font-heading";

/** The letter spacing capitals and small capitals add, which they need to read well (2.13d). */
const CAPS_TRACKING = 0.06;

/** A photo's corners for each corner token (2.13d); `rounded` keeps the box corners. */
const IMAGE_RADIUS: Readonly<Record<ThemeTokens["images"]["corners"], string | undefined>> = {
  square: "0",
  rounded: undefined,
  soft: "1.5rem",
};

/**
 * The sections every second one of a page is (2.13d): on the exported page, `main`'s; on the
 * canvas, those in the page's drop zone (`wf-sections`), where each is in a wrapper of its own.
 * Not a section on reversed colours, which keeps its own.
 */
const EVEN_SECTIONS =
  ":is(#main > section:nth-child(even), .wf-sections > :nth-child(even) > section):not([data-theme])";

/** daisyUI's look the theme gives its main buttons (#423): their own, or outline or ghost. */
const BUTTON_LOOK: Readonly<Record<ThemeTokens["buttons"]["style"], string | undefined>> = {
  filled: undefined,
  outline: "btn-outline",
  ghost: "btn-ghost",
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
 * The buttons as the theme draws them (#423), whatever a component's classes: every button's
 * corners square or pill if its shape says so (rounded keeps the theme's field corners, as
 * buttons always had), the default size's height in its size (daisyUI's own variables, on the
 * button, so fields keep theirs; icon buttons and the small and large sizes keep their own), and
 * the main buttons in its style, as daisyUI's outline or ghost buttons, hover included; never a
 * Button set to Filled (`wf-filled`, PH2-14).
 */
function buttonRules(tokens: ThemeTokens): string[] {
  const look = BUTTON_LOOK[tokens.buttons.style];
  return [
    "@layer utilities {",
    ...(tokens.buttons.shape === "rounded"
      ? []
      : [
          "  .btn:not(.btn-circle, .btn-square) {",
          "    --radius-field: var(--wf-button-radius);",
          "  }",
        ]),
    "  .btn:not(.btn-xs, .btn-sm, .btn-md, .btn-lg, .btn-xl, .btn-circle, .btn-square) {",
    "    --size: var(--wf-button-height);",
    "  }",
    ...(look === undefined
      ? []
      : [
          "  .btn-primary:not(.btn-outline, .btn-ghost, .btn-link, .wf-filled) {",
          `    @apply ${look};`,
          "  }",
          // On a dark band (the Call to action, a Hero over its photo), in the band's text colour.
          "  .bg-neutral .btn-primary:not(.btn-outline, .btn-ghost, .btn-link, .wf-filled) {",
          "    --btn-color: var(--color-neutral-content);",
          "    --btn-fg: var(--color-neutral);",
          "  }",
        ]),
    "}",
  ];
}

/**
 * The theme's style (2.13d, PH2-15), each only when it isn't as every site always looked, so the
 * default theme's stylesheet is as it was:
 * - headings (titles in the heading font) in capitals or small capitals, and their tracking;
 * - cards (`wf-card`: Features, Stats, Team and Testimonials) outlined or raised on the page's
 *   surface instead of flat on the second one;
 * - photos (an `img` with the box corners) square or softer;
 * - every second section on the second surface, under the classes of sections that have colours
 *   of their own (`@layer components`), with flat cards on the page's surface there.
 */
function styleRules(tokens: ThemeTokens): string[] {
  const { headings, cards, images, sections } = tokens;
  const caps = headings.case !== "normal";
  const tracking = HEADING_TRACKING[headings.tracking] + (caps ? CAPS_TRACKING : 0);
  const heading = [
    ...(headings.case === "uppercase" ? ["    text-transform: uppercase;"] : []),
    ...(headings.case === "small-caps" ? ["    font-variant-caps: all-small-caps;"] : []),
    ...(tracking === 0 ? [] : [`    letter-spacing: ${Number(tracking.toFixed(2))}em;`]),
  ];
  const card =
    cards.style === "outlined"
      ? ["    border: var(--border) solid var(--color-base-300);"]
      : cards.style === "raised"
        ? [`    box-shadow: ${RAISED_SHADOW[tokens.shadow]};`]
        : [];
  const imageRadius = IMAGE_RADIUS[images.corners];
  const alternating = sections.rhythm === "alternating";
  const utilities = [
    // Titles, never a pull quote or a price in the heading font.
    ...(heading.length === 0 ? [] : [`  ${TITLES} {`, ...heading, "  }"]),
    // `section` outweighs the cards' own background class.
    ...(card.length === 0
      ? []
      : ["  section .wf-card {", "    background-color: var(--color-base-100);", ...card, "  }"]),
    ...(imageRadius === undefined
      ? []
      : ["  img.rounded-box {", `    border-radius: ${imageRadius};`, "  }"]),
    ...(alternating && cards.style === "flat"
      ? [`  ${EVEN_SECTIONS} .wf-card {`, "    background-color: var(--color-base-100);", "  }"]
      : []),
  ];
  return [
    ...(alternating
      ? [
          "@layer components {",
          `  ${EVEN_SECTIONS} {`,
          "    background-color: var(--color-base-200);",
          "  }",
          "}",
        ]
      : []),
    ...(utilities.length === 0 ? [] : ["@layer utilities {", ...utilities, "}"]),
  ];
}

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
 * - the shadow scale (`shadow-*`), the links' underline and the buttons' shape and height as
 *   `--wf-*` variables, which running text and the buttons' rules below use (#423);
 * - the buttons in the theme's shape, size and style ({@link buttonRules});
 * - its headings, cards, photos and sections' rhythm ({@link styleRules}).
 *
 * Every value is a token the model checked, so nothing from a site can reach the CSS as written.
 */
export function themeCss(tokens: ThemeTokens): string {
  const inverse = inverseColors(tokens);
  // Links not always underlined are in the main colour, apart from the text (WCAG 1.4.1).
  const linkColor = tokens.links.underline === "always" ? "currentColor" : "var(--color-primary)";
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
    ...Object.entries(SHADOW_SCALE[tokens.shadow]).map(
      ([step, shadow]) => `  --shadow-${step}: ${shadow};`,
    ),
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
    // Underlined on hover and focus whatever the theme says: a link must show it's one (WCAG
    // 1.4.1), and in the main colour when it isn't always underlined, apart from the text.
    "  --wf-link-hover-decoration: underline;",
    `  --wf-link-color: ${linkColor};`,
    `  --wf-hover-shadow: ${HOVER_SHADOW[tokens.shadow]};`,
    `  --wf-button-radius: ${BUTTON_RADIUS[tokens.buttons.shape]};`,
    `  --wf-button-height: ${BUTTON_HEIGHT[tokens.buttons.size]};`,
    ...roleShades(tokens.colors),
    "}",
    `[data-theme="${INVERSE_THEME}"] {`,
    // Declared again, so its main colour is the inverse one: a custom property inherits as
    // its value, already resolved with the page's colours.
    `  --wf-link-color: ${linkColor};`,
    ...roleShades(inverse),
    "}",
    ...buttonRules(tokens),
    ...styleRules(tokens),
  ].join("\n");
}
