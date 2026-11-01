import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { sessionIdSchema } from "./ipc/project.js";
import { ipcContract } from "./ipc-contract.js";

// Every channel that reads or changes the open site names the opening of it the renderer was
// loaded for, as its first argument (R6, #663): main refuses a call whose site a hand-off has
// replaced. Every channel is in one list or the other, so a new one fails here until it says which.

/** The channels that read or change the open site. */
const SITE_CHANNELS = [
  "project:commit",
  "project:set-ui-state",
  "project:save-zip",
  "media:import",
  "media:import-paths",
  "media:choose",
  "clipboard:write",
  "clipboard:read",
  "site:export",
  "site:export-choices",
  "site:set-export-choices",
  "site:open-export",
  "site:bundle-file",
  "preview:open",
  "preview:update",
  "preview:phone",
  "ai:listening",
  "trust:untrusted-code",
  "trust:trust-code",
] as const;

/** The others, and why none of them needs the opening. */
const OTHER_CHANNELS: Readonly<Record<string, string>> = {
  "app:get-info": "the app's name and version",
  "app:open-crash-reports": "the app's crash reports folder",
  "app:report-error": "a renderer's error, kept locally without site content",
  "app:log-failure": "a failure's code, kept locally without site content",
  "app:set-native-menus": "the menus macOS shows, made from the renderer's commands",
  "app:open-guide": "a guide page of the app's",
  "app:set-spellcheck-language": "the spelling checker's language",
  "canvas:compile-css": "CSS compiled from what the renderer sends, nothing read from the file",
  "canvas:class-catalogue": "the classes the site's CSS supports",
  "canvas:class-css": "a class's CSS",
  "canvas:item-html": "an element's HTML, from what the renderer sends",
  "clipboard:copy-text": "plain text to the system's clipboard",
  "fonts:list": "the app's font catalogue",
  "fonts:browse": "the app's font catalogue",
  "fonts:download": "a font for the app, not the site",
  "prefs:get": "the person's preferences",
  "prefs:set": "the person's preferences",
  "project:create": "opens another site: a hand-off of its own",
  "project:open": "opens another site: a hand-off of its own",
  "project:open-zip": "opens a ZIP as another site: a hand-off of its own",
  "project:open-recent": "opens another site: a hand-off of its own",
  "project:get-current": "gives a page the opening it was loaded for",
  "project:read-site": "a page's first read, as it learns its opening",
  "project:get-ui-state": "a page's first read, as it learns its opening",
  "project:list-recent": "the Recent list, the app's",
  "project:pin-recent": "the Recent list, the app's",
  "project:remove-recent": "the Recent list, the app's",
  "project:clear-recent": "the Recent list, the app's",
  "project:flushed": "the window's answer to main's flush before it closes",
  "site:cancel-export": "cancels whichever export is under way",
  "templates:list": "the app's templates",
  "themes:list": "My themes, the app's",
  "themes:keep": "My themes, the app's",
  "themes:remove": "My themes, the app's",
  "preview:show": "takes the browsers to a page: no site content",
  "preview:stop-phone": "stops the preview's listener on the network",
  "ai:answer": "answers a request by its id; a reload settles those waiting (ai-ipc.ts)",
  "publish:testConnection": "a destination's connection, nothing of the site",
  "publish:readHostKey": "a server's key, nothing of the site",
  "publish:chooseKeyFile": "a key file the person chooses, nothing of the site",
};

const channels = Object.values(ipcContract);

describe("the open site's channels (R6, #663)", () => {
  it("lists every channel once, as the site's or another's", () => {
    const listed = [...SITE_CHANNELS, ...Object.keys(OTHER_CHANNELS)];
    expect(new Set(listed).size).toBe(listed.length);
    expect(channels.map((entry) => entry.channel).sort()).toEqual([...listed].sort());
  });

  it("names the opening first on every channel that reads or changes the open site", () => {
    for (const name of SITE_CHANNELS) {
      const entry = channels.find((each) => each.channel === name);
      const [first] = (entry?.request as z.ZodTuple | undefined)?.def.items ?? [];
      expect(first, name).toBe(sessionIdSchema);
    }
  });
});
