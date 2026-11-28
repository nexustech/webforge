import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "./alert-dialog.js";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog.js";

afterEach(cleanup);

/** What's in the dialog: a note that comes and goes, as a tooltip's description did (#1672). */
type State = {
  readonly note: boolean;
  /** The first button: in the page or not, and disabled or not. */
  readonly first: { readonly shown: boolean; readonly disabled: boolean };
};

const START: State = { note: true, first: { shown: true, disabled: false } };

/** A dialog (or an alert dialog) with two buttons and a note, as `state` says. */
function ui(kind: "dialog" | "alert", { note, first }: State) {
  const controls = (
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
  return kind === "dialog" ? (
    <Dialog open>
      <DialogContent showClose={false}>
        <DialogTitle>Theme Studio</DialogTitle>
        <DialogDescription>The site's theme.</DialogDescription>
        {controls}
      </DialogContent>
    </Dialog>
  ) : (
    <AlertDialog open>
      <AlertDialogContent aria-describedby={undefined}>
        <AlertDialogTitle>Delete this page?</AlertDialogTitle>
        {controls}
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Opens {@link ui}, the focus on its first button, and a way to change what's in it. */
function open(kind: "dialog" | "alert" = "dialog") {
  const { rerender } = render(ui(kind, START));
  const first = screen.getByRole("button", { name: "First" });
  first.focus();
  return {
    first,
    dialog: screen.getByRole(kind === "dialog" ? "dialog" : "alertdialog"),
    change: (state: Partial<State>) => act(() => rerender(ui(kind, { ...START, ...state }))),
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
      const { first, dialog, change } = open(kind);
      leave(first);
      // A tooltip's description removed as its control loses the focus, say.
      change({ note: false });
      await settle();
      expect(document.activeElement).not.toBe(dialog);
    });
  }

  it("still takes the focus to the dialog when the control that had it is removed", async () => {
    const { first, dialog, change } = open();
    change({ first: { shown: false, disabled: false } });
    expect(first.isConnected).toBe(false);
    await settle();
    expect(document.activeElement).toBe(dialog);
  });

  it("still takes the focus to the dialog when the control that had it is disabled", async () => {
    const { first, dialog, change } = open();
    // A browser takes the focus off a control as it's disabled; happy-dom won't blur a disabled
    // one, so the focus leaves first.
    leave(first);
    change({ first: { shown: true, disabled: true }, note: false });
    await settle();
    // Not left on <body>, where the next Tab could reach the page behind the dialog.
    expect(document.activeElement).toBe(dialog);
  });

  it("still takes the focus to the dialog when the control that had it is hidden", async () => {
    const { first, dialog, change } = open();
    first.hidden = true;
    leave(first);
    change({ note: false });
    await settle();
    expect(document.activeElement).toBe(dialog);
  });
});
