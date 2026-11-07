import { isMessageKey, t } from "@webforge/i18n";
import { BUSINESS_KINDS, BUSINESS_TYPES, type BusinessType } from "@webforge/model";
import { PAGE_RECIPES } from "@webforge/templates";
import { CURATED_THEMES, THEME_PRESETS } from "@webforge/themes";
import type { IpcMain } from "electron";
import { z } from "zod";
import {
  type AiResponse,
  aiEvents,
  type BriefOutcome,
  type SiteBrief,
  siteBriefSchema,
} from "../shared/ipc/ai.js";
import type { AiWindow } from "./ai-ipc.js";
import { registerIpcHandler } from "./ipc.js";

/**
 * The tools main answers itself, beside the window's (4.12a): a new site is made without one open,
 * and the window that took the request starts over with it.
 */
export const MAIN_TOOLS = {
  siteChoices: {
    kind: "query",
    description:
      "What createSiteFromBrief chooses from: each business type with its kinds, templates (their pages, by id and title) and page recipes; the theme presets; and the curated palettes. Needs no site open.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  createSiteFromBrief: {
    kind: "command",
    description:
      "Starts a new site from a brief: Webforge opens its quick start filled in with these answers, for the person to check, change and create, or not. Nothing is made until they click Create; the site open now is saved first. Answers once they have: done, with the new site open, or declined. If they haven't decided within about 45 seconds, it answers waiting with a briefId: ask briefStatus with it a little later. Give the business type, and its kind, name and what it does; a template, theme, brand colour (or palette), pages to leave out and recipes to add, and contact details, each optional, as siteChoices lists them. Refused in Content mode.",
    inputSchema: z.toJSONSchema(siteBriefSchema, { io: "input", unrepresentable: "any" }) as {
      readonly type: "object";
    },
  },
  briefStatus: {
    kind: "query",
    description:
      "What became of a brief createSiteFromBrief answered waiting for: waiting still, done with the new site open, or declined. Takes its briefId; an app reads only its own briefs, each outcome once.",
    inputSchema: {
      type: "object",
      properties: { briefId: { type: "integer", minimum: 1 } },
      required: ["briefId"],
      additionalProperties: false,
    },
  },
} as const;

/** The name of one of {@link MAIN_TOOLS}. */
export type MainToolName = keyof typeof MAIN_TOOLS;

/** Whether `name` is one of {@link MAIN_TOOLS}. */
export const isMainTool = (name: string): name is MainToolName => Object.hasOwn(MAIN_TOOLS, name);

/** How long a brief waits for the person to create the site or close the quick start. */
const BRIEF_TIMEOUT_MS = 30 * 60_000;

/** A template as a brief chooses from it: its id, name, type, theme and pages. */
export type BriefTemplate = {
  readonly id: string;
  readonly category: BusinessType;
  readonly theme: string;
  readonly pages: readonly {
    readonly id: string;
    readonly title: string;
    readonly home: boolean;
  }[];
};

/** A label in the person's language, or nothing for a key the catalogue doesn't have. */
const label = (key: string) => (isMessageKey(key) ? t(key) : undefined);

/**
 * What a brief chooses from (4.12a, AIB-5): each business type with its kinds, templates (and
 * their pages) and page recipes; the theme presets; and the curated palettes. The `siteChoices`
 * tool, which needs no site open.
 */
export function siteChoices(templates: readonly BriefTemplate[]) {
  return {
    businessTypes: BUSINESS_TYPES.map((type) => ({
      type,
      label: label(`template.category.${type}`) ?? type,
      kinds: BUSINESS_KINDS[type].map((kind) => ({
        kind,
        label: label(`site.settings.businessKind.${kind}`) ?? kind,
      })),
      templates: templates
        .filter((template) => template.category === type)
        .map(({ id, theme, pages }) => ({
          id,
          name: label(`template.${id}.name`) ?? id,
          theme,
          pages,
        })),
      recipes: PAGE_RECIPES.filter((recipe) => recipe.category === type).map(({ id, title }) => ({
        id,
        title,
      })),
    })),
    themes: THEME_PRESETS.map(({ preset }) => preset),
    palettes: CURATED_THEMES.map(({ preset }) => preset),
  };
}

