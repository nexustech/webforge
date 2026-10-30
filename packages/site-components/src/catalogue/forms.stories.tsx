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

/** A Form element in a Section, as it starts: a name, an email address and a message (2.11). */
export const FormElement: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          id: "section",
          ...siteLibrary.components.Section?.defaults,
          contentWidth: "medium",
          content: [
            { type: "Heading", props: { id: "heading", text: "Book a table", size: "medium" } },
            { type: "Form", props: { id: "booking", ...siteLibrary.components.Form?.defaults } },
          ],
        },
      },
    ],
  },
};

/** A Form with every kind of field: some optional, a tick box and a choice from a list. */
export const FormEveryField: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          id: "section",
          ...siteLibrary.components.Section?.defaults,
          contentWidth: "medium",
          content: [
            {
              type: "Form",
              props: {
                id: "order",
                ...siteLibrary.components.Form?.defaults,
                label: "Cake order",
                buttonLabel: "Order",
                fields: [
                  {
                    type: "FormField",
                    props: { id: "f1", kind: "text", label: "Name", required: true, options: [] },
                  },
                  {
                    type: "FormField",
                    props: {
                      id: "f2",
                      kind: "email",
                      label: "Email address",
                      required: true,
                      options: [],
                    },
                  },
                  {
                    type: "FormField",
                    props: {
                      id: "f3",
                      kind: "phone",
                      label: "Phone number",
                      required: false,
                      options: [],
                    },
                  },
                  {
                    type: "FormField",
                    props: {
                      id: "f4",
                      kind: "select",
                      label: "Cake",
                      required: true,
                      options: [
                        { id: "o1", label: "Lemon drizzle" },
                        { id: "o2", label: "Chocolate" },
                      ],
                    },
                  },
                  {
                    type: "FormField",
                    props: {
                      id: "f5",
                      kind: "message",
                      label: "Message on the cake",
                      required: false,
                      options: [],
                    },
                  },
                  {
                    type: "FormField",
                    props: {
                      id: "f6",
                      kind: "checkbox",
                      label: "Send me news now and then",
                      required: false,
                      options: [],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ],
  },
};
