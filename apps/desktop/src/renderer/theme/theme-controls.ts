import { type ThemeTokens, themeTokensSchema } from "@webforge/model";
import { z } from "zod";

/**
 * A theme token the Theme tab offers as a choice (2.3a, PH2-15): read from the model's theme
 * schema, so a token added there gets its row once it has its words (`theme.token.<path>`, each
 * value's `theme.token.<path>.<value>`, its group's `theme.group.<group>` and
 * `theme.history.<group>`).
 */
export type TokenControl = {
  /** Where it is in the theme: `["spacing"]`, `["buttons", "style"]`. */
  readonly path: readonly [string] | readonly [string, string];
  /** The theme's key it is under (`buttons`): its option group, and its undo step's name. */
  readonly group: string;
  /** Its values in the schema's order, or `toggle` for one that is on or off. */
  readonly values: readonly string[] | "toggle";
};

/**
 * Tokens the Theme tab draws its own way: the preset (switched as a whole), the colours (Brand,
 * Accent…), the fonts and the type scale. `scheme` and `inverse` go with the preset and colours.
 */
const DRAWN_OWN_WAY = new Set<string>([
  "preset",
  "scheme",
  "colors",
  "inverse",
  "fonts",
  "typeScale",
]);

/**
 * The groups in the order the tab shows them, the most visible first; a group the schema gains
 * follows them, in the schema's order.
 */
const GROUP_ORDER = [
  "headings",
  "buttons",
  "links",
  "radius",
  "images",
  "cards",
  "sections",
  "spacing",
  "shadow",
  "border",
  "effects",
];

/** The values a token's schema allows: an enum's, or `toggle` for a boolean. */
function valuesOf(schema: z.core.$ZodType): TokenControl["values"] | undefined {
  if (schema instanceof z.ZodEnum) return schema.options.map(String);
  if (schema instanceof z.ZodBoolean) return "toggle";
  // A token read leniently from older files (links' "never", #427): the values it becomes.
  if (schema instanceof z.ZodPipe) return valuesOf(schema.out);
  return undefined;
}

const rank = (group: string) => {
  const index = GROUP_ORDER.indexOf(group);
  return index === -1 ? GROUP_ORDER.length : index;
};

/** Every token the Theme tab offers as a choice, by group in {@link GROUP_ORDER}. */
export const TOKEN_CONTROLS: readonly TokenControl[] = Object.entries(themeTokensSchema.shape)
  .filter(([key]) => !DRAWN_OWN_WAY.has(key))
  .flatMap(([key, schema]): TokenControl[] => {
    const own = valuesOf(schema);
    if (own !== undefined) return [{ path: [key], group: key, values: own }];
    if (!(schema instanceof z.ZodObject)) return [];
    return Object.entries(schema.shape).flatMap(([inner, innerSchema]): TokenControl[] => {
      const values = valuesOf(innerSchema);
      return values === undefined ? [] : [{ path: [key, inner], group: key, values }];
    });
  })
  // A stable sort: a group's tokens keep the schema's order.
  .sort((a, b) => rank(a.group) - rank(b.group));

/** A token's name in the words' keys: `buttons.style`. */
export const tokenKey = (control: TokenControl) => control.path.join(".");

/** The value of `control`'s token in `theme`. */
export function tokenValue(theme: ThemeTokens, control: TokenControl): unknown {
  const [key, inner] = control.path;
  const value: unknown = (theme as Readonly<Record<string, unknown>>)[key];
  if (inner === undefined) return value;
  return typeof value === "object" && value !== null
    ? (value as Readonly<Record<string, unknown>>)[inner]
    : undefined;
}

/** Sets `control`'s token to `value` in `theme`, a draft being changed. */
export function setTokenValue(theme: ThemeTokens, control: TokenControl, value: unknown): void {
  const [key, inner] = control.path;
  const tokens = theme as Record<string, unknown>;
  if (inner === undefined) {
    tokens[key] = value;
    return;
  }
  const group = tokens[key];
  if (typeof group === "object" && group !== null) {
    (group as Record<string, unknown>)[inner] = value;
  }
}
