import { z } from "zod";
/** Every command the summary counts, by id (BD-1): a fixed list, each once. */
export declare const USAGE_COMMANDS: readonly string[];
/**
 * The name `id`, a command the person ran, is counted under: itself, or its family's name for an
 * id made from something else. None for a command the summary doesn't list.
 */
export declare function usageCommandOf(id: string): string | undefined;
/** The quick start's steps, in order (QS-1). */
export declare const QUICK_START_STEPS: readonly ["business", "look", "pages", "details"];
/** The most tour steps the summary counts the tour being closed at. */
export declare const TOUR_STEPS_MAX = 20;
/**
 * What the editor did that the usage summary counts (BD-1), sent to main with `app:record-usage`.
 * Names only from fixed lists or shaped like one, and main counts a name only if its own list has
 * it: never a site's words, names or addresses.
 */
export declare const editorUsageSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        kind: z.ZodLiteral<"command">;
        id: z.ZodEnum<{
          [x: string]: string;
        }>;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        kind: z.ZodLiteral<"added">;
        type: z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"shared">]>;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        kind: z.ZodLiteral<"siteCheck">;
        found: z.ZodArray<
          z.ZodObject<
            {
              rule: z.ZodString;
              level: z.ZodEnum<{
                must: "must";
                should: "should";
                tip: "tip";
              }>;
            },
            z.core.$strict
          >
        >;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        kind: z.ZodLiteral<"quickStart">;
        outcome: z.ZodEnum<{
          cancelled: "cancelled";
          created: "created";
        }>;
        step: z.ZodEnum<{
          business: "business";
          details: "details";
          look: "look";
          pages: "pages";
        }>;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        kind: z.ZodLiteral<"tour">;
        outcome: z.ZodEnum<{
          closed: "closed";
          declined: "declined";
          finished: "finished";
          taken: "taken";
        }>;
        step: z.ZodOptional<z.ZodInt>;
      },
      z.core.$strict
    >,
  ],
  "kind"
>;
/** What the editor did that the usage summary counts. */
export type EditorUsage = z.infer<typeof editorUsageSchema>;
//# sourceMappingURL=usage.d.ts.map
