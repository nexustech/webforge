// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceDialog } from "./DeviceDialog.js";

afterEach(cleanup);

function setUp() {
  const onAdd = vi.fn();
  render(<DeviceDialog open onAdd={onAdd} onCancel={vi.fn()} />);
  const add = () => screen.getByRole("button", { name: "Add Device" });
  return { onAdd, add, user: userEvent.setup({ delay: null }) };
}

describe("DeviceDialog (F-ED-25, 2.21)", () => {
  it("keeps Add off until the device is described, then adds its size as numbers", async () => {
    const { onAdd, add, user } = setUp();
    expect(add()).toHaveProperty("disabled", true);
    // Nothing is wrong yet with fields not typed in.
    expect(screen.queryByText("Fill this in.")).toBeNull();

    await user.type(screen.getByRole("textbox", { name: "Name" }), " Kiosk ");
    await user.type(screen.getByRole("spinbutton", { name: "Width in pixels" }), "1080");
    await user.type(screen.getByRole("spinbutton", { name: "Height in pixels" }), "1920");
    await user.click(add());

    expect(onAdd).toHaveBeenCalledWith({ name: "Kiosk", width: 1080, height: 1920 });
  });

  it("says what's wrong with a size as it's typed, in the schema's limits", async () => {
    const { add, user } = setUp();

    await user.type(screen.getByRole("spinbutton", { name: "Width in pixels" }), "5000");

    const width = screen.getByRole("spinbutton", { name: "Width in pixels" });
    expect(width.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Use 2560 or less.")).toBeTruthy();
    expect(add()).toHaveProperty("disabled", true);
  });
});
