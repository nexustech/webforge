// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionWith } from "../../testing/fixtures.js";
import { ThemePanel } from "../ThemePanel.js";
import { createStudio, type StudioSection } from "./studio-state.js";
import { ThemeStudio } from "./ThemeStudio.js";

afterEach(cleanup);

/** Theme Studio open on `section`, on the starter site, with a confirmation that says yes. */
function setUp(section: StudioSection = "themes") {
  const session = sessionWith();
  const studio = createStudio();
  studio.setState({ open: true, section });
  const siteWide = { confirmSiteWide: vi.fn(() => Promise.resolve(true)) };
  render(<ThemeStudio session={session} studio={studio} siteWide={siteWide} />);
  return {
    session,
    studio,
    siteWide,
    dialog: () => within(screen.getByRole("dialog", { name: "Theme Studio" })),
    labels: () => session.history.entries().map((entry) => entry.label),
    theme: () => session.history.document.getState().theme,
    user: userEvent.setup({ delay: null }),
  };
}

describe("Theme Studio (2.3b, F-DS-7)", () => {
  it("opens from the Theme tab, as a large dialog in the window, and closes again", async () => {
    const session = sessionWith();
    const studio = createStudio();
    render(<ThemePanel session={session} studio={studio} />);

    await userEvent.click(screen.getByRole("button", { name: "Open Theme Studio" }));
    const dialog = screen.getByRole("dialog", { name: "Theme Studio" });
    expect(
      within(dialog)
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["Themes", "Colours", "Text", "Styles"]);
    await userEvent.keyboard("{Escape}");
    expect(studio.getState().open).toBe(false);
  });

  it("shows each theme as a card, its own marked, and switches to one once asked (D7)", async () => {
    const { dialog, siteWide, labels, theme, user } = setUp();

    const light = dialog().getByRole("button", { name: /Light/ });
    expect(light.getAttribute("aria-pressed")).toBe("true");
    await user.click(dialog().getByRole("button", { name: /Bistro/ }));

    expect(siteWide.confirmSiteWide).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(theme().preset).toBe("bistro"));
    expect(labels()).toEqual(["Changed theme to 'Bistro'"]);
  });

  it("sets a reversed section's colour on its own, with shades and warnings per palette", async () => {
    const { dialog, labels, theme, user } = setUp("colors");
    const page = theme().colors.info;

    expect(dialog().getAllByRole("list", { name: "Shades of Brand" })).toHaveLength(2);
    const hex = dialog().getByRole("textbox", { name: "Information Reversed sections hex code" });
    await user.clear(hex);
    await user.type(hex, "#0369a1{Enter}");

    await vi.waitFor(() =>
      expect(labels()).toEqual(["Changed Information colour in reversed sections"]),
    );
    expect(theme().colors.info).toEqual(page);
  });

  it("sets a text style's size, weight and line height, and the links' underline", async () => {
    const { dialog, labels, theme, user } = setUp("text");

    await user.selectOptions(dialog().getByRole("combobox", { name: "Heading 1 Weight" }), "800");
    await user.selectOptions(
      dialog().getByRole("combobox", { name: "Body text Line height" }),
      "normal",
    );
    await user.selectOptions(dialog().getByRole("combobox", { name: "Underline links" }), "hover");

    expect(theme().typeScale.h1.weight).toBe(800);
    expect(theme().typeScale.body.leading).toBe("normal");
    expect(theme().links.underline).toBe("hover");
    expect(labels()).toEqual([
      "Changed text style for Heading 1",
      "Changed text style for Body text",
      "Changed link style",
    ]);
  });

  it("sets the other styles, the corner scale drawn as samples", async () => {
    const { dialog, labels, theme, user } = setUp("styles");

    const corners = dialog().getByRole("radiogroup", { name: "Corners of boxes and cards" });
    await user.click(within(corners).getByRole("radio", { name: "Extra large" }));
    await user.click(dialog().getByRole("checkbox", { name: "Grain on surfaces" }));
    await user.selectOptions(dialog().getByRole("combobox", { name: "Card style" }), "raised");

    expect(theme().radius.box).toBe("xl");
    expect(theme().effects.noise).toBe(true);
    expect(theme().cards.style).toBe("raised");
    expect(labels()).toEqual(["Changed corner style", "Changed effects", "Changed card style"]);
  });
});
