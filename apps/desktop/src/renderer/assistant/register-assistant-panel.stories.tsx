import type { Meta, StoryObj } from "@storybook/react-vite";
import { panelStory } from "../testing/stories.js";
import {
  createFakeAssistant,
  FAKE_STATUS,
  type FakeAssistantOptions,
  type FakeReply,
} from "./fake-assistant.js";
import { registerAssistantPanel } from "./register-assistant-panel.js";

// The assistant's panel (6.9c, UX-28) on 6.9a's stand-in for main: what it shows off, on a site not
// asked yet, and with a reply that changed the site.
const meta = { title: "Panels/Assistant" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The panel on the stand-in, with `message` sent first when given, its reply with `more`. */
const story = (
  options: FakeAssistantOptions,
  message?: string,
  more: Partial<FakeReply> = {},
): Story =>
  panelStory((panels, session) => {
    // The reply's change, in the site's Undo History, so its card can undo it.
    session.history.run("AI (Assistant): Edited Hero text", (site) => {
      site.settings.general.name = "Rosie's Bakery";
    });
    const entryId = session.history.entries().at(-1)?.id ?? "";
    const api = createFakeAssistant({
      delayMs: 0,
      reply: {
        text: "I've rewritten the Hero's heading to say you open on Saturdays.",
        steps: [{ entryId, label: "AI (Assistant): Edited Hero text", target: { pageId: "home" } }],
        costUsd: 0.12,
        ...more,
      },
      ...options,
    });
    if (message !== undefined) void api.send("story", message, {});
    return registerAssistantPanel({
      panels,
      session,
      api,
      sessionId: "story",
      openSettings: () => undefined,
      openCredits: () => undefined,
      openExamples: () => undefined,
    }).remove;
  });

/** Not set up yet: Settings turns it on. */
export const Off: Story = story({
  status: { ...FAKE_STATUS, enabled: false, consentVersion: null },
});

/** The first time on a site: its own yes first. */
export const SiteNotAsked: Story = story({ siteConsent: { asked: false, allowed: false } });

/** A reply that changed the site: its text, its cost and the review card. */
export const Replied: Story = story({}, "Say we open on Saturdays");

/** A reply that failed: why, and what the person can do about it (5.20, OL-5). */
export const ReplyFailed: Story = story(
  { reply: { text: "Let me look at your opening hours.", fail: "no-credit" } },
  "Say we open on Saturdays",
);

/** A reply that changed the site, then what to ask next under its review card (5.17, OL-2). */
export const RepliedWithSuggestions: Story = story({}, "Say we open on Saturdays", {
  suggestions: [
    "Add our opening hours to the Contact page",
    "Make the welcome text friendlier",
    "Add a photo of the shop to the Hero",
  ],
});

/**
 * A message typed while a reply is under way (5.19, OL-4): held above the box, to be sent when the
 * reply finishes, with Edit and Remove. The reply here doesn't finish, so it stays held.
 */
export const MessageWaiting: Story = {
  ...story({ delayMs: 1_000_000 }),
  play: async ({ canvas, userEvent }) => {
    const box = await canvas.findByRole("textbox", { name: "Message the assistant" });
    await userEvent.type(box, "Say we open on Saturdays{Enter}");
    await userEvent.type(box, "And on Sundays, from 9am");
    await userEvent.click(await canvas.findByRole("button", { name: "Send After This Reply" }));
    await canvas.findByRole("region", { name: "Message waiting to send" });
  },
};
