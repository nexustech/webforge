import type { Meta, StoryObj } from "@storybook/react-vite";
import type { PageId } from "@webforge/model";
import { BusinessDraftDialog } from "./BusinessDraftDialog.js";
import type { BusinessText } from "./business-draft.js";
import type { DraftState } from "./use-draft.js";

// The quick start's business step (QS-7, #873): the home and About pages' words the assistant
// drafted from what the person said about their business, for review before they're used.
const meta = { title: "Assistant/Words for Your Pages", tags: ["full-window"] } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const HOME = "home" as PageId;
const ABOUT = "about" as PageId;

/** A text of the template's, at `role`. */
const text = (
  pageId: PageId,
  nodeId: string,
  role: string,
  sample: string,
  rich = false,
): BusinessText => ({ pageId, nodeId, field: "text", rich, role, sample });

const TEXTS: readonly BusinessText[] = [
  text(HOME, "hero-title", "Home · Hero · Title", "Fresh coffee, slow mornings"),
  text(HOME, "hero-text", "Home · Hero · Text", "A neighbourhood café by the river.", true),
  text(ABOUT, "story-heading", "About us · Heading · Text", "Our story"),
  text(ABOUT, "story-text", "About us · Text · Text", "Hannah and Sam opened in 2015.", true),
];

/** The dialog at `state`. */
const at = (state: DraftState): Story => ({
  render: () => (
    <BusinessDraftDialog
      open
      texts={TEXTS}
      state={state}
      onSiteAnswer={() => undefined}
      onUse={() => undefined}
      onAgain={() => undefined}
      onCancel={() => undefined}
    />
  ),
});

/** The words, ready to change and use. */
export const Draft: Story = at({
  step: "draft",
  texts: [
    "Sourdough worth the walk",
    "Bread and cakes baked every morning on Kirkgate, Leeds.",
    "How we started",
    "Two friends and one oven.\n\nWe still bake every loaf by hand, before the sun is up.",
  ],
});

/** Waiting for the assistant. */
export const Writing: Story = at({ step: "writing" });

/** This new site hasn't been asked yet. */
export const SiteQuestion: Story = at({
  step: "site",
  site: "Rise Bakery",
  reach: { kind: "openrouter", maker: "Anthropic" },
});
