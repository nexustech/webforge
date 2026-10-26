// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FieldRendererProps } from "@webforge/editor-ui";
import { FONT_CATALOGUE } from "@webforge/themes";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FontsApi } from "../../../shared/ipc/fonts.js";
import { FontField } from "./FontField.js";
import { fakeFonts } from "./fake-fonts.js";
import { addFontPreviews, fontPreviewCss, previewFamily } from "./font-previews.js";

afterEach(cleanup);

/** The field with `value`, the computer's fonts answered by `fonts`, and what it reports. */
function setUp(
  value: unknown = { family: "Inter", fallback: "sans-serif" },
  fonts: FontsApi = fakeFonts(),
) {
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
      <FontField {...props} fonts={() => fonts} />
    </>,
  );
  return { onChange, onCommit, fonts, user: userEvent.setup({ delay: null }) };
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

  it("lists the fonts the computer has, downloaded ones too, each shown in itself (2.3c)", async () => {
    const { onChange, user } = setUp();

    await user.click(screen.getByRole("button", { name: "Headings Inter" }));
    const picker = within(screen.getByRole("dialog", { name: "Choose a font" }));
    await user.type(picker.getByRole("searchbox"), "Comic");
    const comic = await picker.findByRole("option", { name: /Comic Neue/ });
    expect(comic.querySelector("span")?.style.fontFamily).toContain("Webforge preview Comic Neue");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith({ family: "Comic Neue", fallback: "sans-serif" });
  });

  it("reaches Fontsource only when asked to browse, then downloads a font once chosen (P8)", async () => {
    const fonts = fakeFonts();
    const browse = vi.spyOn(fonts, "browse");
    const download = vi.spyOn(fonts, "download");
    const { onChange, onCommit, user } = setUp(undefined, fonts);

    await user.click(screen.getByRole("button", { name: "Headings Inter" }));
    const picker = within(screen.getByRole("dialog", { name: "Choose a font" }));
    expect(browse).not.toHaveBeenCalled();
    await user.click(picker.getByRole("button", { name: "Browse all fonts" }));
    expect(await picker.findByText("1 more fonts to download, under To download.")).toBeTruthy();
    await user.click(picker.getByRole("button", { name: "To download" }));
    // Comic Neue is already on this computer: only Lobster is to download.
    expect(picker.getAllByRole("option").map((option) => option.textContent)).toEqual([
      expect.stringContaining("Lobster"),
    ]);
    await user.dblClick(picker.getByRole("option", { name: /Lobster/ }));

    await vi.waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ family: "Lobster", fallback: "sans-serif" }),
    );
    expect(download).toHaveBeenCalledWith("lobster");
    expect(onCommit).toHaveBeenCalledOnce();
    expect(browse).toHaveBeenCalledOnce();
  });

  it("says why a font didn't download, and changes nothing", async () => {
    for (const [reason, message] of [
      ["offline", "You're offline, so Lobster can't be downloaded. Nothing changed."],
      [
        "not-allowed",
        "Lobster can't be used: its licence doesn't allow it in your sites. Nothing changed.",
      ],
      ["damaged", "Lobster didn't download properly. Try again. Nothing changed."],
    ] as const) {
      const { onChange, user } = setUp(
        undefined,
        fakeFonts(() => Promise.resolve({ status: "failed", reason })),
      );
      await user.click(screen.getByRole("button", { name: "Headings Inter" }));
      const picker = within(screen.getByRole("dialog", { name: "Choose a font" }));
      await user.click(picker.getByRole("button", { name: "Browse all fonts" }));
      await user.click(await picker.findByRole("button", { name: "To download" }));
      await user.dblClick(picker.getByRole("option", { name: /Lobster/ }));

      expect(await screen.findByText(message)).toBeTruthy();
      expect(onChange).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it("says when the fonts to download can't be listed, offline, and offers to try again", async () => {
    const { user } = setUp(
      undefined,
      fakeFonts(undefined, () => Promise.resolve({ status: "failed", reason: "offline" })),
    );

    await user.click(screen.getByRole("button", { name: "Headings Inter" }));
    const picker = within(screen.getByRole("dialog", { name: "Choose a font" }));
    await user.click(picker.getByRole("button", { name: "Browse all fonts" }));

    expect(
      await picker.findByText("You're offline, so the fonts to download can't be listed now."),
    ).toBeTruthy();
    expect(picker.getByRole("button", { name: "Browse all fonts" })).toBeTruthy();
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
    expect(fontPreviewCss([{ family: "No File" }])).toBe("");
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
