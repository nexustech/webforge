import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = {
  title: "Site components/Tabs",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

// As a page shows them without the script, which stories don't run, and as the canvas does: every
// panel in turn under its label. The tabs behaviour makes them tabs (see its tests and the export
// E2E).

/** Tabs of a café's menu in a Section, under a Heading. */
export const Tabs: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          id: "section",
          contentWidth: "medium",
          content: [
            { type: "Heading", props: { id: "heading", text: "Our menu", size: "medium" } },
            {
              type: "Tabs",
              props: {
                id: "menu",
                tabs: [
                  ["breakfast", "Breakfast", "Eggs any way, sourdough toast and fresh juice."],
                  ["lunch", "Lunch", "Soup of the day, sandwiches and salads."],
                  ["cakes", "Cakes", "Lemon drizzle, carrot cake and brownies."],
                ].map(([id, label, words]) => ({
                  type: "Tab",
                  props: {
                    id,
                    label,
                    content: [
                      { type: "Text", props: { id: `${id}-text`, text: `<p>${words}</p>` } },
                    ],
                  },
                })),
              },
            },
          ],
        },
      },
    ],
  },
};
