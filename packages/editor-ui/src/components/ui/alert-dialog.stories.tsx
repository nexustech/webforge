import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog.js";

const meta = {
  title: "Base/AlertDialog",
  component: AlertDialog,
} satisfies Meta<typeof AlertDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A D5 confirmation: what happens, and that it can be undone, so the ordinary button (#1445). */
export const DeletePage: Story = {
  render: () => (
    <AlertDialog defaultOpen>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Page “About”?</AlertDialogTitle>
          <AlertDialogDescription>
            Links to it will stop working. You can undo this with Undo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Delete Page</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

/** What Undo can't bring back: the button is red (#1445). */
export const DeleteVersion: Story = {
  render: () => (
    <AlertDialog defaultOpen>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “Before theme changes”?</AlertDialogTitle>
          <AlertDialogDescription>
            This can't be undone. Your site itself doesn't change.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive">Delete Version</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};
