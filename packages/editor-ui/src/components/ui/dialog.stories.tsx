import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "./button.js";
import {
  Dialog,
  DialogCancel,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useUnsavedChanges,
} from "./dialog.js";

const meta = {
  title: "Base/Dialog",
  component: Dialog,
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PageSettings: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Page Settings</DialogTitle>
          <DialogDescription>The title and description search engines show.</DialogDescription>
        </DialogHeader>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Title
          <input
            className="h-7 rounded-sm bg-input px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue="About us"
          />
        </label>
        <DialogFooter>
          <DialogCloseButton>Cancel</DialogCloseButton>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

/** Page Settings' title, which counts as changed once it differs from where it started. */
function TitleField() {
  const [title, setTitle] = useState("About us");
  useUnsavedChanges(title !== "About us");
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      Title
      <input
        className="h-7 rounded-sm bg-input px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
    </label>
  );
}

/**
 * A dialog with a change, after Esc (#1439): it asks before throwing the change away, Keep Editing
 * first and focused.
 */
export const UnsavedChanges: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Page Settings</DialogTitle>
            <DialogDescription>The title and description search engines show.</DialogDescription>
          </DialogHeader>
          <TitleField />
          <DialogFooter>
            <DialogCancel onClick={() => setOpen(false)} />
            <Button>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
  play: async ({ canvasElement }) => {
    // The dialogs are in portals on the body.
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.type(await body.findByRole("textbox", { name: "Title" }), " and our story");
    await userEvent.keyboard("{Escape}");
    const keep = await body.findByRole("button", { name: "Keep Editing" });
    await expect(keep).toHaveFocus();
  },
};
