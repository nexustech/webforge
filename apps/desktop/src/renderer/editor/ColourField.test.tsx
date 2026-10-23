// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColourField, type ContrastRatio } from "./ColourField.js";
import { createEditorSession } from "./editor-session.js";
import { starterSite } from "./starter-site.js";

afterEach(cleanup);

const FIELD = {
  kind: "color",
  label: "Colour",
  options: [
    { label: "Text colour", value: "default" },
    { label: "Primary", value: "primary" },
    { label: "Accent", value: "accent" },
  ],
};

/** A stand-in for the themes package's contrast: too little for anything as light as the accent. */
const contrastRatio: ContrastRatio = (colour) => (colour.l > 0.7 ? 1.9 : 9);

function setUp(value: string, contrast: ContrastRatio | "none" = contrastRatio) {
  const session = createEditorSession(siteLibrary, starterSite());
  const onChange = vi.fn();
  const onCommit = vi.fn();
  const view = (current: string) => (
    <>
      <span id="label">Colour</span>
      <ColourField
        id="field-color"
        labelId="label"
        field={FIELD}
        value={current}
        onChange={onChange}
        onCommit={onCommit}
        session={session}
        contrastRatio={contrast === "none" ? undefined : contrast}
      />
    </>
  );
  const { rerender } = render(view(value));
  const swatch = (name: string) =>
    screen
      .getByRole("radio", { name })
      .querySelector<HTMLElement>("[data-swatch]")
      ?.style.getPropertyValue("--swatch");
  return { session, onChange, onCommit, swatch, rerender: (next: string) => rerender(view(next)) };
}

describe("ColourField (1.37, UX-25)", () => {
  it("shows each theme colour in the site's own colour, and keeps up with the theme", () => {
    const { session, swatch } = setUp("default");

    expect(swatch("Brand")).toBe("oklch(45% 0.24 277.023)");
    act(() =>
      session.edit("root", "Changed theme colours", (draft) => {
        draft.theme.colors.primary = { l: 0.5, c: 0.2, h: 30 };
      }),
    );
    expect(swatch("Brand")).toBe("oklch(50% 0.2 30)");
  });

  it("makes one change of a choice", async () => {
    const { onChange, onCommit } = setUp("default");

    await userEvent.click(screen.getByRole("radio", { name: "Brand" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith("primary");
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("warns when the colour chosen is hard to read on the page, and not otherwise", () => {
    const { rerender } = setUp("primary");
    expect(screen.queryByText(/Hard to read/)).toBeNull();

    rerender("accent");

    expect(screen.getByText(/Hard to read on the page: contrast 1\.9:1/)).toBeTruthy();
    expect(document.getElementById("field-color")?.getAttribute("aria-describedby")).not.toBe(null);
  });

  it("names the colours as people know them, and has no warning without a contrast check", () => {
    setUp("accent", "none");

    expect(screen.getAllByRole("radio").map((radio) => radio.textContent)).toEqual([
      "Text",
      "Brand",
      "Second accent",
    ]);
    expect(screen.queryByText(/Hard to read/)).toBeNull();
  });
});
