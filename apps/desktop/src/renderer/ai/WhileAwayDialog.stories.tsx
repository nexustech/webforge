import type { Meta, StoryObj } from "@storybook/react-vite";
import { WhileAwayDialog } from "./WhileAwayDialog.js";

const meta = {
  title: "AI/WhileAwayDialog",
  component: WhileAwayDialog,
  args: {
    open: true,
    onShowPage: () => undefined,
    onUndoAll: () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof WhileAwayDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Claude Desktop worked without asking while the person was away (5.36, UA-3): its changes by
 * page, each page's name showing it, those on every page apart, and Undo All.
 */
export const Changes: Story = {
  args: {
    apps: [
      {
        app: "Claude Desktop",
        firstAt: 0,
        pages: [
          {
            pageId: "home",
            title: "Home",
            changes: ["Edited Hero text", "Added Testimonials", "Edited Testimonials text"],
          },
          { pageId: "menu", title: "Menu", changes: ["Added page 'Menu'", "Added Gallery"] },
          { pageId: null, title: "Every page", changes: ["Changed the theme"] },
        ],
      },
    ],
  },
};

/** Undo All under way: the buttons wait for it. */
export const UndoingAll: Story = {
  args: { ...Changes.args, apps: Changes.args?.apps ?? [], undoing: "Claude Desktop" },
};
