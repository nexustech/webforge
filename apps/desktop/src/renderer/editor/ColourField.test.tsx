// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_THEME } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColourField, type ContrastRatio, contrastNeeded } from "./ColourField.js";
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

function setUp(
  value: string,
  contrast: ContrastRatio | "none" = contrastRatio,
  textStyle?: () => "h1" | "body",
) {
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
        textStyle={textStyle}
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

    expect(screen.getByText(/contrast 1\.9:1, less than the 4\.5:1 this text needs/)).toBeTruthy();
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

  it("asks less contrast of large text: a 3.5:1 colour is fine for a big heading, not for body text", () => {
    const fair: ContrastRatio = () => 3.5;
    setUp("primary", fair, () => "h1");
    expect(screen.queryByText(/Hard to read/)).toBeNull();
    cleanup();

    setUp("primary", fair, () => "body");
    expect(screen.getByText(/contrast 3\.5:1, less than the 4\.5:1 this text needs/)).toBeTruthy();
  });
});

describe("contrastNeeded (WCAG AA, F-DS-2)", () => {
  it("is 3:1 from 24 px, or 18.66 px when bold, and 4.5:1 below or unknown", () => {
    const theme = structuredClone(DEFAULT_THEME);
    theme.typeScale.h6 = { size: "sm", weight: 700, leading: "normal" };
    theme.typeScale.body = { size: "2xl", weight: 400, leading: "relaxed" };
    theme.typeScale.h4 = { size: "xl", weight: 700, leading: "normal" };
    theme.typeScale.h5 = { size: "xl", weight: 600, leading: "normal" };

    // A small H6 needs the full 4.5:1, bold as it is; a large body style only 3:1.
    expect(contrastNeeded(theme, "h6")).toBe(4.5);
    expect(contrastNeeded(theme, "body")).toBe(3);
    // 20 px is large only when bold.
    expect(contrastNeeded(theme, "h4")).toBe(3);
    expect(contrastNeeded(theme, "h5")).toBe(4.5);
    expect(contrastNeeded(theme, undefined)).toBe(4.5);
  });
});
