import { screen, waitFor, within } from "@testing-library/react";
import { expect } from "vitest";

/**
 * The dialog `name` once it takes clicks, for a dialog that opens on its own time (after a menu
 * closes, or when the canvas asks). A modal dialog turns clicks off around it, and on for itself
 * a render after it shows: a busy test run could click in between.
 */
export async function openedDialog(name: string) {
  const dialog = await screen.findByRole("dialog", { name });
  await waitFor(() => expect(dialog.style.pointerEvents).toBe("auto"));
  return within(dialog);
}
