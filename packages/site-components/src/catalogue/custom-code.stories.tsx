import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = {
  title: "Site components/Custom Code",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

// As the editor shows Custom Code: sanitised (its script gone) and labelled. The export writes it
// as it is.

/** Custom Code in a Section: the person's own HTML, with a script that doesn't run here. */
export const CustomCode: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          id: "section",
          contentWidth: "medium",
          content: [
            {
              type: "CustomCode",
              props: {
                id: "custom",
                code: '<div class="rounded-box bg-accent p-4 text-accent-content"><strong>Sale:</strong> 20% off cakes this week.</div><script>console.log("not in the editor")</script>',
              },
            },
          ],
        },
      },
    ],
  },
};

/** Custom Code before its HTML is written: where to write it. */
export const CustomCodeEmpty: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          id: "section",
          contentWidth: "medium",
          content: [{ type: "CustomCode", props: { id: "custom", code: "" } }],
        },
      },
    ],
  },
};
