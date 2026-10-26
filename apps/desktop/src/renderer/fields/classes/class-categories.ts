/** The class browser's categories (#276), in its order; each a name in the glossary. */
export const CLASS_CATEGORIES = [
  "components",
  "colours",
  "borders",
  "spacing",
  "size",
  "layout",
  "typography",
  "effects",
] as const;

/** One of {@link CLASS_CATEGORIES}. */
export type ClassCategory = (typeof CLASS_CATEGORIES)[number];

/** The theme's colour roles, as class names end with them: their classes come first. */
const THEME_COLOURS =
  "(?:primary|secondary|accent|neutral|base-100|base-200|base-300|base-content|info|success|warning|error)(?:-content)?";

/**
 * How a class is put in a category: by how it starts. The first rule that matches wins, so daisyUI's
 * components (`btn`, `card`) and the colours (`bg-primary`, `text-red-500`) come before the rules
 * their names would also match.
 */
const RULES: readonly (readonly [ClassCategory, RegExp])[] = [
  [
    "components",
    /^(?:alert|avatar|badge|breadcrumbs|btn|card|carousel|chat|checkbox|collapse|countdown|diff|divider|dock|drawer|dropdown|fieldset|file-input|filter|footer|hero|indicator|input|join|kbd|label|link|list|loading|mask|menu|mockup|modal|navbar|progress|radial-progress|radio|range|rating|select|skeleton|stack|stat|status|steps|swap|tab|table|tabs|textarea|timeline|toast|toggle|tooltip|validator)(?:-|$)/,
  ],
  [
    "colours",
    /^(?:bg|text|border|outline|ring|fill|stroke|from|via|to|accent|caret|decoration|divide|shadow|placeholder)-(?:primary|secondary|accent|neutral|base|info|success|warning|error|black|white|transparent|current|inherit|[a-z]+-\d{2,3})(?:-|$|\/)/,
  ],
  ["borders", /^(?:border|rounded|outline|ring|divide)(?:-|$)/],
  [
    "spacing",
    /^-?(?:p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y)-/,
  ],
  ["size", /^(?:w|h|min-w|min-h|max-w|max-h|size)-/],
  [
    "layout",
    /^(?:flex|grid|inline|block|hidden|contents|items|justify|content|self|place|order|col|row|basis|grow|shrink|columns|container|absolute|relative|fixed|sticky|static|inset|top|right|bottom|left|z|overflow|float|clear|isolate|object|aspect|table)(?:-|$)/,
  ],
  [
    "typography",
    /^(?:text|font|leading|tracking|italic|not-italic|underline|overline|no-underline|line-through|uppercase|lowercase|capitalize|normal-case|truncate|whitespace|break|indent|list|align|antialiased|subpixel-antialiased)(?:-|$)/,
  ],
  [
    "effects",
    /^(?:shadow|opacity|blur|brightness|contrast|grayscale|invert|saturate|sepia|drop-shadow|transition|duration|ease|delay|animate|transform|scale|rotate|translate|skew|mix-blend|bg-blend|backdrop|filter|cursor|pointer-events|select)(?:-|$)/,
  ],
];

/** The category class `name` is browsed under, or undefined (it's still found by searching). */
export function classCategory(name: string): ClassCategory | undefined {
  return RULES.find(([, rule]) => rule.test(name))?.[0];
}

const THEME_COLOUR = new RegExp(`-${THEME_COLOURS}(?:$|/)`);

/** Whether class `name` uses one of the theme's colours (`bg-primary`, `text-base-content`). */
export const usesThemeColour = (name: string) => THEME_COLOUR.test(name);
