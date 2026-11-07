import { z } from "zod";

/** A help page's id: its file name in `docs/help/` without `.md` (HP-2). */
const helpPageIdSchema = z
  .string()
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

/**
 * Where Help opens (5.4b): a page and maybe a heading on it, as `@webforge/help`'s anchors are
 * (`site-check` and `tips`). Without a page, the contents.
 */
export const helpTargetSchema = z.strictObject({
  page: helpPageIdSchema.optional(),
  anchor: z
    .string()
    .max(100)
    .regex(/^[\p{L}\p{N}_-]+$/u)
    .optional(),
});

/** See {@link helpTargetSchema}. */
export type HelpTarget = z.infer<typeof helpTargetSchema>;

/** The editor's look, which the Help window follows. */
export const helpThemeSchema = z.enum(["dark", "light"]);

/**
 * IPC channels of the `help` domain (`help:*`), between the main process and two renderers: the
 * editor window opens Help, and the Help window (5.4b, HP-10) opens a page on the web in the
 * browser. Each renderer may call only its own (`main/help-window.ts`).
 */
export const helpChannels = {
  /**
   * Opens the Help window at `target`, or brings it to the front there if it's open. From the
   * editor window only. False if it couldn't.
   */
  helpOpen: {
    channel: "help:open",
    request: z.tuple([helpTargetSchema]),
    response: z.boolean(),
  },
  /**
   * Opens an `https://` or `http://` page a help page links to in the default browser. From the
   * Help window only. False if it couldn't.
   */
  helpOpenExternal: {
    channel: "help:open-external",
    request: z.tuple([z.url({ protocol: /^https?$/ }).max(2048)]),
    response: z.boolean(),
  },
} as const;

/** Messages the main process sends to the Help window. Its preload checks each one's arguments. */
export const helpEvents = {
  /** Show this page and heading: the window was opened again (5.4b). */
  show: { channel: "help:show", args: z.tuple([helpTargetSchema]) },
  /** The editor's look changed (View › Use Light/Dark Appearance). */
  theme: { channel: "help:theme", args: z.tuple([helpThemeSchema]) },
} as const;

/** `window.webforge.help`, the editor window's. */
export interface HelpApi {
  /** Opens the Help window at `target`; false if it couldn't. */
  open(target: HelpTarget): Promise<boolean>;
}

/** `window.webforgeHelp`, the Help window's whole API (its own preload, `preload/help.ts`). */
export interface HelpWindowApi {
  /** Opens a page on the web in the default browser; false if it couldn't. */
  openExternal(url: string): Promise<boolean>;
  /** Calls `show` whenever Help is opened again at another page. Returns a stop function. */
  onShow(show: (target: HelpTarget) => void): () => void;
  /** Calls `apply` whenever the editor's look changes. Returns a stop function. */
  onTheme(apply: (theme: z.infer<typeof helpThemeSchema>) => void): () => void;
}
