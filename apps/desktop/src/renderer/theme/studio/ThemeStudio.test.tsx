// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_THEME, type Theme, themeIdSchema } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OwnTheme, ThemesApi } from "../../../shared/ipc/themes.js";
import { starterSite } from "../../../shared/starter-site.js";
import { sessionWith } from "../../testing/fixtures.js";
import { OwnThemeDialogs } from "../OwnThemeDialogs.js";
import { createOwnThemes } from "../own-themes.js";
import { ThemePanel } from "../ThemePanel.js";
import { setLook } from "../theme-edits.js";
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
  it("opens from the Theme tab's button, as a large dialog in the window, and closes again", async () => {
    const session = sessionWith();
    const studio = createStudio();
    render(
      <>
        <ThemePanel session={session} studio={studio} />
        <ThemeStudio session={session} studio={studio} />
      </>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Open Theme Studio" }));
    const dialog = screen.getByRole("dialog", { name: "Theme Studio" });
    expect(
      within(dialog)
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["Themes", "Colours", "Text", "Styles", "Components"]);
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

    expect(theme().radius.box).toBe("xl");
    expect(theme().effects.noise).toBe(true);
    expect(labels()).toEqual(["Changed corner style", "Changed effects"]);
    // The buttons' tokens and the card style are in Components, with their looks (3.12).
    expect(dialog().queryByRole("combobox", { name: "Card style" })).toBeNull();
  });
});

describe("Theme Studio's My themes (2.23, PH2-17)", () => {
  /** Theme Studio on its themes, with My themes holding a "Night" theme, and its dialogs. */
  async function withMyThemes() {
    const session = sessionWith();
    const studio = createStudio();
    studio.setState({ open: true, section: "themes" });
    const night: OwnTheme = {
      ...structuredClone(DEFAULT_THEME),
      scheme: "dark",
      own: { id: themeIdSchema.parse("theme0000000000n"), name: "Night" },
    };
    const api = {
      list: vi.fn(() => Promise.resolve([night])),
      keep: vi.fn(() => Promise.resolve("kept" as const)),
      remove: vi.fn(() => Promise.resolve(null)),
    } satisfies ThemesApi;
    const ownThemes = createOwnThemes(() => api);
    function Window() {
      return (
        <>
          <ThemeStudio session={session} studio={studio} ownThemes={ownThemes} />
          <OwnThemeDialogs ownThemes={ownThemes} site={session.history.document.getState().theme} />
        </>
      );
    }
    render(<Window />);
    const dialog = () => within(screen.getByRole("dialog", { name: "Theme Studio" }));
    await dialog().findByRole("button", { name: /^Night/ });
    return {
      session,
      api,
      dialog,
      labels: () => session.history.entries().map((entry) => entry.label),
      theme: () => session.history.document.getState().theme,
      user: userEvent.setup({ delay: null }),
    };
  }

  it("lists the person's own themes first, then the built-in ones, and uses one", async () => {
    const { dialog, labels, theme, user } = await withMyThemes();

    const mine = dialog().getByRole("list", { name: "My themes" });
    expect(within(mine).getAllByRole("button", { name: /^Night/ })).toHaveLength(1);
    expect(dialog().getByRole("list", { name: "Built-in themes" })).toBeDefined();
    await user.click(within(mine).getByRole("button", { name: /^Night/ }));

    await vi.waitFor(() => expect(theme().own?.name).toBe("Night"));
    expect(labels()).toEqual(["Changed theme to 'Night'"]);
  });

  it("creates a new theme from a built-in one, by name", async () => {
    const { dialog, labels, theme, user } = await withMyThemes();

    await user.click(dialog().getByRole("button", { name: "New theme…" }));
    const form = within(await screen.findByRole("dialog", { name: "New theme" }));
    await user.selectOptions(form.getByRole("combobox", { name: "Start from" }), "bistro");
    const name = form.getByRole("textbox", { name: "Theme name" });
    await user.clear(name);
    await user.type(name, "Shop");
    await user.click(form.getByRole("button", { name: "Create Theme" }));

    await vi.waitFor(() => expect(theme().own?.name).toBe("Shop"));
    expect(theme().preset).toBe("bistro");
    expect(labels()).toEqual(["Created theme 'Shop'"]);
  });

  it("renames and deletes one of the person's own; the site keeps its copy", async () => {
    const { dialog, api, labels, theme, user } = await withMyThemes();
    await user.click(dialog().getByRole("button", { name: /^Night/ }));
    await vi.waitFor(() => expect(theme().own?.name).toBe("Night"));

    await user.click(dialog().getByRole("button", { name: "Rename Night" }));
    const rename = within(await screen.findByRole("dialog", { name: "Rename theme" }));
    const name = rename.getByRole("textbox", { name: "Theme name" });
    await user.clear(name);
    await user.type(name, "Late night");
    await user.click(rename.getByRole("button", { name: "Rename" }));
    await vi.waitFor(() => expect(theme().own?.name).toBe("Late night"));
    expect(labels()).toEqual(["Changed theme to 'Night'", "Renamed theme to 'Late night'"]);

    await user.click(dialog().getByRole("button", { name: "Delete Late night" }));
    const remove = within(await screen.findByRole("alertdialog"));
    expect(remove.getByText(/This site keeps its copy/)).toBeDefined();
    await user.click(remove.getByRole("button", { name: "Delete Theme" }));

    expect(api.remove).toHaveBeenCalledWith("theme0000000000n");
    expect(theme().own?.name).toBe("Late night");
    expect(labels()).toHaveLength(2);
  });
});

