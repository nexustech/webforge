import type { Meta, StoryObj } from "@storybook/react-vite";
import { SuggestedNext } from "./SuggestedNext.js";

// What the person might ask next (5.17, OL-2), under a reply that changed the site, at a side
// panel's width.
const meta = { title: "Assistant/Suggested next" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const SUGGESTIONS = [
  "Add our opening hours to the home page",
  "Make the welcome text friendlier",
  "Add a photo gallery of our cakes, with a short caption under each one",
];

/** The suggestions at a side panel's width. */
function Panel({ busy = false, suggestions = SUGGESTIONS }) {
  return (
    <div className="w-80 rounded-md border border-border bg-panel p-3">
      <SuggestedNext suggestions={suggestions} busy={busy} onSend={() => undefined} />
    </div>
  );
}

/** Three suggestions, each a button that sends it. */
export const Three: Story = { render: () => <Panel /> };

/** Two, the fewest offered. */
export const Two: Story = { render: () => <Panel suggestions={SUGGESTIONS.slice(0, 2)} /> };

/** A message on its way: the suggestions wait. */
export const Sending: Story = { render: () => <Panel busy /> };
