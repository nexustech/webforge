import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";
import { siteLibrary } from "./index.js";

const meta = {
  title: "Site components/Contact details",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

// The opening hours and contact details come from the stories' Site Settings.

/** The opening hours beside the contact details, as the section starts. */
export const SideBySide: Story = {
  args: {
    nodes: [
      {
        type: "ContactDetails",
        props: { id: "contact", ...siteLibrary.components.ContactDetails?.defaults },
      },
    ],
  },
};

/** The opening hours above the contact details. */
export const OneAboveTheOther: Story = {
  args: {
    nodes: [
      {
        type: "ContactDetails",
        props: {
          id: "contact",
          ...siteLibrary.components.ContactDetails?.defaults,
          variant: "stacked",
        },
      },
    ],
  },
};
