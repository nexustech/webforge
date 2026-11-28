import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Dialog,
  DialogCancel,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogTitle,
  UnsavedChanges,
  useAskBeforeDiscarding,
  useUnsavedChanges,
} from "./dialog.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu.js";

afterEach(cleanup);

/** A dialog with one field, which counts as changed once it differs from where it started. */
function NameField() {
  const [name, setName] = useState("Home");
  useUnsavedChanges(name !== "Home");
  return <input aria-label="Name" value={name} onChange={(event) => setName(event.target.value)} />;
}

/** Settings, opened from a button, with its own Cancel that closes it without asking. */
function Settings({ onClosed = () => {} }: { readonly onClosed?: () => void }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
    onClosed();
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open Settings
      </button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) setOpen(true);
          else close();
        }}
      >
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Your settings.</DialogDescription>
          <NameField />
          <DropdownMenu>
            <DropdownMenuTrigger>More</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Reset</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button type="button" onClick={close}>
            Cancel
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

const setup = async (onClosed?: () => void) => {
  // The dialog makes what's outside it take no pointer events, as a modal dialog does.
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(<Settings {...(onClosed === undefined ? {} : { onClosed })} />);
  await user.click(screen.getByRole("button", { name: "Open Settings" }));
  return user;
};
const dialog = () => screen.queryByRole("dialog", { name: "Settings" });
const question = () => screen.queryByRole("alertdialog", { name: "Discard your changes?" });
const outside = () => {
  const overlay = document.querySelector('[data-slot="dialog-overlay"]');
  if (!(overlay instanceof HTMLElement)) throw new Error("no overlay");
  return overlay;
};

describe("a dialog with unsaved changes (#1439)", () => {
  describe("with nothing changed", () => {
    it("closes on a click outside", async () => {
      const user = await setup();
      await user.click(outside());
      expect(dialog()).toBeNull();
      expect(question()).toBeNull();
    });

    it("closes on Esc", async () => {
      const user = await setup();
      await user.keyboard("{Escape}");
      expect(dialog()).toBeNull();
      expect(question()).toBeNull();
    });

    it("closes on its X", async () => {
      const user = await setup();
      await user.click(screen.getByRole("button", { name: "Close" }));
      expect(dialog()).toBeNull();
    });

    it("counts a field changed back to where it started as unchanged", async () => {
      const user = await setup();
      const name = screen.getByRole("textbox", { name: "Name" });
      await user.type(name, "s");
      await user.type(name, "{Backspace}");
      await user.keyboard("{Escape}");
      expect(dialog()).toBeNull();
      expect(question()).toBeNull();
    });
  });

  describe("with a change", () => {
    it("stays open on a click outside, without asking", async () => {
      const user = await setup();
      await user.type(screen.getByRole("textbox", { name: "Name" }), "page");
      await user.click(outside());
      expect(dialog()).not.toBeNull();
      expect(question()).toBeNull();
      expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Name" }).value).toBe(
        "Homepage",
      );
    });

    it("asks on Esc, Keep Editing first and focused, and Keep Editing goes back to the field", async () => {
      const closed = vi.fn();
      const user = await setup(closed);
      const name = screen.getByRole("textbox", { name: "Name" });
      await user.type(name, "page");
      await user.keyboard("{Escape}");
      const asked = question();
      expect(asked).not.toBeNull();
      const buttons = screen.getAllByRole("button").filter((each) => asked?.contains(each));
      expect(buttons.map((each) => each.textContent)).toEqual(["Keep Editing", "Discard"]);
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep Editing" }));

      await user.click(screen.getByRole("button", { name: "Keep Editing" }));
      expect(question()).toBeNull();
      expect(dialog()).not.toBeNull();
      expect((name as HTMLInputElement).value).toBe("Homepage");
      expect(document.activeElement).toBe(name);
      expect(closed).not.toHaveBeenCalled();
    });

    it("asks on its X, and Discard closes it", async () => {
      const closed = vi.fn();
      const user = await setup(closed);
      await user.type(screen.getByRole("textbox", { name: "Name" }), "page");
      await user.click(screen.getByRole("button", { name: "Close" }));
      expect(question()).not.toBeNull();
      await user.click(screen.getByRole("button", { name: "Discard" }));
      expect(question()).toBeNull();
      expect(dialog()).toBeNull();
      expect(closed).toHaveBeenCalledOnce();
    });

    it("keeps editing on Esc pressed in the question", async () => {
      const user = await setup();
      await user.type(screen.getByRole("textbox", { name: "Name" }), "page");
      await user.keyboard("{Escape}");
      expect(question()).not.toBeNull();
      await user.keyboard("{Escape}");
      expect(question()).toBeNull();
      expect(dialog()).not.toBeNull();
    });

    it("closes on its own Cancel without asking", async () => {
      const closed = vi.fn();
      const user = await setup(closed);
      await user.type(screen.getByRole("textbox", { name: "Name" }), "page");
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(question()).toBeNull();
      expect(dialog()).toBeNull();
      expect(closed).toHaveBeenCalledOnce();
    });

    it("asks on Esc pressed straight after the change, in the same act", async () => {
      await setup();
      const name = screen.getByRole("textbox", { name: "Name" });
      act(() => {
        fireEvent.change(name, { target: { value: "Homepage" } });
        fireEvent.keyDown(name, { key: "Escape" });
      });
      expect(question()).not.toBeNull();
      // Under the question, hidden from the rest while it asks.
      expect(document.querySelector('[data-slot="dialog-content"]')).not.toBeNull();
    });

    it("closes only a menu open inside it on Esc, without asking", async () => {
      const user = await setup();
      await user.type(screen.getByRole("textbox", { name: "Name" }), "page");
      await user.click(screen.getByRole("button", { name: "More" }));
      expect(screen.queryByRole("menu")).not.toBeNull();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("menu")).toBeNull();
      expect(question()).toBeNull();
      expect(dialog()).not.toBeNull();
    });
  });

  it("still asks the next time when a dialog stays open after Discard (busy applying)", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const closing = vi.fn();
    render(
      <Dialog open onOpenChange={closing}>
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Your settings.</DialogDescription>
          <NameField />
        </DialogContent>
      </Dialog>,
    );
    await user.type(screen.getByRole("textbox", { name: "Name" }), "page");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(closing).toHaveBeenCalledWith(false);
    await user.keyboard("{Escape}");
    expect(question()).not.toBeNull();
    expect(closing).toHaveBeenCalledOnce();
  });

  it("counts a change from any part of the dialog, not only the last to report", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    function TwoParts() {
      const [open, setOpen] = useState(true);
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Your settings.</DialogDescription>
            <NameField />
            <UnsavedChanges changed={false} />
          </DialogContent>
        </Dialog>
      );
    }
    render(<TwoParts />);
    await user.type(screen.getByRole("textbox", { name: "Name" }), "page");
    await user.keyboard("{Escape}");
    expect(question()).not.toBeNull();
  });
});

