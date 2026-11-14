import type { Meta, StoryObj } from "@storybook/react-vite";
import { HeldCard, type HeldOutcome } from "./HeldCard.js";

// The card for a reply's held changes (6.9e, AIA-5's Review before applying), at a side panel's
// width.
const meta = { title: "Assistant/Held changes" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const HELD = [
  { label: "AI (Assistant): Edited Hero title" },
  { label: "AI (Assistant): Added Text to Hero" },
  { label: "AI (Assistant): Changed Brand colour" },
];

/** The card waiting, applying, or after the changes went. */
const card = (options: { applying?: boolean; outcome?: HeldOutcome }): Story => ({
  render: () => (
    <div className="w-80 rounded-md border border-border bg-panel p-3">
      <HeldCard
        held={options.outcome === undefined ? HELD : []}
        links={[{ host: "business.example.com", href: "https://business.example.com/bakery" }]}
        outcome={options.outcome}
        applying={options.applying === true}
        onApply={() => undefined}
        onDiscard={() => undefined}
      />
    </div>
  ),
});

/** Right after the reply: nothing changed yet; Apply Changes, or Discard. */
export const Waiting: Story = card({});

/** Applying: the buttons wait. */
export const Applying: Story = card({ applying: true });

/** Discarded by the person. */
export const Discarded: Story = card({ outcome: "discarded" });

/** Dropped when the person sent a new message. */
export const Replaced: Story = card({ outcome: "replaced" });
