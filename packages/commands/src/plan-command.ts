import { t } from "@webforge/i18n";
import type { PageId, SiteDoc } from "@webforge/model";
import { z } from "zod";
import { type Failure, fail, failed, type Plan } from "./plan.js";

/** The longest plan: a whole site's build, with room to spare. */
const MOST_COMMANDS = 200;

/** A command as a plan holds it: its name and its input, as the command itself takes it. */
type Step = { readonly name: string; readonly input: unknown };

/** A command a plan can hold: what `COMMANDS` has for each, but `plan`. */
type Command = {
  readonly input: z.ZodType;
  readonly plan: (site: SiteDoc, input: never) => Plan | Failure;
};

/** What a plan does, for its one question (D7): counted and named. */
type Summary = {
  readonly pagesAdded: string[];
  readonly pagesRemoved: string[];
  theme: boolean;
  elements: { added: number; changed: number; moved: number; removed: number };
  /** The questions its commands would each have asked: the question, and what it names. */
  readonly asks: string[];
};

/** What a step's planned change counts as in the summary. */
function count(summary: Summary, name: string, site: SiteDoc, input: unknown): void {
  const pageId = (input as { pageId?: string }).pageId;
  switch (name) {
    case "addPage":
      summary.pagesAdded.push((input as { title: string }).title.trim());
      return;
    case "removePage":
      summary.pagesRemoved.push(site.pages[pageId as PageId]?.title ?? "");
      return;
    case "setThemeTokens":
      summary.theme = true;
      return;
    case "addNode":
      summary.elements.added += 1;
      return;
    case "moveNode":
      summary.elements.moved += 1;
      return;
    case "removeNode":
      summary.elements.removed += 1;
      return;
    case "editText":
    case "updateFields":
      summary.elements.changed += 1;
      return;
  }
}

/** The plan's one question's details: what it adds, deletes and changes, and what would have asked. */
function described(summary: Summary): string {
  const lines: string[] = [];
  const list = (names: readonly string[]) => names.map((name) => `"${name}"`).join(", ");
  if (summary.pagesAdded.length > 0) {
    lines.push(t("ai.plan.pagesAdded", { pages: list(summary.pagesAdded) }));
  }
  if (summary.pagesRemoved.length > 0) {
    lines.push(t("ai.plan.pagesRemoved", { pages: list(summary.pagesRemoved) }));
  }
  if (summary.theme) lines.push(t("ai.plan.theme"));
  const { added, changed, moved, removed } = summary.elements;
  if (added + changed + moved + removed > 0) {
    lines.push(t("ai.plan.elements", { added, changed, moved, removed }));
  }
  if (summary.asks.length > 0) lines.push(t("ai.plan.asks"), ...summary.asks);
  return lines.join(" ");
}

/**
 * A plan (4.12a, AIB-6): an AI app's titled list of commands, run as **one** change. Every command
 * is planned first, each against the site as the ones before it leave it; if any can't be, nothing
 * changes and the answer says which. The person is asked once, with a summary: the pages added and
 * removed, the theme, the sections and elements added, changed, moved and removed, and each question
 * a command would have asked on its own (its Site Settings and payment changes, from and to). On
 * Allow it runs as one undo step, "AI (‹app›): ‹title›", and counts as one command against the app's
 * limits; main saves a version before it (S20). Content mode refuses it if any command in it is
 * refused there.
 */
export function planCommand(commands: Readonly<Record<string, Command>>) {
  const names = Object.keys(commands) as [string, ...string[]];
  return {
    description: `Runs a titled list of commands as one change: one question for the person, with a summary of everything it does, then one undo step named after the title ("Build the Rapidfix site"), a version saved before it. Every command is checked first, each against the site as the ones before it leave it; if any fails, nothing changes and the answer says which. Use it for a build of more than a few edits. Each command takes what it takes on its own (${names.join(", ")}); a plan holds no plan. New ids from addPage and addNode aren't known before it runs: add a page and fill it in two plans.`,
    input: z.strictObject({
      title: z.string().trim().min(1).max(80),
      commands: z
        .array(z.strictObject({ name: z.enum(names), input: z.unknown() }))
        .min(1)
        .max(MOST_COMMANDS),
    }),
    plan(site: SiteDoc, input: { title: string; commands: readonly Step[] }): Plan | Failure {
      // Each command against the site as the ones before it leave it.
      let working: SiteDoc = structuredClone(site);
      const recipes: ((draft: SiteDoc) => void)[] = [];
      const removesPages: PageId[] = [];
      const summary: Summary = {
        pagesAdded: [],
        pagesRemoved: [],
        theme: false,
        elements: { added: 0, changed: 0, moved: 0, removed: 0 },
        asks: [],
      };
      let structural = false;
      for (const [at, step] of input.commands.entries()) {
        const command = commands[step.name];
        if (command === undefined) return fail("invalid", `There is no command "${step.name}".`);
        const where = `Command ${at + 1} (${step.name})`;
        const parsed = command.input.safeParse(step.input);
        if (!parsed.success) {
          return fail("invalid", `${where}: ${z.prettifyError(parsed.error)} Nothing changed.`);
        }
        const planned = command.plan(working, parsed.data as never);
        if (failed(planned)) {
          return fail(planned.status, `${where}: ${planned.message} Nothing changed.`);
        }
        count(summary, step.name, working, parsed.data);
        const asked = planned.confirm?.("{app}");
        if (asked !== undefined) {
          summary.asks.push([asked.action, asked.description].filter(Boolean).join(" "));
        }
        structural ||= planned.structural;
        if (planned.removesPages !== undefined) removesPages.push(...planned.removesPages);
        recipes.push(planned.recipe);
        planned.recipe(working);
        // A step's recipe may have kept references into the copy: the next plans read it afresh.
        working = structuredClone(working);
      }
      return {
        action: input.title,
        structural,
        // Pages and elements added, changed and removed: the toast offers Undo as for a removal.
        kind: summary.pagesRemoved.length > 0 || summary.elements.removed > 0 ? "remove" : "props",
        confirm: (app) => ({
          action: t("ai.confirm.plan", { app, title: input.title }),
          description: described({
            ...summary,
            asks: summary.asks.map((ask) => ask.replaceAll("{app}", app)),
          }),
          confirm: t("ai.confirm.allow"),
          affectedPages: site.pageOrder.length,
        }),
        ...(removesPages.length === 0 ? {} : { removesPages }),
        recipe: (draft) => {
          for (const recipe of recipes) recipe(draft);
        },
      };
    },
  };
}
