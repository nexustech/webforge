import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";
import { siteLibrary } from "./index.js";

const meta = {
  title: "Site components/Forms",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

// The forms post to the stories' form service (Site Settings), or the Newsletter's own address.

/** A contact form under its title and text, as it starts. */
export const ContactForm: Story = {
  args: {
    nodes: [
      {
        type: "ContactForm",
        props: { id: "contact-form", ...siteLibrary.components.ContactForm?.defaults },
      },
    ],
  },
};

/** A contact form beside its text, asking for a phone number too. */
export const ContactFormBesideText: Story = {
  args: {
    nodes: [
      {
        type: "ContactForm",
        props: {
          id: "contact-form",
          ...siteLibrary.components.ContactForm?.defaults,
          askPhone: true,
          variant: "split",
        },
      },
    ],
  },
};

/** A newsletter signup, as it starts. */
export const Newsletter: Story = {
  args: {
    nodes: [
      {
        type: "Newsletter",
        props: {
          id: "newsletter",
          ...siteLibrary.components.Newsletter?.defaults,
          action: "https://example.com/signup",
        },
      },
    ],
  },
};

/** A newsletter signup beside its text, asking for a name too. */
export const NewsletterBesideText: Story = {
  args: {
    nodes: [
      {
        type: "Newsletter",
        props: {
          id: "newsletter",
          ...siteLibrary.components.Newsletter?.defaults,
          action: "https://example.com/signup",
          askName: true,
          variant: "split",
        },
      },
    ],
  },
};
