import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs.js";

afterEach(cleanup);

/** Tabs and a field after them, as a dialog's sections are (Theme Studio's, #1650). */
function Sections() {
  return (
    <Tabs defaultValue="colours">
      <TabsList aria-label="Sections">
        <TabsTrigger value="themes">Themes</TabsTrigger>
        <TabsTrigger value="colours">Colours</TabsTrigger>
      </TabsList>
      <TabsContent value="themes">Themes</TabsContent>
      <TabsContent value="colours">
        <input aria-label="Brand" />
      </TabsContent>
    </Tabs>
  );
}

describe("TabsList (#1650)", () => {
  // Pins what Radix does, so an upgrade that changes it fails here, not in a person's hands: the
  // dialog's focus trap wraps Shift+Tab from its first tabbable element to its last, and the
  // tabs, first in the dialog, are that first element only once the list itself isn't.
  it("lets Shift+Tab leave tabs first in a dialog, to its last control, and Tab come back", async () => {
    const user = userEvent.setup();
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Theme Studio</DialogTitle>
          <DialogDescription>The site's theme.</DialogDescription>
          <Sections />
        </DialogContent>
      </Dialog>,
    );
    const colours = screen.getByRole("tab", { name: "Colours" });
    const close = screen.getByRole("button", { name: "Close" });
    colours.focus();

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(close);
    // And back to the tab chosen, in one stop: not the list's own element first.
    await user.tab();
    expect(document.activeElement).toBe(colours);
    // The list stays out of the way once a tab has been the stop.
    expect(screen.getByRole("tablist").getAttribute("tabindex")).toBe("-1");
  });

  it("is reached by Tab before any tab has had the focus, and Shift+Tab leaves it in a panel", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <Sections />
      </>,
    );
    // Radix makes no tab a stop until one has the focus: the list is, and hands it on.
    expect(screen.getByRole("tablist").getAttribute("tabindex")).toBe("0");
    screen.getByRole("button", { name: "Before" }).focus();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Colours" }));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Before" }));
  });
});
