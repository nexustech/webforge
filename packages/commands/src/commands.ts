import { t } from "@webforge/i18n";
import { type SiteDoc, themeTokensSchema } from "@webforge/model";
import { z } from "zod";
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
   * in part (`{ fonts: { heading } }`) keeps the values it doesn't name (#645).
   */
  setThemeTokens: {
    description:
      "Sets theme tokens, as theme gives them. It changes every page, so it waits for the person to allow it. A group named in part keeps the values it doesn't name.",
    input: z.strictObject({
      tokens: z
        .record(z.string(), z.unknown())
        .describe(
          "The tokens to change. Nested groups (fonts, radius, typeScale…) are merged one level " +
            "deep: what a group leaves out stays as it is.",
        ),
    }),
    summarize(summary: PlanSummary) {
      summary.theme = true;
    },
    plan(site: SiteDoc, input: { tokens: Record<string, unknown> }): Plan | Failure {
      const theme = themeTokensSchema.safeParse(withTokens(site.theme, input.tokens));
      if (!theme.success) return fail("invalid", z.prettifyError(theme.error));
      const next = theme.data;
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

/** Whether `value` is a group of tokens (`fonts`, `radius`…): an object, not a list. */
const isGroup = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * `theme` with `tokens` over it: a group both have is merged one level deep, so a partial `fonts`
 * or `radius` keeps the values it doesn't name; anything else replaces what was there (#645).
 * Only the theme's own groups are merged, and the rest spread, so a `__proto__` key never sets a
 * prototype.
 */
function withTokens(theme: object, tokens: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...theme, ...tokens };
  for (const [key, value] of Object.entries(tokens)) {
    const before: unknown = Object.hasOwn(theme, key) ? Reflect.get(theme, key) : undefined;
    if (isGroup(before) && isGroup(value)) merged[key] = { ...before, ...value };
  }
  return merged;
}
