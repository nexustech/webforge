// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { EDITOR_RENDER_CONTEXT, siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

describe("the Header's navigation on the canvas (F-ED-17)", () => {
  it("keys items by menu item, so two going to one page draw without React warnings", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const header = siteLibrary.components.Header;
    if (header === undefined) throw new Error("no Header");

    render(
      header.render({
        id: "header",
        values: { siteName: "Bakery" },
        slots: {},
        context: {
          ...EDITOR_RENDER_CONTEXT,
          navigation: [
            { id: "a", label: "About", href: "#", current: false },
            { id: "b", label: "Our story", href: "#", current: false },
            {
              id: "more",
              label: "More",
              current: false,
              children: [
                { id: "c", label: "Team", href: "#", current: false },
                { id: "d", label: "People", href: "#", current: false },
              ],
            },
          ],
        },
      }),
    );

    // Once in the row on wide screens, once in the menu on small ones (2.6).
    const links = ["About", "Our story", "Team", "People"];
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Bakery",
      ...links,
      ...links,
    ]);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
