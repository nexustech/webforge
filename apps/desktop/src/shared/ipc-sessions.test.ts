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
  "assistant:site-consent",
  "assistant:set-site-consent",
  "assistant:send",
  "assistant:draft",
  "assistant:new-conversation",
  "assistant:conversation",
  "assistant:open-link",
  "assistant:apply-held",
  "assistant:discard-held",
  "versions:list",
  "versions:save",
  "versions:delete",
  "versions:read-site",
  "versions:clean-up",
  "preview:version",
  "versions:open-as-new-site",
  "publish:destinations",
  "publish:saveDestination",
  "publish:removeDestination",
  "publish:testSavedDestination",
  "publish:publish",
  "netlify:save-destination",
  "netlify:sites",
  "netlify:create-site",
  "netlify:test-saved",
  "netlify:check-access",
] as const;

/** The others, and why none of them needs the opening. */
const OTHER_CHANNELS: Readonly<Record<string, string>> = {
  "app:get-info": "the app's name and version",
  "app:open-crash-reports": "the app's crash reports folder",
  "app:report-error": "a renderer's error, kept locally without site content",
  "app:log-failure": "a failure's code, kept locally without site content",
  "app:set-native-menus": "the menus macOS shows, made from the renderer's commands",
  "app:open-guide": "a guide page of the app's",
  "app:list-licences": "the app's own third-party notices",
  "app:open-chromium-licences": "Electron's own Chromium licences file",
  "app:set-spellcheck-language": "the spelling checker's language",
  "canvas:compile-css": "CSS compiled from what the renderer sends, nothing read from the file",
  "canvas:class-catalogue": "the classes the site's CSS supports",
  "canvas:class-css": "a class's CSS",
  "canvas:item-html": "an element's HTML, from what the renderer sends",
  "clipboard:copy-text": "plain text to the system's clipboard",
  "clipboard:copy-secret": "an AI app's key to the system's clipboard, cleared in a minute",
  "fonts:list": "the app's font catalogue",
  "fonts:browse": "the app's font catalogue",
  "fonts:download": "a font for the app, not the site",
  "help:open": "the app's help pages, which come with it",
  "help:open-external": "a page on the web a help page links to",
  "mcp:status": "AI apps, which are the app's, whichever site is open",
  "assistant:status": "the assistant's settings and sign-in, the app's, whichever site is open",
  "assistant:set-enabled": "the assistant's consent for the app, whichever site is open",
  "assistant:update": "the assistant's settings, the app's, whichever site is open",
  "assistant:sign-in": "the assistant's OpenRouter sign-in, the app's, whichever site is open",
  "assistant:finish-sign-in": "the assistant's OpenRouter sign-in, the app's",
  "assistant:cancel-sign-in": "the assistant's OpenRouter sign-in, the app's",
  "assistant:set-key": "the assistant's provider key, the app's, whichever site is open",
  "assistant:models": "the assistant's provider's models, the app's, whichever site is open",
  "assistant:stop":
    "a reply by its id, which main has kept with its site: stopping one only ever stops sending",
  "mcp:set-enabled": "AI apps, which are the app's, whichever site is open",
  "mcp:add": "AI apps, which are the app's, whichever site is open",
  "mcp:install": "an AI app's install, as its kind does, the app's, whichever site is open",
  "mcp:remove": "AI apps, which are the app's, whichever site is open",
  "mcp:seen-moved": "AI apps, which are the app's, whichever site is open",
  "posts:choose-files":
    "files chosen to import posts from, read as text; the renderer adds the posts (6.10b)",
  "prefs:get": "the person's preferences",
  "updates:status": "the app's own update, whichever site is open",
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
  "ai:brief-answer":
    "what became of an AI app's brief, a new site the window makes whichever is open (site-brief.ts)",
  "publish:testConnection": "a destination's connection, nothing of the site",
  "publish:readHostKey": "a server's key, nothing of the site",
  "publish:chooseKeyFile": "a key file the person chooses, nothing of the site",
  "publish:cancel": "cancels whichever publish is under way",
  "publish:open-live": "opens where a publish went live, by its operation, nothing of the site",
  "netlify:status": "whether this build can offer Netlify's sign-in",
  "netlify:sign-in": "a Netlify sign-in, held in main, nothing of the site",
  "netlify:cancel-sign-in": "cancels a Netlify sign-in by its operation",
  "netlify:forget-sign-in": "drops a held Netlify sign-in, nothing of the site",
  "netlify:sign-in-with-token": "checks a pasted Netlify token, nothing of the site",
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
