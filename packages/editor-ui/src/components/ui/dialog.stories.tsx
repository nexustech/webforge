import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button.js";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
