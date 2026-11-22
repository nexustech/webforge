// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OwnColor } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioOneOffColours, type StudioOneOffColoursProps } from "./StudioOneOffColours.js";

afterEach(cleanup);

const SKY: OwnColor = { id: "csky", name: "Sky", color: { l: 0.6, c: 0.17, h: 260 } };

/** The list with `props`, its callbacks recorded. */
function shown(props: Partial<StudioOneOffColoursProps> = {}) {
  const all: StudioOneOffColoursProps = {
    colours: [
      {
        hex: "#1f6feb",
        uses: [
          { key: "a", where: "Heading on Home", canShow: true },
          { key: "b", where: "Button in the Header", canShow: true },
        ],
      },
      { hex: "#c0392b", uses: [{ key: "c", where: "Text on About", canShow: true }] },
    ],
    own: [SKY],
    nearest: () => SKY,
    onAdd: vi.fn(async () => true),
    onUseNearest: vi.fn(),
    onShow: vi.fn(),
    ...props,
  };
  render(<StudioOneOffColours {...all} />);
  return { ...all, user: userEvent.setup({ delay: null }) };
}

describe("StudioOneOffColours (5.32, TC-4)", () => {
  it("lists every one-off with how often and where it's used, and goes to a use", async () => {
    const { onShow, user } = shown();
    const blue = screen.getByRole("listitem", { name: "#1f6feb" });
    expect(within(blue).getByText("Used 2 times")).toBeDefined();
    expect(
      within(screen.getByRole("listitem", { name: "#c0392b" })).getByText("Used once"),
    ).toBeDefined();
    const where = within(blue).getByRole("list", { name: "Where #1f6feb is used" });
    expect(
      within(where)
        .getAllByRole("button")
        .map((each) => each.textContent),
    ).toEqual(["Heading on Home", "Button in the Header"]);

    await user.click(
      within(where).getByRole("button", { name: "Show Button in the Header on the page" }),
    );
    expect(onShow).toHaveBeenCalledWith("#1f6feb", "b");
  });

  it("shows a use that can't be gone to as text, saying why", () => {
    shown({
      colours: [
        {
          hex: "#1f6feb",
          uses: [
            { key: "a", where: "Heading on Home", canShow: true },
            { key: "b", where: "Text in the shared section Hours", canShow: false },
          ],
        },
      ],
    });
    const where = screen.getByRole("list", { name: "Where #1f6feb is used" });
    expect(
      within(where)
        .getAllByRole("button")
        .map((each) => each.textContent),
    ).toEqual(["Heading on Home"]);
    expect(within(where).getAllByRole("listitem")[1]?.textContent).toBe(
      "Text in the shared section Hours (not on any page)",
    );
  });

  it("uses the nearest of the person's colours instead, or offers none while they have none", async () => {
    const { onUseNearest, user } = shown();
    await user.click(
      screen.getByRole("button", {
        name: "Use Sky Instead, the nearest of your colours, everywhere #c0392b is used",
      }),
    );
    expect(onUseNearest).toHaveBeenCalledWith("#c0392b");
    cleanup();

    shown({ own: [], nearest: () => undefined });
    expect(screen.queryByRole("button", { name: /nearest of your colours/ })).toBeNull();
  });

  it("adds one to the person's colours, named there and then", async () => {
    const { onAdd, user } = shown();
    const blue = screen.getByRole("listitem", { name: "#1f6feb" });
    await user.click(within(blue).getByRole("button", { name: "Add to Your Colours…" }));
    const name = within(blue).getByRole("textbox", { name: "Name" });
    expect((name as HTMLInputElement).value).toBe("Colour 2");
    await user.clear(name);
    await user.type(name, "Ocean");
    await user.click(within(blue).getByRole("button", { name: "Add to Your Colours" }));

    expect(onAdd).toHaveBeenCalledWith("#1f6feb", "Ocean");
    expect(within(blue).queryByRole("textbox", { name: "Name" })).toBeNull();
  });

  it("says when the site uses its theme's colours only", () => {
    shown({ colours: [] });
    expect(screen.getByText("Your site uses only your theme's colours.")).toBeDefined();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
