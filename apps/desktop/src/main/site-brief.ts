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
      "Starts a new site from a brief: Webforge opens its quick start filled in with these answers, for the person to check, change and create, or not. Nothing is made until they click Create; the site open now is saved first. Answers once they have: done, with the new site open, or declined. Give the business type, and its kind, name and what it does; a template, theme, brand colour (or palette), pages to leave out and recipes to add, and contact details, each optional, as siteChoices lists them. Refused in Content mode.",
    inputSchema: z.toJSONSchema(siteBriefSchema, { io: "input", unrepresentable: "any" }) as {
      readonly type: "object";
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
  readonly timeoutMs?: number;
};

/**
 * AI apps' briefs (4.12a, AIB-5), answered in main: a new site is made in the window, which starts
 * over with it, and none need be open. Each brief is checked against what ships, then sent to the
 * window, which shows the quick start filled in. The tool answers once the person creates the site
 * (with it open) or closes the quick start; the person, never the app, decides a site is made. One
 * brief at a time; a window that starts over without having said it created one declines it.
 */
export function createSiteBriefs(options: SiteBriefsOptions) {
  const timeoutMs = options.timeoutMs ?? BRIEF_TIMEOUT_MS;
  let pending:
    | { readonly id: number; readonly settle: (outcome: BriefOutcome) => void }
    | undefined;
  let nextId = 1;
  const watched = new WeakSet<object>();

  return {
    register(ipc: Pick<IpcMain, "handle">, isTrustedSender: (senderUrl: string) => boolean): void {
      registerIpcHandler(ipc, "aiBriefAnswer", isTrustedSender, (id, outcome) => {
        if (pending?.id === id) pending.settle(outcome);
        return null;
      });
    },

    /** The choices a brief has, for the `siteChoices` tool. */
    choices: () => ({ status: "done" as const, data: siteChoices(options.templates()) }),

    /** Shows `input`, a brief, to the person: what became of it, as the AI app's answer. */
    async ask(input: unknown): Promise<AiResponse> {
      const parsed = siteBriefSchema.safeParse(input);
      if (!parsed.success) return { status: "invalid", message: z.prettifyError(parsed.error) };
      const brief = parsed.data;
      const problem = briefProblem(brief, options.templates());
      if (problem !== undefined) return { status: "invalid", message: problem };
      if (pending !== undefined) return BUSY;
      const target = options.window();
      if (target === undefined || target.webContents.isCrashed()) return NO_WINDOW;
      if (!watched.has(target.webContents)) {
        watched.add(target.webContents);
        // Starting over without having answered: another site opened, or the window reloaded.
        target.webContents.on("did-start-navigation", (details) => {
          if (details.isMainFrame && !details.isSameDocument) pending?.settle("declined");
        });
      }
      const id = nextId++;
      const outcome = await new Promise<BriefOutcome>((resolve) => {
        const timer = setTimeout(() => settle("declined"), timeoutMs);
        const settle = (answer: BriefOutcome) => {
          clearTimeout(timer);
          pending = undefined;
          resolve(answer);
        };
        pending = { id, settle };
        target.webContents.send(aiEvents.brief.channel, id, brief);
      });
      return outcome === "created"
        ? { status: "done", data: { created: true, name: brief.name } }
        : ANSWERS[outcome];
    },
  };
}

/** The briefs. */
export type SiteBriefs = ReturnType<typeof createSiteBriefs>;
