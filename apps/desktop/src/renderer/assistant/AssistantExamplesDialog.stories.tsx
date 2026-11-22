import type { Meta, StoryObj } from "@storybook/react-vite";
import { AssistantExamplesDialog } from "./AssistantExamplesDialog.js";

// Things You Can Ask (5.21, OL-8): example requests for the assistant by topic, each with Try It,
// opened from the Assistant panel and from Help.
const meta = { title: "Assistant/Things You Can Ask", tags: ["full-window"] } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Every example, by topic. */
export const Examples: Story = {
  render: () => (
    <AssistantExamplesDialog open onOpenChange={() => undefined} onTry={() => undefined} />
  ),
};
