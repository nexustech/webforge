// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OwnColor } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioOwnColours, type StudioOwnColoursProps } from "./StudioOwnColours.js";

afterEach(cleanup);

const SKY: OwnColor = { id: "csky", name: "Sky", color: { l: 0.7, c: 0.12, h: 230 } };
const SEA: OwnColor = { id: "csea", name: "Sea", color: { l: 0.5, c: 0.1, h: 200 } };

function shown(colors: readonly OwnColor[], uses: (id: string) => number = () => 0) {
  const props: StudioOwnColoursProps = {
    colors,
    startColor: { l: 0.5, c: 0.2, h: 30 },
    onAdd: vi.fn(),
    onRename: vi.fn(),
    onSetColor: vi.fn(),
    usesOf: vi.fn(uses),
    onDelete: vi.fn(),
  };
  render(<StudioOwnColours {...props} />);
  return { props, user: userEvent.setup() };
}

describe("Theme Studio's list of your colours (TC-1b, #1218)", () => {
  it("adds a colour named for its place, and renames one when its name is left", async () => {
    const { props, user } = shown([SKY]);
    await user.click(screen.getByRole("button", { name: "Add a Colour" }));
    expect(props.onAdd).toHaveBeenCalledWith("Colour 2", props.startColor);

    const name = screen.getByRole("textbox", { name: "Sky: its name" });
    await user.clear(name);
    await user.type(name, "Morning sky{Enter}");
    expect(props.onRename).toHaveBeenCalledWith("csky", "Morning sky");
  });

  it("deletes a colour nobody uses at once, and asks about one in use", async () => {
    const { props, user } = shown([SKY, SEA], (id) => (id === "csky" ? 3 : 0));
    await user.click(screen.getByRole("button", { name: "Delete Sea" }));
    expect(props.onDelete).toHaveBeenCalledWith("csea", { kind: "oneOff" });

    await user.click(screen.getByRole("button", { name: "Delete Sky" }));
    const ask = within(await screen.findByRole("alertdialog", { name: "Delete 'Sky'?" }));
    expect(ask.getByText(/used 3 times/)).toBeDefined();
    await user.click(ask.getByRole("button", { name: "Use That Colour" }));
    expect(props.onDelete).toHaveBeenLastCalledWith("csky", { kind: "replace", to: "csea" });
  });

  it("keeps each use as a one-off when asked, and offers only that with no other colour", async () => {
    const { props, user } = shown([SKY], () => 1);
    await user.click(screen.getByRole("button", { name: "Delete Sky" }));
    const ask = within(await screen.findByRole("alertdialog", { name: "Delete 'Sky'?" }));
    expect(ask.queryByRole("button", { name: "Use That Colour" })).toBeNull();
    await user.click(ask.getByRole("button", { name: "Keep Each as It Looks" }));
    expect(props.onDelete).toHaveBeenCalledWith("csky", { kind: "oneOff" });
  });

  it("finds a colour by name in a long list", async () => {
    const colors = Array.from({ length: 8 }, (_, n) => ({
      ...SKY,
      id: `c${n}x`,
      name: `Tone ${n}`,
    }));
    const { user } = shown([...colors, { ...SEA, name: "Harbour blue" }]);
    await user.type(screen.getByRole("searchbox", { name: "Find a colour by name" }), "harbour");
    const list = within(screen.getByRole("list", { name: "Your colours" }));
    expect(list.getAllByRole("listitem")).toHaveLength(1);
    expect(list.getByRole("textbox", { name: "Harbour blue: its name" })).toBeDefined();
  });
});
