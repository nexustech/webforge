// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantExamplesDialog } from "./AssistantExamplesDialog.js";

afterEach(cleanup);

function shown() {
  const onTry = vi.fn();
  const onOpenChange = vi.fn();
  render(<AssistantExamplesDialog open onOpenChange={onOpenChange} onTry={onTry} />);
  return { onTry, onOpenChange, user: userEvent.setup({ delay: null }) };
}

describe("AssistantExamplesDialog (5.21, OL-8)", () => {
  it("lists the examples by topic, and search narrows them", async () => {
    const { user } = shown();
    const dialog = screen.getByRole("dialog", { name: "Things You Can Ask" });

    expect(within(dialog).getByRole("region", { name: "Search engines" })).toBeDefined();
    await user.type(within(dialog).getByRole("searchbox", { name: "Search the examples" }), "font");

    expect(
      within(dialog)
        .getAllByRole("region")
        .map((region) => region.textContent),
    ).toEqual([expect.stringContaining("Use a friendlier font for the headings.")]);
    await user.type(within(dialog).getByRole("searchbox"), "zz");
    expect(within(dialog).getByRole("status").textContent).toBe(
      "No examples have “fontzz” in them.",
    );
  });

  it("tries an example: its words go to the assistant's box, and the dialog closes", async () => {
    const { user, onTry, onOpenChange } = shown();

    await user.click(screen.getByRole("button", { name: "Try “Make the corners rounder.”" }));

    expect(onTry).toHaveBeenCalledWith("Make the corners rounder.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
