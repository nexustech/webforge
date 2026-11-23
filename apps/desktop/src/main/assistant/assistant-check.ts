import { z } from "zod";
import type { HeldChange } from "../../shared/ipc/assistant.js";
import type { ChatMessage } from "./chat-client.js";

/**
 * The check of a reply's work (5.18, OL-3): once a model call's tool calls changed the site, the
 * loop runs Site Check itself before the model's next call, so what the model writes next, its
 * closing message included, has seen what its changes left. Only the pages changed since the last
 * check are reported, or the whole site once such a change wasn't on one page: the earlier checks
 * are in the model's messages already, and a page that hasn't changed since has nothing new. The check runs on this computer,
 * as the window's Run Site Check does, and adds no model call: the model is called again after
 * its tool calls anyway.
 */

/** The window's tool the check runs (4.9, `WINDOW_TOOLS`). */
export const CHECK_TOOL = "runSiteCheck";

/** What the reply changed: its pages by id, and whether a change was on no one page. */
export type Changed = {
  readonly pages: ReadonlySet<string>;
  /** The theme, the header or footer, a shared section, a page removed, or a plan of several. */
  readonly siteWide: boolean;
};

/** What `changes` changed, each by its target. */
export const changedBy = (changes: readonly Pick<HeldChange, "target">[]): Changed => ({
  pages: new Set(changes.flatMap((change) => change.target?.pageId ?? [])),
  siteWide: changes.some((change) => change.target === undefined),
});

/** Site Check's answer, as the window words it (`app-tools.ts`): only what's filtered here. */
const reportSchema = z.looseObject({
  status: z.literal("done"),
  data: z.looseObject({
    found: z.array(
      z.looseObject({
        places: z.array(z.unknown()),
        facts: z.array(z.unknown()).optional(),
      }),
    ),
  }),
});

/** A place on one of `pages`: an element on it, or the page itself. */
const placeSchema = z.union([
  z.looseObject({ kind: z.literal("element"), on: z.string() }),
  z.looseObject({ kind: z.literal("page"), pageId: z.string() }),
]);

const onPages = (place: unknown, pages: ReadonlySet<string>) => {
  const parsed = placeSchema.safeParse(place);
  if (!parsed.success) return false;
  return pages.has(parsed.data.kind === "element" ? parsed.data.on : parsed.data.pageId);
};

/** What the model is told with the check's result. */
const ABOUT = [
  "Site Check ran after your changes, on this computer, on what changed since its last run.",
  "In your closing message, say what you changed and what this check found,",
  "naming each must or should problem on the places you changed.",
  "Never say something worked unless a result showed it.",
].join(" ");

/**
 * The check's result as `text`, the window's answer to Run Site Check, gives it: the findings on
 * `changed`'s pages, each with its places there and their facts, or all of them for a site-wide
 * change. An answer that isn't a report goes to the model as it is, so it hears the check failed.
 */
export function checkResult(text: string, changed: Changed): string {
  let report: z.infer<typeof reportSchema> | undefined;
  try {
    const parsed = reportSchema.safeParse(JSON.parse(text));
    report = parsed.success ? parsed.data : undefined;
  } catch {
    report = undefined;
  }
  if (report === undefined) return text;
  const pages = [...changed.pages];
  const found = changed.siteWide
    ? report.data.found
    : report.data.found.flatMap((result) => {
        const kept = result.places.flatMap((place, index) =>
          onPages(place, changed.pages) ? [index] : [],
        );
        if (kept.length === 0) return [];
        const { facts } = result;
        return [
          {
            ...result,
            places: kept.map((index) => result.places[index]),
            ...(facts === undefined ? {} : { facts: kept.map((index) => facts[index]) }),
          },
        ];
      });
  return JSON.stringify({
    status: "done",
    about: ABOUT,
    checked: changed.siteWide ? "site" : "pages",
    ...(changed.siteWide ? {} : { pages }),
    found,
  });
}

/**
 * The messages that give the model the check, as a call of {@link CHECK_TOOL} the loop made: its
 * call, then its result. `id` is the call's, the loop's own.
 */
export const checkMessages = (id: string, result: string): ChatMessage[] => [
  {
    role: "assistant",
    content: null,
    tool_calls: [{ id, type: "function", function: { name: CHECK_TOOL, arguments: "{}" } }],
  },
  { role: "tool", tool_call_id: id, content: result },
];
