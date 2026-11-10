import { plural, t } from "@webforge/i18n";
import { type PageId, pageEntryOf, type SiteDoc } from "@webforge/model";
import { produce } from "immer";
import { z } from "zod";
import { type Failure, fail, failed, type Plan, type PlanContext, UNPUBLISHED } from "./plan.js";

/** The longest plan: a whole site's build, with room to spare. */
const MOST_COMMANDS = 200;

/** A command as a plan holds it: its name and its input, as the command itself takes it. */
type Step = { readonly name: string; readonly input: unknown };

/** A command a plan can hold: what `COMMANDS` has for each, but `plan`. */
type Command = {
  readonly input: z.ZodType;
  readonly plan: (site: SiteDoc, input: never, context?: PlanContext) => Plan | Failure;
};

/** What a plan does, for its one question (D7): counted and named. */
type Summary = {
  readonly pagesAdded: string[];
  readonly pagesRemoved: string[];
  /** Pages renamed, by their titles before and after. */
  readonly pagesRenamed: { readonly from: string; readonly to: string }[];
  readonly pagesMoved: Set<string>;
  /** Pages whose Page Settings change, besides their title. */
  readonly pagesSet: Set<string>;
  theme: boolean;
  elements: { added: number; changed: number; moved: number; removed: number };
  /** The questions its commands would each have asked: the question, and what it names. */
  readonly asks: string[];
  /** Those that name where visitors' money or details go, or change Site Settings (S30). */
  readonly asksFirst: string[];
};