/** Why `brief` doesn't fit what ships, or nothing when it does. */
export function briefProblem(
  brief: SiteBrief,
  templates: readonly BriefTemplate[],
): string | undefined {
  const type = brief.businessType;
  const kinds: readonly string[] = BUSINESS_KINDS[type];
  if (brief.businessKind !== undefined && !kinds.includes(brief.businessKind)) {
    return `"${brief.businessKind}" isn't a kind of ${type} business: ${kinds.join(", ") || "it has none"}.`;
  }
  const own = templates.filter((each) => each.category === type);
  const template =
    brief.template === undefined ? own[0] : own.find((each) => each.id === brief.template);
  if (brief.template !== undefined && template === undefined) {
    return `"${brief.template}" isn't a ${type} template: ${own.map(({ id }) => id).join(", ") || "it has none"}.`;
  }
  for (const id of brief.leaveOut ?? []) {
    const page = template?.pages.find((each) => each.id === id);
    if (page === undefined) return `The template has no page "${id}". siteChoices lists its pages.`;
    if (page.home) return "The home page can't be left out.";
  }
  const recipes = PAGE_RECIPES.filter((recipe) => recipe.category === type).map(({ id }) => id);
  const recipe = (brief.recipes ?? []).find((id) => !recipes.includes(id));
  if (recipe !== undefined) {
    return `"${recipe}" isn't a ${type} page recipe: ${recipes.join(", ") || "it has none"}.`;
  }
  if (brief.theme !== undefined && !THEME_PRESETS.some(({ preset }) => preset === brief.theme)) {
    return `There is no theme "${brief.theme}". siteChoices lists them.`;
  }
  if (
    brief.colours !== undefined &&
    "palette" in brief.colours &&
    !CURATED_THEMES.some(({ preset }) => preset === (brief.colours as { palette: string }).palette)
  ) {
    return `There is no palette "${brief.colours.palette}". siteChoices lists them.`;
  }
  return undefined;
}

/** What each outcome answers the AI app. */
const ANSWERS: Readonly<Record<Exclude<BriefOutcome, "created">, AiResponse>> = {
  declined: {
    status: "declined",
    message: "The person closed the quick start: no site was made.",
  },
  refused: {
    status: "refused",
    message: "Webforge is in Content mode: AI apps can't start a new site there.",
  },
  busy: {
    status: "busy",
    message: "The person is starting a site of their own: try again once they've finished.",
  },
};

const BUSY: AiResponse = {
  status: "busy",
  message: "Webforge is already showing the person an AI app's site: wait for its answer.",
};

const NO_WINDOW: AiResponse = { status: "not-found", message: "Webforge's window isn't open." };

/** What briefs work with: the window, and the templates that ship. */
export type SiteBriefsOptions = {
  readonly window: () => AiWindow | undefined;
  readonly templates: () => readonly BriefTemplate[];
  /** How long a brief waits for the person at all: then it's declined. */
  readonly timeoutMs?: number;
  /** How long `createSiteFromBrief` waits before answering `waiting`, under clients' timeouts. */
  readonly answerWithinMs?: number;
  /** How long a decided brief's outcome is kept for `briefStatus`, unless read before. */
  readonly keepMs?: number;
};

/**
 * How long `createSiteFromBrief` waits for the person before answering `waiting`: under the 60 s an
 * MCP client waits by default, whether or not it asks for progress (coordinator, #778 review).
 */
const ANSWER_WITHIN_MS = 45_000;

/** How long a decided brief's outcome waits to be read with `briefStatus`. */
const KEEP_MS = 30 * 60_000;

/** A brief shown to the person: whose it is, and what became of it once they've decided. */
type Kept = {
  /** The app that sent it, by the name the person gave it: no other app can read it. */
  readonly app: string;
  readonly name: string;
  outcome?: BriefOutcome;
  /** Who waits for the outcome: the request that sent it, while it does. */
  readonly waiting: Set<(outcome: BriefOutcome) => void>;
  timer: ReturnType<typeof setTimeout>;
};

/** What the app is answered while the person hasn't decided. */
const waiting = (briefId: number): AiResponse => ({
  status: "waiting",
  data: { briefId },
  message: "The person is checking the quick start: ask briefStatus with this briefId in a while.",
});

/**
 * AI apps' briefs (4.12a, AIB-5), answered in main: a new site is made in the window, which starts
 * over with it, and none need be open. Each brief is checked against what ships, then sent to the
 * window, which shows the quick start filled in; the person, never the app, decides a site is made.
 *
 * `createSiteFromBrief` answers once the person creates the site or closes the quick start, if
 * that's within {@link ANSWER_WITHIN_MS}. Otherwise, or when the app gives up on the request, it
 * answers `waiting` with the brief's id, and `briefStatus` gives the outcome later, to the app that
 * sent it only: kept until read, or for {@link KEEP_MS}. One brief at a time is shown; a window that
 * starts over without having said it created one, or a brief unanswered for half an hour, declines.
 */
