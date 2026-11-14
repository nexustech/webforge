import type { Meta, StoryObj } from "@storybook/react-vite";
import { RewriteDialog, type RewriteState } from "./RewriteDialog.js";

// The format toolbar's Rewrite (G25a, #873): the assistant's suggestion beside the person's text,
// for review before it's used; the site's question first, and why there's no suggestion.
const meta = { title: "Assistant/Rewrite", tags: ["full-window"] } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const TEXT =
  "We are open every single day of the week from nine o'clock in the morning until five in the afternoon.";

/** The dialog at `state`. */
const at = (state: RewriteState, formatted = false): Story => ({
  render: () => (
    <RewriteDialog
      open
      how="shorter"
      original={TEXT}
      formatted={formatted}
      state={state}
      onSiteAnswer={() => undefined}
      onUse={() => undefined}
      onAgain={() => undefined}
      onCancel={() => undefined}
    />
  ),
});

/** The suggestion, ready to use; the selection had a link, which a rewrite leaves out. */
export const Suggestion: Story = at({ step: "draft", text: "Open daily, 9am to 5pm." }, true);

/** Waiting for the assistant. */
export const Writing: Story = at({ step: "writing" });

/** This site hasn't been asked yet. */
export const SiteQuestion: Story = at({
  step: "site",
  site: "Rosie's Bakery",
  reach: { kind: "openrouter", maker: "Anthropic" },
});

/** The provider refused: why, and Try Again. */
export const Failed: Story = at({ step: "failed", error: "no-credit" });
