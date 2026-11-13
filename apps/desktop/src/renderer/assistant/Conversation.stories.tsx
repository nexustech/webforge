import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConversationView, type TurnView } from "./ConversationView.js";

// The assistant's conversation (6.9c, ADR 0026 §7) at the width of a side panel: replies in
// limited Markdown, what they did, why they stopped, and their cost.
const meta = { title: "Assistant/Conversation" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const DONE: TurnView = {
  replyId: "r1",
  message: "Make the Hero's title shorter and add our opening hours under it",
  reply: [
    "I shortened the title to **Fresh bread daily** and added the hours:",
    "",
    "- Monday to Friday, 7am to 6pm",
    "- Saturday, 8am to 2pm",
    "",
    "See the [Google Business page](https://business.example.com/bakery) to check they match.",
  ].join("\n"),
  state: "done",
  stop: "end",
  costUsd: 0.0042,
  tools: [
    { callId: "a", state: "done" },
    { callId: "b", state: "done" },
    {
      callId: "c",
      state: "done",
      step: { entryId: "e1", label: "AI (Assistant): Edited Hero title" },
    },
    {
      callId: "d",
      state: "done",
      step: { entryId: "e2", label: "AI (Assistant): Added Text to Hero" },
    },
  ],
};

/** The conversation, in a box a side panel's width. */
const panel = (turns: TurnView[]): Story => ({
  render: () => (
    <div className="w-80 rounded-md border border-border bg-panel">
      <ConversationView turns={turns} onOpenLink={() => undefined} />
    </div>
  ),
});

/** Nothing asked yet. */
export const Empty: Story = panel([]);

/** A reply streaming, a change under way. */
export const Replying: Story = panel([
  {
    replyId: "r1",
    message: "Make the Hero's title shorter",
    reply: "I'll shorten it to **Fresh",
    state: "replying",
    costUsd: null,
    tools: [
      { callId: "a", state: "done" },
      { callId: "b", state: "running" },
    ],
  },
]);

/** A reply that changed two things, with a link showing its address, and its cost. */
export const Done: Story = panel([DONE]);

/** Replies that stopped early or failed, a change declined, and one with no cost shown. */
export const StoppedAndFailed: Story = panel([
  {
    ...DONE,
    replyId: "r1",
    message: "Translate every page into French",
    reply: "I translated the Home page.",
    stop: "tool-cap",
    tools: [{ callId: "x", state: "declined" }],
  },
  {
    replyId: "r2",
    message: "Carry on",
    reply: "",
    state: "failed",
    error: "no-credit",
    costUsd: null,
    tools: [],
  },
]);
