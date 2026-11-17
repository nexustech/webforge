import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = {
  title: "Site components/Table",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A price list in a section: three columns, on Mobile each row stacked as heading and value. */
export const Table: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          id: "section",
          content: [
            {
              type: "Heading",
              props: { id: "heading", text: "Celebration cakes", size: "medium" },
            },
            {
              type: "Table",
              props: {
                id: "cakes",
                columns: "3",
                heading1: "Cake",
                heading2: "Serves",
                heading3: "Price",
                rows: [
                  ["Lemon drizzle", "8", "£18"],
                  ["Chocolate fudge", "12", "£26"],
                  ["Carrot and walnut", "10", "£22"],
                ].map(([cell1, cell2, cell3], index) => ({
                  type: "TableRow",
                  props: { id: `cake-${index}`, cell1, cell2, cell3 },
                })),
              },
            },
          ],
        },
      },
    ],
  },
};
