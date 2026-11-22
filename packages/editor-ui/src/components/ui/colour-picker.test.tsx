import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColourPicker } from "./colour-picker.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The picker on `value`, named "Brand", and what it reports. */
function setUp(value = "#1f6feb") {
  const onChoose = vi.fn();
  render(
    <>
      <span id="label">Brand</span>
      <ColourPicker value={value} aria-labelledby="label" onChoose={onChoose} />
    </>,
  );
  const swatch = () => screen.getByRole("button", { name: "Brand" });
  const hex = () => screen.getByRole("textbox", { name: "Hex code" }) as HTMLInputElement;
  return { onChoose, swatch, hex, user: userEvent.setup({ delay: null }) };
}

describe("the colour picker (5.26, OL-19)", () => {
  it("opens from its swatch, named by its field and described by its code", async () => {
    const { swatch, hex, user } = setUp();
    const describedBy = swatch().getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy.split(" ")[0] ?? "")?.textContent).toBe("#1f6feb");

    await user.click(swatch());

    expect(screen.getByRole("dialog", { name: "Colour picker" })).toBeTruthy();
    expect(hex().value).toBe("#1f6feb");
    expect(screen.getByRole("slider", { name: "Saturation and brightness" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Hue" })).toBeTruthy();
  });

  it("chooses once, as it closes, showing each step in its code meanwhile", async () => {
    const { onChoose, swatch, hex, user } = setUp("#808080");
    await user.click(swatch());
    const area = screen.getByRole("slider", { name: "Saturation and brightness" });

    area.focus();
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}{ArrowUp}");
    expect(area.getAttribute("aria-valuetext")).toBe("Saturation 10%, brightness 51%");
    const chosen = hex().value;
    expect(chosen).not.toBe("#808080");
    expect(onChoose).not.toHaveBeenCalled();

    await user.click(swatch());

    expect(onChoose).toHaveBeenCalledOnce();
    expect(onChoose).toHaveBeenCalledWith(chosen);
  });

  it("moves the hue by key, keeping it on a grey that has none of its own", async () => {
    const { swatch, user } = setUp("#808080");
    await user.click(swatch());
    const hue = screen.getByRole("slider", { name: "Hue" });

    hue.focus();
    await user.keyboard("{PageUp}{PageUp}{ArrowRight}");

    expect(hue.getAttribute("aria-valuenow")).toBe("21");
    expect(hue.getAttribute("aria-valuetext")).toBe("21 degrees");
  });

  it("says a hue just under 360 is 359 degrees, within its slider (#1219)", async () => {
    const { swatch, user } = setUp("#ff0001");
    await user.click(swatch());
    const hue = screen.getByRole("slider", { name: "Hue" });

    expect(hue.getAttribute("aria-valuenow")).toBe("359");
    expect(hue.getAttribute("aria-valuetext")).toBe("359 degrees");
    hue.focus();
    await user.keyboard("{ArrowRight}");
    expect(hue.getAttribute("aria-valuenow")).toBe("359");
  });

  it("leaves the colour as it was on Escape, showing it again", async () => {
    const { onChoose, swatch, user } = setUp();
    await user.click(swatch());
    screen.getByRole("slider", { name: "Hue" }).focus();
    await user.keyboard("{End}");

    await user.keyboard("{Escape}");

    expect(onChoose).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    const code = swatch().getAttribute("aria-describedby")?.split(" ")[0] ?? "";
    expect(document.getElementById(code)?.textContent).toBe("#1f6feb");
  });

  it("chooses nothing when it closes on the colour it opened on", async () => {
    const { onChoose, swatch, user } = setUp();
    await user.click(swatch());
    await user.click(swatch());

    expect(onChoose).not.toHaveBeenCalled();
  });

  it("takes a hex code typed in, of three or six digits, once Enter is pressed", async () => {
    const { onChoose, swatch, hex, user } = setUp();
    await user.click(swatch());

    await user.clear(hex());
    await user.type(hex(), "fa0{Enter}");
    expect(hex().value).toBe("#ffaa00");
    await user.click(swatch());

    expect(onChoose).toHaveBeenCalledWith("#ffaa00");
  });

  it("takes a code still in its box when a click away closes it", async () => {
    const { onChoose, swatch, hex, user } = setUp();
    await user.click(swatch());

    await user.clear(hex());
    await user.type(hex(), "#c0392b");
    await user.click(document.body);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onChoose).toHaveBeenCalledOnce();
    expect(onChoose).toHaveBeenCalledWith("#c0392b");
  });

  it("refuses a code that isn't one, saying why, and keeps the colour", async () => {
    const { onChoose, swatch, hex, user } = setUp();
    await user.click(swatch());

    await user.clear(hex());
    await user.type(hex(), "#12{Enter}");

    expect(hex().getAttribute("aria-invalid")).toBe("true");
    const reason = document.getElementById(hex().getAttribute("aria-describedby") ?? "");
    expect(reason?.textContent).toBe(
      "A hex code is 6 digits and letters from a to f, such as #1a7f5a",
    );
    await user.click(swatch());
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("offers colours given to it, read as it opens, and takes one clicked (#1219)", async () => {
    const colours = vi.fn(() => ["#c0392b", "#1f6feb"]);
    const onChoose = vi.fn();
    render(
      <ColourPicker value="#1f6feb" aria-label="Brand" colours={colours} onChoose={onChoose} />,
    );
    expect(colours).not.toHaveBeenCalled();
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole("button", { name: "Brand" }));

    const offered = screen.getByRole("list", { name: "Colours on this site" });
    const red = screen.getByRole("button", { name: "#c0392b" });
    expect(offered.contains(red)).toBe(true);
    expect(screen.getByRole("button", { name: "#1f6feb" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    await user.click(red);
    expect(red.getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Brand" }));

    expect(colours).toHaveBeenCalledOnce();
    expect(onChoose).toHaveBeenCalledWith("#c0392b");
  });

  it("offers no list when it has no colours to offer", async () => {
    const { swatch, user } = setUp();
    await user.click(swatch());

    expect(screen.queryByRole("list", { name: "Colours on this site" })).toBeNull();
  });

  it("offers the eyedropper only where the window has one, and takes the colour it picks", async () => {
    const first = setUp();
    await first.user.click(first.swatch());
    expect(screen.queryByRole("button", { name: "Pick a Colour from the Screen" })).toBeNull();
    cleanup();

    const open = vi.fn(() => Promise.resolve({ sRGBHex: "#C0392B" }));
    vi.stubGlobal(
      "EyeDropper",
      class {
        open = open;
      },
    );
    const { onChoose, swatch, hex, user } = setUp();
    await user.click(swatch());
    await user.click(screen.getByRole("button", { name: "Pick a Colour from the Screen" }));

    await vi.waitFor(() => expect(hex().value).toBe("#c0392b"));
    await user.click(swatch());
    expect(open).toHaveBeenCalledOnce();
    expect(onChoose).toHaveBeenCalledWith("#c0392b");
  });

  it("keeps the colour when the eyedropper is cancelled", async () => {
    vi.stubGlobal(
      "EyeDropper",
      class {
        open = () => Promise.reject(new DOMException("Cancelled", "AbortError"));
      },
    );
    const { onChoose, swatch, hex, user } = setUp();
    await user.click(swatch());
    await user.click(screen.getByRole("button", { name: "Pick a Colour from the Screen" }));
    await user.click(hex());

    expect(hex().value).toBe("#1f6feb");
    await user.click(swatch());
    expect(onChoose).not.toHaveBeenCalled();
  });
});
