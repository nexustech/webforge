// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_THEME, type TextStyle } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { contrastRatio } from "@webforge/themes";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColourField, contrastNeeded, shownRatio } from "./ColourField.js";
import { createEditorSession } from "./editor-session.js";
import { starterSite } from "./starter-site.js";

afterEach(cleanup);

const FIELD = {
  kind: "color",
  label: "Colour",
  options: [
    { label: "Text colour", value: "default" },
    { label: "Primary", value: "primary" },
    { label: "Secondary", value: "secondary" },
    { label: "Accent", value: "accent" },
  ],
};

function setUp(
  value: string,
  options: { readonly advanced?: boolean; readonly textStyles?: readonly TextStyle[] } = {},
) {
  const session = createEditorSession(siteLibrary, starterSite());
  const onChange = vi.fn();
  const onCommit = vi.fn();
  render(
    <>
      <span id="label">Colour</span>
      <ColourField
        id="field-color"
        labelId="label"
        field={FIELD}
        value={value}
        onChange={onChange}
        onCommit={onCommit}
        session={session}
        advanced={options.advanced}
        textStyles={options.textStyles === undefined ? undefined : () => options.textStyles ?? []}
      />
    </>,
  );
  const swatch = (name: string) =>
    screen
      .getByRole("radio", { name })
      .querySelector<HTMLElement>("[data-swatch]")
      ?.style.getPropertyValue("--swatch");
  const names = () =>
    [...(document.getElementById("field-color")?.querySelectorAll('[role="radio"]') ?? [])].map(
      (radio) => radio.textContent,
    );
  return { session, onChange, onCommit, swatch, names };
}

describe("ColourField (1.37, UX-25, ADR 0009)", () => {
  it("shows each theme colour in the site's own colour, by its glossary name", () => {
    const { session, swatch, names } = setUp("default");

    expect(names()).toEqual(["Text", "Brand", "Accent", "Second accent"]);
    expect(swatch("Brand")).toBe("oklch(45% 0.24 277.023)");
    act(() =>
      session.edit("root", "Changed theme colours", (draft) => {
        draft.theme.colors.primary = { l: 0.5, c: 0.2, h: 30 };
      }),
    );
    expect(swatch("Brand")).toBe("oklch(50% 0.2 30)");
  });

  it("makes one change of a choice, storing a colour ref, the text colour as the element's own", async () => {
    const { onChange, onCommit } = setUp("primary-300/80");

    await userEvent.click(screen.getByRole("radio", { name: "Accent" }));
    // Another role keeps the opacity.
    expect(onChange).toHaveBeenLastCalledWith("secondary/80");
    expect(onCommit).toHaveBeenCalledOnce();
    cleanup();

    const plain = setUp("primary");
    await userEvent.click(screen.getByRole("radio", { name: "Text" }));
    expect(plain.onChange).toHaveBeenLastCalledWith("default");
  });

  it("offers the colour roles' shades, and an opacity for any colour", async () => {
    const { onChange } = setUp("primary");

    await userEvent.click(screen.getByRole("radio", { name: "Shade 300" }));
    expect(onChange).toHaveBeenLastCalledWith("primary-300");
    fireEvent.change(screen.getByLabelText("Opacity"), { target: { value: "80" } });
    expect(onChange).toHaveBeenLastCalledWith("primary/80");
    cleanup();

    // The text colour has no shades; 100% is no opacity at all.
    const text = setUp("base-content/70");
    expect(screen.queryByRole("radio", { name: "Shade 300" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Opacity"), { target: { value: "100" } });
    expect(text.onChange).toHaveBeenLastCalledWith("default");
  });

  it("offers a colour of the field's own in Advanced mode only, marked off the theme", async () => {
    const simple = setUp("primary");
    expect(screen.queryByRole("radio", { name: "Custom" })).toBeNull();
    expect(simple.names()).not.toContain("Custom");
    cleanup();

    // It starts from the colour shown now: the brand colour, at the same opacity.
    const { onChange } = setUp("primary/50", { advanced: true });
    await userEvent.click(screen.getByRole("radio", { name: "Custom" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.stringMatching(/^\[#[0-9a-f]{6}\]\/50$/));
    expect(onChange).not.toHaveBeenLastCalledWith("[#000000]/50");
    cleanup();

    const custom = setUp("[#1f6feb]", { advanced: true });
    expect(custom.swatch("Custom")).toBe("#1f6feb");
    expect(screen.getByText(/Off the theme/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Custom colour"), { target: { value: "#ff8800" } });
    expect(custom.onChange).toHaveBeenLastCalledWith("[#ff8800]");
  });

  it("keeps a custom colour in Simple mode, shown, with a way back to the theme", async () => {
    const { onChange } = setUp("[#1f6feb]/50");

    expect(screen.getByText("Custom colour #1f6feb, off the theme")).toBeTruthy();
    // Its opacity is Advanced mode's to change too.
    expect(screen.queryByLabelText("Opacity")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Use a theme colour" }));

    expect(onChange).toHaveBeenLastCalledWith("default");
  });

  it("warns when the colour is hard to read on the page, by the text's size", () => {
    const { colors } = DEFAULT_THEME;
    const page = colors["base-100"];
    // A theme colour between 3:1 and 4.5:1 on the page: fine for a large heading only.
    const middling = (["secondary", "info", "success", "error"] as const).find((role) => {
      const ratio = contrastRatio(colors[role], page);
      return ratio >= 3 && ratio < 4.5;
    });
    if (middling === undefined) throw new Error("no colour between 3:1 and 4.5:1");

    setUp("primary");
    expect(screen.queryByText(/Hard to read/)).toBeNull();
    cleanup();
    // Opacity counts: the brand colour at 20% hardly shows.
    setUp("primary/20");
    expect(screen.getByText(/Hard to read on the page/)).toBeTruthy();
    cleanup();
    setUp(middling, { textStyles: ["h1"] });
    expect(screen.queryByText(/Hard to read/)).toBeNull();
    cleanup();
    setUp(middling, { textStyles: ["body"] });
    expect(screen.getByText(/less than the 4\.5:1 this text needs/)).toBeTruthy();
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
    expect(contrastNeeded(theme, ["h6"])).toBe(4.5);
    expect(contrastNeeded(theme, ["body"])).toBe(3);
    // 20 px is large only when bold.
    expect(contrastNeeded(theme, ["h4"])).toBe(3);
    expect(contrastNeeded(theme, ["h5"])).toBe(4.5);
    expect(contrastNeeded(theme, [])).toBe(4.5);
    // Large on one device and small on another: what the small one needs.
    expect(contrastNeeded(theme, ["body", "h6"])).toBe(4.5);
  });
});

describe("shownRatio", () => {
  it("rounds down, so a failing ratio never shows as the one it needs", () => {
    expect(shownRatio(4.46)).toBe("4.4");
    expect(shownRatio(2.99)).toBe("2.9");
    expect(shownRatio(4.5)).toBe("4.5");
    expect(shownRatio(21)).toBe("21.0");
  });
});
