import type { Meta, StoryObj } from "@storybook/react-vite";
import type { PageId } from "@webforge/model";
import { userEvent, within } from "storybook/test";
import { starterSite } from "../editor/starter-site.js";
import { LinkDialog } from "./LinkDialog.js";
import type { PageTarget } from "./link-targets.js";

const ABOUT = "about" as PageId;

const targets: PageTarget[] = [
  {
    id: "home" as PageId,
    title: "Home",
    sections: [{ nodeId: "hero", label: "Hero", anchorId: undefined }],
  },
  {
    id: ABOUT,
    title: "About us",
    sections: [
      { nodeId: "story", label: "Our story", anchorId: "our-story" },
      { nodeId: "times", label: "Opening times", anchorId: undefined },
    ],
  },
];

const noop = () => undefined;

const meta = {
  title: "Dialogs/Link",
  component: LinkDialog,
  args: {
    open: true,
    link: { kind: "page", pageId: ABOUT, anchor: "our-story" },
    site: starterSite(),
    targets,
    onSave: noop,
    onCancel: noop,
  },
} satisfies Meta<typeof LinkDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A link to a section of a page (F-ED-18). */
export const ToASection: Story = {};

/** An email link, with a subject. */
export const Email: Story = {
  args: { link: { kind: "email", address: "hello@example.com", subject: "A cake order" } },
};

/** An address that isn't one yet: the dialog says what's needed and won't save. */
export const NotAnAddress: Story = {
  args: { link: undefined },
  play: async () => {
    const dialog = within(document.body);
    await userEvent.click(dialog.getByRole("radio", { name: "Web address" }));
    await userEvent.type(dialog.getByRole("textbox", { name: "Web address" }), "not a web address");
  },
};
