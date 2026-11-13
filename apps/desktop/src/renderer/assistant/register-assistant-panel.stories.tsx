import type { Meta, StoryObj } from "@storybook/react-vite";
import { panelStory } from "../testing/stories.js";
import { createFakeAssistant, FAKE_STATUS, type FakeAssistantOptions } from "./fake-assistant.js";
import { registerAssistantPanel } from "./register-assistant-panel.js";

// The assistant's panel (6.9c, UX-28) on 6.9a's stand-in for main: what it shows off, on a site not
// asked yet, and with a reply that changed the site.
const meta = { title: "Panels/Assistant" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The panel on the stand-in, with `message` sent first when given. */
const story = (options: FakeAssistantOptions, message?: string): Story =>
  panelStory((panels, session) => {
    const api = createFakeAssistant({ delayMs: 0, ...options });
    if (message !== undefined) void api.send("story", message, {});
    return registerAssistantPanel({
      panels,
      session,
      api,
      sessionId: "story",
      settings: { show: async () => false },
      openLink: () => undefined,
    });
  });

/** Not set up yet: Preferences turns it on. */
export const Off: Story = story({
  status: { ...FAKE_STATUS, enabled: false, consentVersion: null },
});

/** The first time on a site: its own yes first. */
export const SiteNotAsked: Story = story({ siteConsent: { asked: false, allowed: false } });

/** A reply that changed the site: its text, its cost and the review card. */
export const Replied: Story = story({}, "Say we open on Saturdays");
