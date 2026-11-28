import { act, cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "./alert-dialog.js";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog.js";

afterEach(cleanup);

/** How the first button is: in the page or not, and disabled or not. */
type First = { readonly shown: boolean; readonly disabled: boolean };

/** What a test changes in {@link Controls}, filled in as it renders. */
type Handles = { showNote: (shown: boolean) => void; setFirst: (first: First) => void };

/** Two buttons and a note that comes and goes, as a tooltip's description did (#1672). */
function Controls({ handles }: { readonly handles: Handles }) {
  const [note, setNote] = useState(true);
  const [first, setFirst] = useState<First>({ shown: true, disabled: false });
  handles.showNote = setNote;
  handles.setFirst = setFirst;
  return (
    <>
      {first.shown ? (
        <button type="button" disabled={first.disabled}>
          First
        </button>
      ) : null}
      <button type="button">Second</button>
      {note ? <span>Copy (Ctrl+C)</span> : null}
    </>
  );
}

/** A dialog (or an alert dialog) with {@link Controls}, the focus on its first button. */
function open(kind: "dialog" | "alert" = "dialog") {
  const handles: Handles = { showNote: () => undefined, setFirst: () => undefined };
  render(
    kind === "dialog" ? (
      <Dialog open>
        <DialogContent showClose={false}>
          <DialogTitle>Theme Studio</DialogTitle>
          <DialogDescription>The site's theme.</DialogDescription>
          <Controls handles={handles} />
        </DialogContent>
      </Dialog>
    ) : (
      <AlertDialog open>
        <AlertDialogContent aria-describedby={undefined}>
          <AlertDialogTitle>Delete this page?</AlertDialogTitle>
          <Controls handles={handles} />
        </AlertDialogContent>
      </AlertDialog>
    ),
  );
  const first = screen.getByRole("button", { name: "First" });
  first.focus();
  return {
    first,
    dialog: screen.getByRole(kind === "dialog" ? "dialog" : "alertdialog"),
    removeNote: () => act(() => handles.showNote(false)),
    setFirst: (next: First) => act(() => handles.setFirst(next)),
  };
}

/**
 * The moment in a Tab when the focus is on `<body>`: it has left `element` and not yet reached the
 * next control. A browser runs the dialog's observer then, between the two; happy-dom moves the
 * focus in one go, so the tests stop at that moment themselves.
 */
function leave(element: HTMLElement): void {
  element.blur();
  expect(document.activeElement).toBe(document.body);
}

/** The observer's turn: a MutationObserver's callback runs as a microtask. */
const settle = () => act(async () => await Promise.resolve());

// The trapped focus scope under every modal dialog, alert dialog, popover and menu, as patched
// (pnpm-workspace.yaml). Radix moves the focus to the dialog when a node inside it is removed while
// the focus is on <body>; the patch keeps that for when the control that had the focus is gone or
// can't take it, not for the instant of every Tab.
describe("A dialog's focus trap (#1672)", () => {
  for (const kind of ["dialog", "alert"] as const) {
    it(`leaves a Tab alone when a node goes as the focus moves (${kind})`, async () => {
      const { first, dialog, removeNote } = open(kind);
      leave(first);
      // A tooltip's description removed as its control loses the focus, say.
      removeNote();
      await settle();
      expect(document.activeElement).not.toBe(dialog);
    });
  }

  it("still takes the focus to the dialog when the control that had it is removed", async () => {
    const { first, dialog, setFirst } = open();
    await setFirst({ shown: false, disabled: false });
    expect(first.isConnected).toBe(false);
    await settle();
    expect(document.activeElement).toBe(dialog);
  });

  it("still takes the focus to the dialog when the control that had it is disabled", async () => {
    const { first, dialog, setFirst, removeNote } = open();
    // A browser takes the focus off a control as it's disabled; happy-dom won't blur a disabled
    // one, so the focus leaves first.
    leave(first);
    await setFirst({ shown: true, disabled: true });
    removeNote();
    await settle();
    // Not left on <body>, where the next Tab could reach the page behind the dialog.
    expect(document.activeElement).toBe(dialog);
  });

  it("still takes the focus to the dialog when the control that had it is hidden", async () => {
    const { first, dialog, removeNote } = open();
    first.hidden = true;
    leave(first);
    removeNote();
    await settle();
    expect(document.activeElement).toBe(dialog);
  });
});
