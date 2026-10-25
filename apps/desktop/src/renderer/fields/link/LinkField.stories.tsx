import type { Meta, StoryObj } from "@storybook/react-vite";
import { linkFieldRenderer } from "../../links/index.js";
import { sessionWith } from "../../testing/fixtures.js";

// The Edit panel's link field (F-ED-18, 2.20 B5), as the app draws it: where the link goes in a
// few words, and the buttons that open the link dialog and remove the link.

const session = sessionWith();
const LinkField = linkFieldRenderer({ session });

const meta = {
  title: "Edit/Fields/Link",
  component: LinkField,
  args: {
    id: "field-link",
    labelId: "field-link-label",
    field: { kind: "link", label: "Button link" },
    value: undefined,
    onChange: () => undefined,
    onCommit: () => undefined,
  },
  // As in the Edit panel: its label above, in the right column's width.
  render: (args) => (
    <div className="flex w-60 flex-col gap-1 border border-border-strong bg-panel p-2">
      <span id="field-link-label" className="text-xs text-muted-foreground">
        Button link
      </span>
      <LinkField {...args} />
    </div>
  ),
} satisfies Meta<typeof LinkField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No link yet. */
export const Empty: Story = {};

/** A link to one of the site's pages. */
export const ToAPage: Story = {
  args: { value: { kind: "page", pageId: session.history.document.getState().homePageId } },
};

/** A link to an e-mail address, opening in a new tab. */
export const ToAnAddress: Story = {
  args: { value: { kind: "email", address: "hello@rosas-bakery.example", newTab: true } },
};
