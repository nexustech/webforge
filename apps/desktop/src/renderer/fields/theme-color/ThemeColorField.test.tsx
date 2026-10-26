// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FieldRendererProps } from "@webforge/editor-ui";
import { hexToOklch } from "@webforge/themes";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeColorField } from "./ThemeColorField.js";

afterEach(cleanup);

const BLUE = hexToOklch("#1f6feb");

/** The field showing `value`, with `warnings`, and what it reports. */
function setUp(value: unknown = BLUE, warnings: readonly string[] = []) {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  const props: FieldRendererProps<"themeColor"> = {
    id: "brand",
    labelId: "brand-label",
    field: { kind: "themeColor", label: "Brand", warnings },
    value,
    onChange,
    onCommit,
  };
  render(
    <>
      <span id="brand-label">Brand</span>
      <ThemeColorField {...props} />
    </>,
  );
  const hex = () => screen.getByRole("textbox", { name: "Brand hex code" }) as HTMLInputElement;
  return { onChange, onCommit, hex, user: userEvent.setup({ delay: null }) };
}

describe("a theme colour's field (2.3a)", () => {
  it("shows the colour's hex code, and uses one typed in once Enter is pressed", async () => {
    const { onChange, onCommit, hex, user } = setUp();
    expect(hex().value).toBe("#1f6feb");

    await user.clear(hex());
    await user.type(hex(), "B45309{Enter}");

    expect(onChange).toHaveBeenCalledWith(hexToOklch("#b45309"));
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("ignores a code that isn't one, or is the colour it has, and shows the colour again", async () => {
    const { onChange, hex, user } = setUp();

    await user.clear(hex());
    await user.type(hex(), "#12{Enter}");
    expect(hex().value).toBe("#1f6feb");
    await user.clear(hex());
    await user.type(hex(), "#1F6FEB");
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
  });

  it("uses the picker's colour once it closes, not at every step", () => {
    const { onChange, onCommit } = setUp();
    const picker = screen.getByLabelText("Brand", { selector: 'input[type="color"]' });

    fireEvent.input(picker, { target: { value: "#00ff00" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(picker, { target: { value: "#00ff00" } });

    expect(onChange).toHaveBeenCalledWith(hexToOklch("#00ff00"));
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("lists what its contrast lacks, which the picker is described by", () => {
    setUp(BLUE, ["Hard to read with Surface: 2.1:1, needs 4.5:1."]);

    const picker = screen.getByLabelText("Brand", { selector: 'input[type="color"]' });
    const warnings = document.getElementById(picker.getAttribute("aria-describedby") ?? "");
    expect(warnings?.textContent).toBe("Hard to read with Surface: 2.1:1, needs 4.5:1.");
  });
});
