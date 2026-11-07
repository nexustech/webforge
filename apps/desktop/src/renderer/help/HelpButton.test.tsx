// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@webforge/editor-ui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HelpButton, HelpProvider } from "./HelpButton.js";

afterEach(cleanup);

describe("HelpButton (5.4b)", () => {
  it("opens the Help window at its topic's page and heading, named for it", async () => {
    const open = vi.fn();
    render(
      <TooltipProvider>
        <HelpProvider open={open}>
          <HelpButton topic="pageSettings" />
          <HelpButton topic="siteCheck.tip" about="Large downloads" />
        </HelpProvider>
      </TooltipProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Help: Page Settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Help: Large downloads" }));
    expect(open.mock.calls).toEqual([
      [{ page: "pages", anchor: "page-settings" }],
      [{ page: "site-check", anchor: "tips" }],
    ]);
  });

  it("isn't drawn where Help can't open", () => {
    const { container } = render(<HelpButton topic="export" />);
    expect(container.innerHTML).toBe("");
  });
});
