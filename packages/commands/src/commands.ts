import { t } from "@webforge/i18n";
import { isResponsiveValue, type SiteDoc, themeTokensSchema } from "@webforge/model";
import { z } from "zod";
import { APP_PARSE } from "./app-errors.js";
import { droppedOwnColourInUse } from "./command-checks.js";
import { ELEMENT_COMMANDS } from "./element-commands.js";
import { PAGE_COMMANDS } from "./page-commands.js";
import { type Failure, fail, type Plan, type PlanSummary } from "./plan.js";
import { planCommand } from "./plan-command.js";
import { updateSettings } from "./settings-command.js";

/** The commands a plan can hold: every command but a plan, in the order AI apps list them. */
const STEPS = {
  ...ELEMENT_COMMANDS,
  ...PAGE_COMMANDS,
  updateSettings,
  /**
   * Sets theme tokens: colours, fonts, corners, spacing… Changes every page (D7). A group it names
   * in part (`{ fonts: { heading } }`) keeps the values it doesn't name (#645), at any depth: one
   * heading's leading alone (`{ typeScale: { h1: { leading } } }`) keeps its size and weight (#1369).
   */
  setThemeTokens: {
    description:
      "Sets theme tokens, as theme gives them. It changes every page, so it waits for the person to allow it. A group named in part keeps the values it doesn't name, at any depth: { typeScale: { h1: { leading: \"normal\" } } } changes only h1's leading. A font is replaced whole, with its family and fallback, and so is a look's value per screen size ({ $responsive: { desktop, tablet, mobile } }). null removes a value that may be left out. A list, such as ownColors, is the whole list: one of your colours the site still uses can't be left out, so change its uses first.",
    input: z.strictObject({
      tokens: z
        .record(z.string(), z.unknown())
        .describe(
          "The tokens to change. Groups (fonts, radius, typeScale and each text style in it, " +
            "looks…) are merged at every depth: what a group leaves out stays as it is.",
        ),
    }),
    summarize(summary: PlanSummary) {
      summary.theme = true;
    },
    plan(site: SiteDoc, input: { tokens: Record<string, unknown> }): Plan | Failure {
      const theme = themeTokensSchema.safeParse(withTokens(site.theme, input.tokens), APP_PARSE);
      if (!theme.success) return fail("invalid", z.prettifyError(theme.error));
      const next = theme.data;
      // One of the person's colours still in use stays: its uses would draw nothing (#1308).
      const dropped = droppedOwnColourInUse(site, next);
      if (dropped !== undefined) return fail("refused", dropped);
      return {
        action: t("ai.history.theme"),
        structural: true,
        kind: "props",
        confirm: (app) => ({
          action: t("ai.confirm.theme", { app }),
          confirm: t("ai.confirm.allow"),
          affectedPages: site.pageOrder.length,
        }),
        recipe: (draft) => {
          draft.theme = structuredClone(next);
        },
      };
    },
  },
} as const;

/**
 * The commands AI apps can run (F-AI-1): each takes its input and plans one undo step; a plan runs
 * several as one (4.12a).
 */
export const COMMANDS = { ...STEPS, plan: planCommand(STEPS) };

/** The name of a command. */
export type CommandName = keyof typeof COMMANDS;

/**
 * Whether `value` is a group of tokens (`fonts`, `radius`…): an object, not a list. A look's value
 * set per screen size (`{ $responsive: … }`) is one value, not a group (#1384).
 */
const isGroup = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !isResponsiveValue(value as Record<string, unknown>);

/**
 * `before` with `after` over it: a group both have is merged, as deep as `depth` says for its key;
 * `null` removes a value, and anything else (a list, a value) replaces what was there. Only
 * `before`'s own groups are merged, and the rest spread, so a `__proto__` key never sets a
 * prototype.
 */
function merged(
  before: object,
  after: Record<string, unknown>,
  depth: (key: string) => number,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...before, ...after };
  for (const [key, value] of Object.entries(after)) {
    const was: unknown = Object.hasOwn(before, key) ? Reflect.get(before, key) : undefined;
    if (value === null) {
      Reflect.deleteProperty(result, key);
    } else if (depth(key) > 0 && isGroup(was) && isGroup(value)) {
      const below = depth(key) - 1;
      result[key] = merged(was, value, () => below);
    }
  }
  return result;
}

/**
 * `theme` with `tokens` over it (#645, #1369): every group is merged at every depth, so a partial
 * `fonts`, or one text style's `leading` in `typeScale`, keeps the values it doesn't name. But a
 * font is one value, its family with its fallback, so it's replaced whole: Lora never keeps the
 * sans-serif fallback of the font before it. So is a look's value per screen size (#1384).
 */
const withTokens = (theme: object, tokens: Record<string, unknown>) =>
  merged(theme, tokens, (key) => (key === "fonts" ? 1 : Number.POSITIVE_INFINITY));
