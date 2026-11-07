import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "./alert-dialog.js";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog.js";

afterEach(cleanup);

/** A dialog with no trigger, opened as a command or a shortcut opens one: by its own button here. */
function OpenedByCommand({
  kind,
  onCloseAutoFocus,
}: {
  readonly kind: "dialog" | "alert";
  readonly onCloseAutoFocus?: (event: Event) => void;
}) {
  const [open, setOpen] = useState(false);
  let dialog: ReactNode;
  if (kind === "dialog") {
    dialog = (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Your settings.</DialogDescription>
          <input aria-label="Name" />
        </DialogContent>
      </Dialog>
    );
  } else {
    dialog = (
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
          <AlertDialogTitle>Delete page?</AlertDialogTitle>
          <AlertDialogDescription>It can be undone.</AlertDialogDescription>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    );
  }
  return (
    <>
      <button type="button">Elsewhere</button>
      <button type="button" onKeyDown={(event) => event.key === "F2" && setOpen(true)}>
        Where the focus was
      </button>
      {dialog}
    </>
  );
}

/** Opens the dialog from the focused button, closes it with Esc, and lets its focus settle. */
async function openAndClose() {
  const user = userEvent.setup();
  const button = screen.getByRole("button", { name: "Where the focus was" });
  button.focus();
  await user.keyboard("{F2}");
  expect(document.activeElement).not.toBe(button);
  await user.keyboard("{Escape}");
  await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
  return button;
}

describe("a dialog with no trigger gives the focus back (5.5)", () => {
  it.each(["dialog", "alert"] as const)(
    "as a %s closes, to what had it when it opened",
    async (kind) => {
      render(<OpenedByCommand kind={kind} />);
      const button = await openAndClose();
      expect(document.activeElement).toBe(button);
    },
  );

  it("leaves the focus to a dialog that keeps it its own way", async () => {
    const elsewhere = vi.fn((event: Event) => {
      event.preventDefault();
      screen.getByRole("button", { name: "Elsewhere" }).focus();
    });
    render(<OpenedByCommand kind="dialog" onCloseAutoFocus={elsewhere} />);
    await openAndClose();
    expect(elsewhere).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Elsewhere" }));
  });
});
