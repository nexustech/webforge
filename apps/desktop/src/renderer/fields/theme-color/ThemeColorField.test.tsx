// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FieldRendererProps } from "@webforge/editor-ui";
import { hexToOklch } from "@webforge/themes";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeColorField } from "./ThemeColorField.js";

afterEach(cleanup);

const BLUE = hexToOklch("#1f6feb");

/** The field showing `value`, with `warnings` and `more` of its spec, and what it reports. */
function setUp(
  value: unknown = BLUE,
  warnings: readonly string[] = [],
  more: Pick<FieldRendererProps<"themeColor">["field"], "code" | "suggestion"> = {},
) {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  const props: FieldRendererProps<"themeColor"> = {
    id: "brand",
    labelId: "brand-label",
    field: { kind: "themeColor", label: "Brand", warnings, ...more },
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

/** The colour picker's swatch button, named by the field's label. */
const swatch = () => screen.getByRole("button", { name: "Brand" });

/** The code the swatch shows, as a screen reader hears it. */
const swatchCode = () =>
  document.getElementById(swatch().getAttribute("aria-describedby")?.split(" ")[0] ?? "")
    ?.textContent;

/** Opens the picker, types `hex` in its code box, runs `meanwhile`, and closes it. */
async function choose(
  user: ReturnType<typeof userEvent.setup>,
  hex: string,
  meanwhile: () => void = () => undefined,
) {
  await user.click(swatch());
  const box = screen.getByRole("textbox", { name: "Hex code" });
  await user.clear(box);
  await user.type(box, `${hex}{Enter}`);
  meanwhile();
  await user.click(swatch());
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

  it("uses the picker's colour once it closes, not at every step (5.26)", async () => {
    const { onChange, onCommit, user } = setUp();

    await choose(user, "#00ff00", () => expect(onChange).not.toHaveBeenCalled());

    expect(onChange).toHaveBeenCalledWith(hexToOklch("#00ff00"));
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("shows the stored colour again when the one offered isn't taken (declined at D7)", async () => {
    const { onChange, user } = setUp();

    await choose(user, "#00ff00");

    // The value it was given hasn't changed: the change was declined.
    expect(onChange).toHaveBeenCalledOnce();
    expect(swatchCode()).toBe("#1f6feb");
    await choose(user, "#00ff00");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("lists what its contrast lacks, which the picker is described by", () => {
    setUp(BLUE, ["Hard to read with Surface: 2.1:1, needs 4.5:1."]);

    const ids = swatch().getAttribute("aria-describedby")?.split(" ") ?? [];
    const described = ids.map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual(["#1f6feb", "Hard to read with Surface: 2.1:1, needs 4.5:1."]);
  });

  it("leaves its hex code out where it is asked to: Simple mode's Theme tab (LF-16)", async () => {
    const { user } = setUp(BLUE, [], { code: false });

    expect(screen.queryByRole("textbox")).toBeNull();
    // The picker still has one, so a brand colour's code can be typed in either mode (5.26).
    await user.click(swatch());
    expect(screen.getByRole("textbox", { name: "Hex code" })).toBeTruthy();
  });

  it("offers a shade that reads, and chooses it in one click as it is (#1174)", async () => {
    const darker = { l: 0.42, c: 0.19, h: 259 };
    const { onChange, onCommit, user } = setUp(BLUE, ["Brand is hard to read on Surface"], {
      suggestion: { value: darker, label: "Use a darker shade" },
    });

    const button = screen.getByRole("button", { name: "Use a darker shade" });
    // Which colour's shade, when several colours offer one in the same words.
    expect(button.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByRole("button", { description: "Brand" })).toBe(button);
    await user.click(button);

    // As it is, the colour whose contrast was checked.
    expect(onChange).toHaveBeenCalledWith(darker);
    expect(onCommit).toHaveBeenCalledOnce();
  });
});
