import type { ToolDef } from "@webforge/commands";
import { z } from "zod";
import { ANSWER_WITHIN_MS, siteBriefSchema } from "./ipc/ai.js";
import { PREVIEW_OPEN_WAIT_MS } from "./ipc/preview.js";

/** How long a request waits on the person before answering `waiting`, in a description's words. */
const WAITS = `about ${ANSWER_WITHIN_MS / 1000} seconds`;

/** `def`, its name kept as written, so a record of handlers can be keyed by it. */
const tool = <const Name extends string, I extends z.ZodType>(
  def: ToolDef<I> & { readonly name: Name },
) => def;

/** What a tool that takes nothing takes: nothing, so none can be pointed at an address or path. */
const NOTHING = z.strictObject({});

/** What `requestMedia` takes: the app's reason, in its own words; never a path or an address. */
export const requestMediaInput = z.strictObject({ reason: z.string().trim().min(1).max(200) });

/** What `mediaStatus` takes: the id `requestMedia` answered `waiting` with (#1252). */
export const mediaStatusInput = z.strictObject({ requestId: z.int().positive() });

/**
 * The tools the window answers itself, beside the command layer's (4.9, #981). Run Site Check and
 * Open Preview take nothing, so neither can be pointed at an address, a path or a host;
 * `requestMedia` (4.12b, AIB-7) asks the person for pictures or files through Webforge's own
 * *Add files* dialog, with the app's reason, and `mediaStatus` says what became of one the person
 * was still answering (#1252). The app never gives a path or an address, and Webforge fetches
 * nothing: the person chooses what's added.
 */
export const WINDOW_TOOLS = [
  tool({
    name: "runSiteCheck",
    kind: "query",
    input: NOTHING,
    description:
      "Runs Site Check on the open site, as the person's Site Check panel does for an export: " +
      "each rule that found something, by its id, its title and its level (must, should or tip), " +
      "with the places by id (a page, an element, a Media item, a menu item, the theme), and " +
      "facts, one for each place, where findings have them: numbers and listed names, such as " +
      "a contrast finding's colours (background, foreground), palette (colors, or inverse for " +
      "reversed sections), ratio and the ratio required, or an image's width, height and bytes. " +
      "It never gives a finding's text: read the place with pageTree or fields.",
    answeredBy: "window",
    savesVersionFirst: false,
    forAssistant: true,
  }),
  tool({
    name: "openPreview",
    kind: "query",
    input: NOTHING,
    description:
      "Opens the open site's preview in the person's browser on this computer, as the Preview " +
      "command does, showing the page shown in Webforge, and answers with that page's address " +
      "(on this computer only), so you can look at your work: its layout at desktop and phone " +
      "widths, its pictures. It takes nothing, and never opens the phone preview. The person may " +
      "be asked first about code to trust; if the preview doesn't open, it says so. A second " +
      "request within a few seconds opens nothing more.",
    answeredBy: "window",
    savesVersionFirst: false,
    // It opens the browser: the assistant's answers stay in its panel.
    forAssistant: false,
    // Longer than the preview waits to open, so the app hears how that went (#1255).
    timeoutMs: PREVIEW_OPEN_WAIT_MS + 5_000,
  }),
  tool({
    name: "requestMedia",
    kind: "command",
    input: requestMediaInput,
    description: `Asks the person to add pictures or files to the site's Media, with your reason ("Photos of your workshop and team"), through Webforge's own Add files dialog. You never give a path or a web address, and nothing is downloaded: the person chooses the files on their computer, or adds none. Answers with the id, file name and kind of each one added, which updateFields takes as { "mediaId": id }. Choosing takes a person minutes: if they are still at it after ${WAITS}, it answers waiting with a requestId. Then ask mediaStatus with it a little later, rather than asking requestMedia again.`,
    answeredBy: "window",
    savesVersionFirst: true,
    // It asks for files: the assistant works with the site's Media as it is.
    forAssistant: false,
  }),
  tool({
    name: "mediaStatus",
    kind: "query",
    input: mediaStatusInput,
    description:
      "What became of a requestMedia that answered waiting: waiting still (the person is answering its question, or choosing files in Add files), done with the files added, or declined. Takes its requestId. An outcome is kept for half an hour, or until the site closes.",
    answeredBy: "window",
    savesVersionFirst: false,
    forAssistant: false,
  }),
] as const;

/** The name of one of {@link WINDOW_TOOLS}. */
export type WindowToolName = (typeof WINDOW_TOOLS)[number]["name"];

/** What `briefStatus` takes: the id `createSiteFromBrief` answered `waiting` with. */
export const briefStatusSchema = z.strictObject({ briefId: z.int().positive() });

/** What `changeStatus` takes: the id a change answered `waiting` with (#1364). */
export const changeStatusSchema = z.strictObject({ changeId: z.int().positive() });

/**
 * The tools main answers itself, beside the window's (4.12a): a new site is made without one open,
 * and the window that took the request starts over with it; and what became of a change whose
 * question outlived the app's call (#1364), which main's bridge keeps. None saves a version: none
 * changes the open site. Not the assistant's, which works on the site open.
 */
export const MAIN_TOOLS = [
  tool({
    name: "siteChoices",
    kind: "query",
    input: NOTHING,
    description:
      "What createSiteFromBrief chooses from: each business type with its kinds, templates (their pages, by id and title) and page recipes; the theme presets; and the curated palettes. Needs no site open.",
    answeredBy: "main",
    savesVersionFirst: false,
    forAssistant: false,
  }),
  tool({
    name: "createSiteFromBrief",
    kind: "command",
    input: siteBriefSchema,
    description: `Starts a new site from a brief: Webforge opens its quick start filled in with these answers, for the person to check, change and create, or not. Nothing is made until they click Create; the site open now is saved first. Answers once they have: done, with the new site open, or declined. If they haven't decided within ${WAITS}, it answers waiting with a briefId: ask briefStatus with it a little later. Give the business type, and its kind, name and what it does; a template, theme, brand colour (or palette), pages to leave out and recipes to add, and contact details, each optional, as siteChoices lists them. Refused in Content mode.`,
    answeredBy: "main",
    savesVersionFirst: false,
    forAssistant: false,
  }),
  tool({
    name: "briefStatus",
    kind: "query",
    input: briefStatusSchema,
    description:
      "What became of a brief createSiteFromBrief answered waiting for: waiting still, done with the new site open, or declined. Takes its briefId; an app reads only its own briefs, each outcome once.",
    answeredBy: "main",
    savesVersionFirst: false,
    forAssistant: false,
  }),
  tool({
    name: "changeStatus",
    kind: "query",
    input: changeStatusSchema,
    description: `What became of a change that answered waiting with a changeId: a plan, or any command whose question the person hadn't answered within ${WAITS}. Waiting still (the question is open in Webforge, however long the person takes), done (made, as the command answers), declined, or not-found if the site closed or the window reloaded first, so nothing changed. Takes its changeId; an app reads only its own changes, each outcome for half an hour. Ask it rather than sending the change again: one sent again while it waits is never made twice.`,
    answeredBy: "main",
    savesVersionFirst: false,
    forAssistant: false,
  }),
] as const;

/** The name of one of {@link MAIN_TOOLS}. */
export type MainToolName = (typeof MAIN_TOOLS)[number]["name"];

/** Whether `name` is one of {@link MAIN_TOOLS}. */
export const isMainTool = (name: string): name is MainToolName =>
  MAIN_TOOLS.some((each) => each.name === name);

/** The one of {@link WINDOW_TOOLS} named `name`, if any. */
export const windowTool = (name: string) => WINDOW_TOOLS.find((each) => each.name === name);