/** What a step's planned change counts as in the summary. */
function count(summary: Summary, name: string, site: SiteDoc, input: unknown): void {
  const pageId = (input as { pageId?: string }).pageId;
  const page = pageId === undefined ? undefined : pageEntryOf(site.pages, pageId);
  const renamed = (to: string | undefined) => {
    if (page !== undefined && to !== undefined && to.trim() !== page.title) {
      summary.pagesRenamed.push({ from: page.title, to: to.trim() });
    }
  };
  switch (name) {
    case "addPage":
      summary.pagesAdded.push((input as { title: string }).title.trim());
      return;
    case "removePage":
      summary.pagesRemoved.push(page?.title ?? "");
      return;
    case "renamePage":
      renamed((input as { title: string }).title);
      return;
    case "movePage":
      summary.pagesMoved.add(page?.title ?? "");
      return;
    case "updatePageSettings": {
      const { title, ...others } = input as { title?: string };
      renamed(title);
      if (Object.keys(others).some((key) => key !== "pageId")) {
        summary.pagesSet.add(page?.title ?? "");
      }
      return;
    }
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

/** A page of the site document. */
type Page = SiteDoc["pages"][PageId];

/** Whether a page is hidden from navigation, and from search engines: Page Settings' switches. */
const SWITCHES = [
  ["pageSettings.hideFromNavigation", (page: Page) => page.settings.hideFromNavigation],
  ["pageSettings.hideFromSearch", (page: Page) => page.settings.hideFromSearch === true],
] as const;

/**
 * Each page the plan keeps that it hides from navigation or search engines, or shows again, from
 * and to: the switches that decide whether it's found at all, whichever command changed them.
 */
function switchesChanged(before: SiteDoc, after: SiteDoc): string[] {
  const shown = (on: boolean) => t(on ? "ai.confirm.yes" : "ai.confirm.no");
  const lines: string[] = [];
  for (const id of before.pageOrder) {
    const [from, to] = [before.pages[id], after.pages[id]];
    if (from === undefined || to === undefined) continue;
    for (const [field, on] of SWITCHES) {
      if (on(from) === on(to)) continue;
      lines.push(
        t("ai.plan.pageSwitch", {
          page: `"${to.title}"`,
          field: t(field),
          from: shown(on(from)),
          to: shown(on(to)),
        }),
      );
    }
  }
  return lines;
}

/** The most names a list in the summary gives, before "and 140 more" (S30). */
const MOST_LISTED = 10;

/** The most of a page title the summary gives (titles can be 200 characters). */
const TITLE_SHOWN = 60;

/** The most questions the summary repeats that aren't destinations or Site Settings. */
const MOST_ASKS = 10;

/** Splits text into what a reader sees as characters: an emoji with its modifiers is one. */
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * `title`, shortened to {@link TITLE_SHOWN} characters, as a reader counts them: never cut inside
 * an emoji, which would leave half of it before the "…".
 */
const shortened = (title: string) => {
  // Most titles are short: no need to split them.
  if (title.length <= TITLE_SHOWN) return title;
  const characters = Array.from(GRAPHEMES.segment(title), ({ segment }) => segment);
  return characters.length <= TITLE_SHOWN
    ? title
    : `${characters
        .slice(0, TITLE_SHOWN - 1)
        .join("")
        .trimEnd()}…`;
};

/**
 * The plan's one question's details (S30, #795), as paragraphs: first, set apart, every question
 * that names where visitors' money or details go or changes Site Settings, however long the plan;
 * then what it adds, deletes and changes, each list and title shortened; then the other questions
 * its commands would have asked, the first {@link MOST_ASKS}.
 */
function described(summary: Summary, switches: readonly string[]): string {
  const groups: string[][] = [];
  if (summary.asksFirst.length > 0) groups.push([t("ai.plan.first"), ...summary.asksFirst]);
  const list = (names: Iterable<string>) => {
    const all = [...names];
    const shown = all.slice(0, MOST_LISTED).map((name) => `"${shortened(name)}"`);
    const more = all.length - shown.length;
    return more > 0
      ? `${shown.join(", ")} ${t("ai.plan.more", { count: more })}`
      : shown.join(", ");
  };
  const changes: string[] = [];
  if (summary.pagesAdded.length > 0) {
    changes.push(t("ai.plan.pagesAdded", { pages: list(summary.pagesAdded) }));
  }
  if (summary.pagesRemoved.length > 0) {
    changes.push(t("ai.plan.pagesRemoved", { pages: list(summary.pagesRemoved) }));
  }
  for (const { from, to } of summary.pagesRenamed.slice(0, MOST_LISTED)) {
    changes.push(t("ai.plan.pageRenamed", { from: shortened(from), to: shortened(to) }));
  }
  if (summary.pagesRenamed.length > MOST_LISTED) {
    changes.push(plural("ai.plan.moreRenamed", summary.pagesRenamed.length - MOST_LISTED));
  }
  if (summary.pagesMoved.size > 0) {
    changes.push(t("ai.plan.pagesMoved", { pages: list(summary.pagesMoved) }));
  }
  if (summary.pagesSet.size > 0) {
    changes.push(t("ai.plan.pageSettings", { pages: list(summary.pagesSet) }));
  }
  changes.push(...switches.slice(0, MOST_LISTED));
  if (switches.length > MOST_LISTED) {
    changes.push(plural("ai.plan.moreHidden", switches.length - MOST_LISTED));
  }
  if (summary.theme) changes.push(t("ai.plan.theme"));
  const { added, changed, moved, removed } = summary.elements;
  if (added + changed + moved + removed > 0) {
    changes.push(t("ai.plan.elements", { added, changed, moved, removed }));
  }
  if (changes.length > 0) groups.push(changes);
  if (summary.asks.length > 0) {
    const more = summary.asks.length - MOST_ASKS;
    groups.push([
      t("ai.plan.asks"),
      ...summary.asks.slice(0, MOST_ASKS),
      ...(more > 0 ? [plural("ai.plan.moreAsks", more)] : []),
    ]);
  }
  // A paragraph each, which the question shows apart.
  return groups.map((group) => group.join(" ")).join("\n\n");
}

/**
 * A plan (4.12a, AIB-6): an AI app's titled list of commands, run as **one** change. Every command
 * is planned first, each against the site as the ones before it leave it; if any can't be, nothing
 * changes and the answer says which. The person is asked once, with a summary: the pages added and
 * removed, renamed, moved and given other Page Settings, any page newly hidden from navigation or
 * search engines or shown again (from and to), the theme, the sections and elements added, changed,
 * moved and removed, and each question
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
    plan(
      site: SiteDoc,
      input: { title: string; commands: readonly Step[] },
      context: PlanContext = UNPUBLISHED,
    ): Plan | Failure {
      // Each command against the site as the ones before it leave it: immer's copies share what a
      // step leaves alone, as the history's do, so a long build isn't the whole site copied per step.
      let working: SiteDoc = site;
      const recipes: ((draft: SiteDoc) => void)[] = [];
      const removesPages: PageId[] = [];
      const summary: Summary = {
        pagesAdded: [],
        pagesRemoved: [],
        pagesRenamed: [],
        pagesMoved: new Set(),
        pagesSet: new Set(),
        theme: false,
        elements: { added: 0, changed: 0, moved: 0, removed: 0 },
        asks: [],
        asksFirst: [],
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
        const planned = command.plan(working, parsed.data as never, context);
        if (failed(planned)) {
          return fail(planned.status, `${where}: ${planned.message} Nothing changed.`);
        }
        count(summary, step.name, working, parsed.data);
        const asked = planned.confirm?.("{app}");
        if (asked !== undefined) {
          const ask = [asked.action, asked.description].filter(Boolean).join(" ");
          (asked.first === true ? summary.asksFirst : summary.asks).push(ask);
        }
        structural ||= planned.structural;
        if (planned.removesPages !== undefined) removesPages.push(...planned.removesPages);
        recipes.push(planned.recipe);
        // Frozen as each step leaves it, so nothing a recipe keeps from it can change under it.
        working = produce(working, (draft) => {
          planned.recipe(draft);
        });
      }
      const switches = switchesChanged(site, working);
      return {
        action: input.title,
        structural,
        // Pages and elements added, changed and removed: the toast offers Undo as for a removal.
        kind: summary.pagesRemoved.length > 0 || summary.elements.removed > 0 ? "remove" : "props",
        confirm: (app) => ({
          action: t("ai.confirm.plan", { app, title: input.title }),
          description: described(
            {
              ...summary,
              asks: summary.asks.map((ask) => ask.replaceAll("{app}", app)),
              asksFirst: summary.asksFirst.map((ask) => ask.replaceAll("{app}", app)),
            },
            switches,
          ),
          confirm: t("ai.confirm.allow"),
          affectedPages: site.pageOrder.length,
          // The one version before the plan, saved once it's allowed (S26).
          version: t("ai.version.beforePlan", { app, title: input.title }),
        }),
        ...(removesPages.length === 0 ? {} : { removesPages }),
        recipe: (draft) => {
          for (const recipe of recipes) recipe(draft);
        },
      };
    },
  };
}
