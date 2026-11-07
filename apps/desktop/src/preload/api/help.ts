import { type HelpApi, type HelpWindowApi, helpEvents } from "../../shared/ipc/help.js";
import type { Call, Subscribe } from "./call.js";

/** `window.webforge.help`, the editor window's: it opens Help. */
export const helpApi = (call: Call): HelpApi => ({
  open: (target) => call("helpOpen", target),
});

/**
 * `window.webforgeHelp`, the Help window's whole API (5.4b): a page on the web opened in the
 * browser, and the pages and look main tells it to show. Nothing else of main's reaches it.
 */
export const helpWindowApi = (call: Call, subscribe: Subscribe): HelpWindowApi => ({
  openExternal: (url) => call("helpOpenExternal", url),
  onShow: (show) =>
    subscribe(helpEvents.show.channel, (...args) => {
      const parsed = helpEvents.show.args.safeParse(args);
      if (parsed.success) show(parsed.data[0]);
    }),
  onTheme: (apply) =>
    subscribe(helpEvents.theme.channel, (...args) => {
      const parsed = helpEvents.theme.args.safeParse(args);
      if (parsed.success) apply(parsed.data[0]);
    }),
});