describe("Theme Studio's Components (3.12, CT-1; 4.10)", () => {
  /** Theme Studio on Components' Button, with previews that say which look they draw. */
  function onButton() {
    const session = sessionWith();
    const studio = createStudio();
    studio.setState({ open: true, section: "components", kind: "Button" });
    const siteWide = { confirmSiteWide: vi.fn(() => Promise.resolve(true)) };
    const lookOf = (type: string, theme?: Theme) =>
      JSON.stringify((theme ?? session.history.document.getState().theme).looks?.[type] ?? {});
    render(
      <ThemeStudio
        session={session}
        studio={studio}
        siteWide={siteWide}
        kindPreviews={(type, theme) => <span data-testid="preview">{lookOf(type, theme)}</span>}
        itemPreviews={(node, device, theme) => (
          <span data-testid={`large-${device}`}>{lookOf(node.type, theme)}</span>
        )}
      />,
    );
    return {
      session,
      studio,
      siteWide,
      dialog: () => within(screen.getByRole("dialog", { name: "Theme Studio" })),
      button: () => within(screen.getByRole("region", { name: "Button" })),
      labels: () => session.history.entries().map((entry) => entry.label),
      theme: () => session.history.document.getState().theme,
      user: userEvent.setup({ delay: null }),
    };
  }

  it("lists each kind with a look by category, and applies several changes as one step", async () => {
    const { dialog, button, labels, theme, siteWide, user } = onButton();
    const kinds = within(dialog().getByRole("navigation", { name: "Sections and elements" }));
    expect(kinds.getByRole("region", { name: "Sections" })).toBeDefined();
    expect(kinds.getByRole("button", { name: "Card" })).toBeDefined();
    // The theme's button tokens beside the Button look, as in the Theme tab.
    expect(button().getByText("Every button")).toBeDefined();

    await user.selectOptions(button().getByRole("combobox", { name: "Corners" }), "full");
    await user.selectOptions(button().getByRole("combobox", { name: "Shadow" }), "large");
    // Nothing in the theme yet; the preview draws the draft.
    expect(theme().looks).toBeUndefined();
    expect(labels()).toEqual([]);
    expect(screen.getByTestId("preview").textContent).toBe(
      JSON.stringify({ lookCorners: "full", lookShadow: "large" }),
    );
    expect(
      button().getByText("Changes to every Button that aren't in the theme yet."),
    ).toBeDefined();

    await user.click(button().getByRole("button", { name: "Apply Changes" }));
    expect(theme().looks).toEqual({ Button: { lookCorners: "full", lookShadow: "large" } });
    expect(labels()).toEqual(["Changed the theme's look for Button"]);
    expect(siteWide.confirmSiteWide.mock.calls.length).toBeLessThanOrEqual(1);
    expect(
      button().queryByText("Changes to every Button that aren't in the theme yet."),
    ).toBeNull();

    // Reset is a draft too: back to the theme's defaults once applied.
    await user.click(button().getByRole("button", { name: "Reset to Theme's Defaults" }));
    expect(theme().looks).toBeDefined();
    await user.click(button().getByRole("button", { name: "Apply Changes" }));
    expect(theme().looks).toBeUndefined();
    expect(labels()).toEqual([
      "Changed the theme's look for Button",
      "Reset the theme's look for Button",
    ]);
  });

  it("discards a draft, leaving the theme and its controls as they were", async () => {
    const { button, labels, theme, user } = onButton();

    await user.selectOptions(button().getByRole("combobox", { name: "Corners" }), "full");
    await user.click(button().getByRole("button", { name: "Discard" }));

    expect(theme().looks).toBeUndefined();
    expect(labels()).toEqual([]);
    expect(
      (button().getByRole("combobox", { name: "Corners" }) as HTMLSelectElement).value,
    ).not.toBe("full");
    expect(screen.getByTestId("preview").textContent).toBe("{}");
  });

  it("asks to apply or discard a draft before showing another kind", async () => {
    const { dialog, button, labels, theme, studio, user } = onButton();
    await user.selectOptions(button().getByRole("combobox", { name: "Corners" }), "full");

    await user.click(dialog().getByRole("button", { name: "Card" }));
    let ask = screen.getByRole("alertdialog", { name: "Apply your changes to every Button?" });
    await user.click(within(ask).getByRole("button", { name: "Keep Editing" }));
    expect(studio.getState().kind).toBe("Button");
    expect(theme().looks).toBeUndefined();

    await user.click(dialog().getByRole("button", { name: "Card" }));
    ask = screen.getByRole("alertdialog", { name: "Apply your changes to every Button?" });
    await user.click(within(ask).getByRole("button", { name: "Apply Changes" }));
    expect(theme().looks).toEqual({ Button: { lookCorners: "full" } });
    expect(labels()).toEqual(["Changed the theme's look for Button"]);
    expect(studio.getState().kind).toBe("Card");
  });

  it("asks before closing with a draft, and Discard closes leaving the theme as it was", async () => {
    const { button, labels, theme, studio, user } = onButton();
    await user.selectOptions(button().getByRole("combobox", { name: "Corners" }), "full");

    await user.keyboard("{Escape}");
    const ask = screen.getByRole("alertdialog", { name: "Apply your changes to every Button?" });
    expect(studio.getState().open).toBe(true);
    await user.click(within(ask).getByRole("button", { name: "Discard Changes" }));

    expect(studio.getState().open).toBe(false);
    expect(studio.getState().draft).toBeUndefined();
    expect(theme().looks).toBeUndefined();
    expect(labels()).toEqual([]);
  });

  it("opens the preview larger, on Desktop and Mobile, switching between now and the draft", async () => {
    const { button, user } = onButton();
    await user.selectOptions(button().getByRole("combobox", { name: "Corners" }), "full");

    await user.click(
      button().getByRole("button", { name: "Show Button larger, before and after" }),
    );
    const large = within(screen.getByRole("dialog", { name: "Every Button, before and after" }));
    const draft = JSON.stringify({ lookCorners: "full" });
    expect(large.getByTestId("large-desktop").textContent).toBe(draft);
    expect(large.getByTestId("large-mobile").textContent).toBe(draft);

    await user.click(large.getByRole("radio", { name: "Theme now" }));
    expect(large.getByTestId("large-desktop").textContent).toBe("{}");
    expect(large.getByTestId("large-mobile").textContent).toBe("{}");
    await user.click(large.getByRole("radio", { name: "With your changes" }));
    expect(large.getByTestId("large-desktop").textContent).toBe(draft);
  });

  it("changes Desktop's value of a look set per device, keeping Tablet's and Mobile's", async () => {
    const site = starterSite();
    site.theme.looks = {
      Button: { lookShadow: { $responsive: { desktop: "large", mobile: "none" } } },
    };
    const session = sessionWith(site);
    const studio = createStudio();
    studio.setState({ open: true, section: "components", kind: "Button" });
    render(<ThemeStudio session={session} studio={studio} />);
    const button = within(screen.getByRole("region", { name: "Button" }));
    const user = userEvent.setup({ delay: null });

    expect(button.getByText(/^Set per device/)).toBeDefined();
    await user.selectOptions(button.getByRole("combobox", { name: "Shadow" }), "medium");
    await user.click(button.getByRole("button", { name: "Apply Changes" }));

    expect(session.history.document.getState().theme.looks).toEqual({
      Button: { lookShadow: { $responsive: { desktop: "medium", mobile: "none" } } },
    });
  });

  it("applies only its own changes, keeping one made to the look since it began (review)", async () => {
    const { session, button, theme, user } = onButton();
    await user.selectOptions(button().getByRole("combobox", { name: "Corners" }), "full");

    // Meanwhile Style this Button… (or an AI app) sets the look's Border.
    await act(() => setLook(session, undefined, "Button", "Button", { lookBorder: "thick" }));
    await user.click(button().getByRole("button", { name: "Apply Changes" }));

    expect(theme().looks).toEqual({ Button: { lookBorder: "thick", lookCorners: "full" } });
  });

  it("drops the question once the draft changes nothing, and never asks it later unprompted", async () => {
    const { session, dialog, button, studio, user } = onButton();
    await user.selectOptions(button().getByRole("combobox", { name: "Corners" }), "full");
    await user.click(dialog().getByRole("button", { name: "Card" }));
    expect(screen.getByRole("alertdialog")).toBeDefined();

    // The look takes the same value elsewhere: there's nothing left to apply.
    await act(() => setLook(session, undefined, "Button", "Button", { lookCorners: "full" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(studio.getState().pending).toBeUndefined();
    expect(studio.getState().kind).toBe("Button");

    // A new draft asks nothing until the person leaves it.
    await user.selectOptions(button().getByRole("combobox", { name: "Shadow" }), "large");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(studio.getState().kind).toBe("Button");
  });

  it("asks at once when it opens with a question waiting (a look link from the Theme tab)", async () => {
    const { button, studio, user } = onButton();
    await user.selectOptions(button().getByRole("combobox", { name: "Corners" }), "full");

    act(() => studio.setState({ pending: { kind: "Card" } }));
    const ask = await screen.findByRole("alertdialog", {
      name: "Apply your changes to every Button?",
    });
    await user.click(within(ask).getByRole("button", { name: "Discard Changes" }));
    expect(studio.getState().kind).toBe("Card");
  });

  it("gives the focus back to the preview when the larger one closes, opening again on the changes", async () => {
    const { button, user } = onButton();
    await user.selectOptions(button().getByRole("combobox", { name: "Corners" }), "full");
    const opener = button().getByRole("button", { name: "Show Button larger, before and after" });

    await user.click(opener);
    const large = () =>
      within(screen.getByRole("dialog", { name: "Every Button, before and after" }));
    await user.click(large().getByRole("radio", { name: "Theme now" }));
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Every Button, before and after" })).toBeNull(),
    );
    await waitFor(() => expect(document.activeElement).toBe(opener));

    await user.click(opener);
    expect(
      large().getByRole("radio", { name: "With your changes" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("shows the card style as the Card look, changed at once", async () => {
    const { dialog, labels, theme, user } = setUp("components");

    await user.click(dialog().getByRole("button", { name: "Card" }));
    const card = within(dialog().getByRole("region", { name: "Card" }));
    expect(card.getByText("The cards in Features, Stats, Team and Testimonials.")).toBeDefined();
    await user.selectOptions(card.getByRole("combobox", { name: "Card style" }), "raised");

    expect(theme().cards.style).toBe("raised");
    expect(labels()).toEqual(["Changed card style"]);
  });
});