/** A step of a dialog: a field, and Back, which asks first when the field changed. */
function NameStep({ onBack }: { readonly onBack: () => void }) {
  const ask = useAskBeforeDiscarding();
  return (
    <>
      <NameField />
      <button type="button" onClick={() => ask(onBack)}>
        Back
      </button>
    </>
  );
}

/** Publish's shape (#1456): a list, and a form drawn in its place as a step of the same dialog. */
function Steps({ onClosed }: { readonly onClosed: () => void }) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        setOpen(false);
        onClosed();
      }}
    >
      <DialogContent>
        <DialogTitle>{editing ? "Name" : "List"}</DialogTitle>
        <DialogDescription>Steps.</DialogDescription>
        {editing ? (
          <NameStep onBack={() => setEditing(false)} />
        ) : (
          <button type="button" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}

describe("leaving a step of a dialog (#1456)", () => {
  const setupSteps = async () => {
    const onClosed = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Steps onClosed={onClosed} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    return { user, onClosed };
  };

  it("goes back at once with nothing changed", async () => {
    const { user, onClosed } = await setupSteps();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(question()).toBeNull();
    expect(screen.getByRole("dialog", { name: "List" })).toBeTruthy();
    expect(onClosed).not.toHaveBeenCalled();
  });

  it("asks first with a change, and Keep Editing stays on the step", async () => {
    const { user } = await setupSteps();
    await user.type(screen.getByRole("textbox", { name: "Name" }), " page");

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(question()).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Keep Editing" }));

    expect(question()).toBeNull();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty("value", "Home page");
  });

  it("goes back on Discard, leaving the dialog open, and then closes without asking", async () => {
    const { user, onClosed } = await setupSteps();
    await user.type(screen.getByRole("textbox", { name: "Name" }), " page");

    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(screen.getByRole("dialog", { name: "List" })).toBeTruthy();
    expect(onClosed).not.toHaveBeenCalled();
    // The step's changes went with it: Esc on the list closes the dialog at once.
    await user.keyboard("{Escape}");
    expect(question()).toBeNull();
    expect(onClosed).toHaveBeenCalledOnce();
  });

  it("asks before Esc on the step closes the whole dialog", async () => {
    const { user, onClosed } = await setupSteps();
    await user.type(screen.getByRole("textbox", { name: "Name" }), " page");

    await user.keyboard("{Escape}");
    expect(question()).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(onClosed).toHaveBeenCalledOnce();
  });

  it("goes back at once outside a dialog", async () => {
    const onBack = vi.fn();
    render(<NameStep onBack={onBack} />);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe("a dialog's way out (#1444)", () => {
  /** A dialog with a field, its own Cancel and Close, as a footer draws them. */
  function WithWayOut({
    onCancel,
    onClosed,
  }: {
    readonly onCancel: () => void;
    readonly onClosed: () => void;
  }) {
    const [open, setOpen] = useState(true);
    return (
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) onClosed();
        }}
      >
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Your settings.</DialogDescription>
          <NameField />
          <DialogCancel
            onClick={() => {
              setOpen(false);
              onCancel();
            }}
          />
          <DialogCloseButton />
        </DialogContent>
      </Dialog>
    );
  }

  it("Cancel is the filled grey, named Cancel, and closes a changed dialog without asking", async () => {
    const onCancel = vi.fn();
    const onClosed = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<WithWayOut onCancel={onCancel} onClosed={onClosed} />);
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel.dataset.variant).toBe("secondary");
    expect(cancel.dataset.wayOut).toBe("");
    await user.type(screen.getByRole("textbox", { name: "Name" }), "page");
    await user.click(cancel);
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onClosed).not.toHaveBeenCalled();
    expect(question()).toBeNull();
    expect(dialog()).toBeNull();
  });

  it("Close is the filled grey too, and closes the dialog through its own onOpenChange", async () => {
    const onClosed = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<WithWayOut onCancel={vi.fn()} onClosed={onClosed} />);
    const close = screen
      .getAllByRole("button", { name: "Close" })
      .find((button) => button.dataset.wayOut !== undefined);
    expect(close?.dataset.variant).toBe("secondary");
    if (close === undefined) throw new Error("no Close");
    await user.click(close);
    expect(onClosed).toHaveBeenCalledOnce();
    expect(dialog()).toBeNull();
  });
});
