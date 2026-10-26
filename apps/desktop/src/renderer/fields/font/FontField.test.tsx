// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FieldRendererProps } from "@webforge/editor-ui";
import { FONT_CATALOGUE } from "@webforge/themes";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FontField } from "./FontField.js";
import { addFontPreviews, fontPreviewCss, previewFamily } from "./font-previews.js";

afterEach(cleanup);

/** The field with `value`, and what it reports. */
function setUp(value: unknown = { family: "Inter", fallback: "sans-serif" }) {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  const props: FieldRendererProps<"font"> = {
    id: "font",
    labelId: "font-label",
    field: { kind: "font", label: "Headings" },
    value,
    onChange,
    onCommit,
  };
  render(
    <>
      <span id="font-label">Headings</span>
      <FontField {...props} />
    </>,
  );
  return { onChange, onCommit, user: userEvent.setup({ delay: null }) };
}

describe("the font field (2.3a)", { timeout: 15_000 }, () => {
  it("shows the font in itself, and chooses another in the picker as one change", async () => {
    const { onChange, onCommit, user } = setUp();
    const button = screen.getByRole("button", { name: "Headings Inter" });
    expect(button.querySelector("span")?.style.fontFamily).toContain("Webforge preview Inter");

    await user.click(button);
    const picker = within(screen.getByRole("dialog", { name: "Choose a font" }));
    await user.type(picker.getByRole("searchbox"), "Lora");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith({ family: "Lora", fallback: "serif" });
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("changes nothing when the font chosen is the one it has", async () => {
    const { onChange, user } = setUp();

    await user.click(screen.getByRole("button", { name: "Headings Inter" }));
    await user.keyboard("{Enter}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("previews the font the person is on in sample text they can change", async () => {
    const { user } = setUp();

    await user.click(screen.getByRole("button", { name: "Headings Inter" }));
    const sample = screen.getByRole("textbox", { name: "Sample text" });
    fireEvent.change(sample, { target: { value: "Rosa's Bakery" } });

    expect(screen.getAllByText("Rosa's Bakery").length).toBeGreaterThan(0);
  });

  it("asks for a font when it has none", () => {
    setUp(null);

    expect(screen.getByRole("button", { name: "Headings Choose a font…" })).toBeTruthy();
  });
});

describe("the font previews (2.3a)", () => {
  it("load one file of each of the app's fonts from its own scheme", () => {
    const css = fontPreviewCss();

    expect(css.match(/@font-face/g)).toHaveLength(FONT_CATALOGUE.length);
    expect(css).toContain('font-family: "Webforge preview Inter";');
    expect(css).toMatch(/src: url\("webforge-font:\/\/fonts\/inter-latin-wght-normal\.woff2"\)/);
    expect(previewFamily({ family: "Lora", fallback: "serif" })).toBe(
      '"Webforge preview Lora", serif',
    );
  });

  it("are added to the page once", () => {
    addFontPreviews(document);
    addFontPreviews(document);

    expect(document.querySelectorAll("#webforge-font-previews")).toHaveLength(1);
  });
});