export function createSiteBriefs(options: SiteBriefsOptions) {
  const timeoutMs = options.timeoutMs ?? BRIEF_TIMEOUT_MS;
  const answerWithinMs = options.answerWithinMs ?? ANSWER_WITHIN_MS;
  const keepMs = options.keepMs ?? KEEP_MS;
  const briefs = new Map<number, Kept>();
  /** The brief the person is checking now. */
  let shown: number | undefined;
  let nextId = 1;
  const watched = new WeakSet<object>();

  /** What the person decided about brief `id`: kept for the app, and told to any request waiting. */
  const decide = (id: number, outcome: BriefOutcome) => {
    const kept = briefs.get(id);
    if (kept === undefined || kept.outcome !== undefined) return;
    kept.outcome = outcome;
    if (shown === id) shown = undefined;
    clearTimeout(kept.timer);
    kept.timer = setTimeout(() => briefs.delete(id), keepMs);
    kept.timer.unref?.();
    for (const tell of kept.waiting) tell(outcome);
    kept.waiting.clear();
  };

  /** The app's answer for a decided brief, which is then forgotten: read once. */
  const answerFor = (id: number, kept: Kept, outcome: BriefOutcome): AiResponse => {
    clearTimeout(kept.timer);
    briefs.delete(id);
    return outcome === "created"
      ? { status: "done", data: { created: true, name: kept.name } }
      : ANSWERS[outcome];
  };

  return {
    register(ipc: Pick<IpcMain, "handle">, isTrustedSender: (senderUrl: string) => boolean): void {
      registerIpcHandler(ipc, "aiBriefAnswer", isTrustedSender, (id, outcome) => {
        decide(id, outcome);
        return null;
      });
    },

    /** The choices a brief has, for the `siteChoices` tool. */
    choices: () => ({ status: "done" as const, data: siteChoices(options.templates()) }),

    /**
     * Shows `input`, a brief from `app`, to the person: what became of it, or `waiting` with its id
     * if they haven't decided within {@link ANSWER_WITHIN_MS} or `signal` gives up first.
     */
    async ask(input: unknown, app: string, signal?: AbortSignal): Promise<AiResponse> {
      const parsed = siteBriefSchema.safeParse(input);
      if (!parsed.success) return { status: "invalid", message: z.prettifyError(parsed.error) };
      const brief = parsed.data;
      const problem = briefProblem(brief, options.templates());
      if (problem !== undefined) return { status: "invalid", message: problem };
      if (shown !== undefined) return BUSY;
      const target = options.window();
      if (target === undefined || target.webContents.isCrashed()) return NO_WINDOW;
      if (!watched.has(target.webContents)) {
        watched.add(target.webContents);
        // Starting over without having answered: another site opened, or the window reloaded.
        target.webContents.on("did-start-navigation", (details) => {
          if (details.isMainFrame && !details.isSameDocument && shown !== undefined) {
            decide(shown, "declined");
          }
        });
      }
      const id = nextId++;
      const kept: Kept = {
        app,
        name: brief.name,
        waiting: new Set(),
        timer: setTimeout(() => decide(id, "declined"), timeoutMs),
      };
      kept.timer.unref?.();
      briefs.set(id, kept);
      shown = id;
      const outcome = await new Promise<BriefOutcome | "waiting">((resolve) => {
        const done = (answer: BriefOutcome | "waiting") => {
          clearTimeout(within);
          signal?.removeEventListener("abort", gaveUp);
          kept.waiting.delete(done);
          resolve(answer);
        };
        const gaveUp = () => done("waiting");
        const within = setTimeout(gaveUp, answerWithinMs);
        kept.waiting.add(done);
        // The app gave up on the request: the quick start stays open, and briefStatus tells it.
        signal?.addEventListener("abort", gaveUp, { once: true });
        if (signal?.aborted === true) gaveUp();
        target.webContents.send(aiEvents.brief.channel, id, brief);
      });
      return outcome === "waiting" ? waiting(id) : answerFor(id, kept, outcome);
    },

    /** What became of `app`'s brief `briefId`: `waiting`, or its outcome, read once. */
    status(input: unknown, app: string): AiResponse {
      const parsed = briefStatusSchema.safeParse(input);
      if (!parsed.success) return { status: "invalid", message: z.prettifyError(parsed.error) };
      const { briefId } = parsed.data;
      const kept = briefs.get(briefId);
      // Another app's reads as none: what an app sent is its own.
      if (kept === undefined || kept.app !== app) {
        return { status: "not-found", message: `There is no brief ${briefId} of yours waiting.` };
      }
      return kept.outcome === undefined ? waiting(briefId) : answerFor(briefId, kept, kept.outcome);
    },
  };
}

/** What `briefStatus` takes: the id `createSiteFromBrief` answered `waiting` with. */
const briefStatusSchema = z.strictObject({ briefId: z.int().positive() });

/** The briefs. */
export type SiteBriefs = ReturnType<typeof createSiteBriefs>;
