import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReviewCard } from "./ReviewCard.js";
import type { ReplyUndo } from "./reply-undo.js";

// The review card after a reply that changed the site (AIA-5, WF-2), at a side panel's width.
const meta = { title: "Assistant/Review card" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const STEPS = [
  {
    entryId: "e1",
    label: "AI (Assistant): Edited Hero title",
    target: { pageId: "home", nodeId: "hero" },
  },
  {
    entryId: "e2",
    label: "AI (Assistant): Added Text to Hero",
    target: { pageId: "home", nodeId: "hero" },
  },
  { entryId: "e3", label: "AI (Assistant): Changed Brand colour" },
];

/** The card in `undo`'s state, with a link to another website. */
const card = (undo: ReplyUndo): Story => ({
  render: () => (
    <div className="w-80 rounded-md border border-border bg-panel p-3">
      <ReviewCard
        steps={STEPS}
        links={[{ host: "business.example.com", href: "https://business.example.com/bakery" }]}
        undo={undo}
        onKeep={() => undefined}
        onUndo={() => undefined}
        onOpenVersions={() => undefined}
        onShowStep={() => undefined}
      />
    </div>
  ),
});

/** Right after the reply: Keep, or Undo These Changes. */
export const JustChanged: Story = card({ kind: "undo", to: "e0" });

/** Something has happened since: only the version saved before the changes can take them back. */
export const MovedOn: Story = card({ kind: "moved-on" });

/** Undone already. */
export const Undone: Story = card({ kind: "undone" });
