import { z } from "zod";
import { COMMAND_IDS } from "./command-ids.js";

// The usage summary's names that both processes know (5.40, BD-1, research/product/22 §4): the
// commands counted, the quick start's steps, and what the editor tells main it did. The summary
// holds numbers, times and names from fixed lists only, so nothing a person typed can reach it.

/**
 * Commands whose ids are made from something else (`site.openRecent.<site's id>`): counted under
 * the family's name, never with what follows it.
 */
const COMMAND_FAMILIES = ["site.openRecent", "page.goto", "help.page", "add.item"] as const;

/** Commands the shell doesn't name in {@link COMMAND_IDS}: the canvas's, the clipboard's, the theme's. */
const OTHER_COMMANDS = [
  "edit.applyLookOnPage",
  "edit.applyLookOnSite",
  "edit.clearText",
  "edit.copy",
  "edit.copyStyle",
  "edit.cut",
  "edit.delete",
  "edit.deleteSharedSection",
  "edit.detachSharedSection",
  "edit.duplicate",
  "edit.editText",
  "edit.moveDown",
  "edit.moveUp",
  "edit.paste",
  "edit.pasteStyle",
  "edit.rename",
  "edit.renameSharedSection",
  "edit.saveSharedSection",
  "edit.selectChild",
  "edit.selectNext",
  "edit.selectNextSibling",
  "edit.selectParent",
  "edit.selectPrevious",
  "edit.selectPreviousSibling",
  "edit.selectSimilar",
  "edit.toggleHidden",
  "theme.show",
  "theme.studio",
] as const;

/** Every command the summary counts, by id (BD-1): a fixed list, each once. */
export const USAGE_COMMANDS: readonly string[] = [
  ...new Set<string>([...Object.values(COMMAND_IDS), ...OTHER_COMMANDS, ...COMMAND_FAMILIES]),
];

const COUNTED = new Set(USAGE_COMMANDS);

/**
 * The name `id`, a command the person ran, is counted under: itself, or its family's name for an
 * id made from something else. None for a command the summary doesn't list.
 */
export function usageCommandOf(id: string): string | undefined {
  if (COUNTED.has(id)) return id;
  const family = COMMAND_FAMILIES.find((name) => id.startsWith(`${name}.`));
  return family;
}

/** The quick start's steps, in order (QS-1). */
export const QUICK_START_STEPS = ["business", "look", "pages", "details"] as const;

/** The most tour steps the summary counts the tour being closed at. */
export const TOUR_STEPS_MAX = 20;

/** A component's type, as the catalogue names it (`Hero`); main counts only the catalogue's. */
const componentTypeSchema = z.string().regex(/^[A-Z][A-Za-z0-9]{0,63}$/);

/** A Site Check rule's id (`alt-text`); main counts only its rules'. */
const ruleIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);

/**
 * What the editor did that the usage summary counts (BD-1), sent to main with `app:record-usage`.
 * Names only from fixed lists or shaped like one, and main counts a name only if its own list has
 * it: never a site's words, names or addresses.
 */
export const editorUsageSchema = z.discriminatedUnion("kind", [
  /** A command run, by the name {@link usageCommandOf} gives it. */
  z.strictObject({
    kind: z.literal("command"),
    id: z.enum(USAGE_COMMANDS as [string, ...string[]]),
  }),
  /** A section or element added, by its type; a shared section's copy as `shared`. */
  z.strictObject({
    kind: z.literal("added"),
    type: z.union([componentTypeSchema, z.literal("shared")]),
  }),
  /** Site Check run, and each rule that found something, by its level. */
  z.strictObject({
    kind: z.literal("siteCheck"),
    found: z
      .array(
        z.strictObject({
          rule: ruleIdSchema,
          level: z.enum(["must", "should", "tip"]),
        }),
      )
      .max(500),
  }),
  /** The quick start ended: a site made, or put away, at a step. */
  z.strictObject({
    kind: z.literal("quickStart"),
    outcome: z.enum(["created", "cancelled"]),
    step: z.enum(QUICK_START_STEPS),
  }),
  /** The tour taken, its offer turned down, finished, or closed at a step (0 is the first). */
  z.strictObject({
    kind: z.literal("tour"),
    outcome: z.enum(["taken", "declined", "finished", "closed"]),
    step: z
      .int()
      .min(0)
      .max(TOUR_STEPS_MAX - 1)
      .optional(),
  }),
]);

/** What the editor did that the usage summary counts. */
export type EditorUsage = z.infer<typeof editorUsageSchema>;
