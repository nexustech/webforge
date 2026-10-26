// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { t } from "@webforge/i18n";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { registriesForTest, sessionWith } from "../testing/fixtures.js";
import { registerThemePanel } from "./register-theme-panel.js";
import { ThemePanel } from "./ThemePanel.js";

afterEach(cleanup);

/** A colour's picker, by the colour's name. */
const colourPicker = (name: string) =>
  screen.getByLabelText(name, { selector: 'input[type="color"]' });

const labels = (session: ReturnType<typeof sessionWith>) =>
  session.history.entries().map((entry) => entry.label);

describe("the Theme tab (2.3a)", () => {
  it("is added to the right column after Site, and removed again", () => {
    const { panels } = registriesForTest();
    const remove = registerThemePanel(panels, sessionWith());

    expect(panels.list()).toEqual([
      expect.objectContaining({ id: "theme", slot: "right.bottom", title: t("theme.panelTitle") }),
    ]);
    remove();
    expect(panels.list()).toEqual([]);
  });

  it("shows the theme as rows in groups: its preset, colours, fonts, sizes and tokens", () => {
    render(<ThemePanel session={sessionWith()} />);

    expect(screen.getByRole("heading", { name: "Theme: Light" })).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "Theme" }) as HTMLSelectElement).value).toBe(
      "light",
    );
    for (const colour of ["Brand", "Accent", "Second accent", "Surface", "Text"]) {
      expect(colourPicker(colour)).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Headings Inter" })).toBeTruthy();
    expect(
      (screen.getByRole("combobox", { name: "Font pairing" }) as HTMLSelectElement).value,
    ).toBe("simple");
    expect((screen.getByRole("combobox", { name: "Heading 1" }) as HTMLSelectElement).value).toBe(
      "5xl",
    );
    expect((screen.getByRole("combobox", { name: "Card style" }) as HTMLSelectElement).value).toBe(
      "flat",
    );
    expect(screen.getByRole("switch", { name: "Depth on buttons and fields" })).toBeTruthy();
  });

  it("keeps a preset it doesn't list as the theme's, by its name in the file", () => {
    const site = starterSite();
    site.theme.preset = "harbour";
    render(<ThemePanel session={sessionWith(site)} />);

    const preset = screen.getByRole("combobox", { name: "Theme" }) as HTMLSelectElement;
    expect(preset.value).toBe("harbour");
    expect(screen.getByRole("heading", { name: "Theme: harbour" })).toBeTruthy();
  });

  it("makes a token's change one labelled step", async () => {
    const session = sessionWith();
    render(<ThemePanel session={session} />);

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Card style" }), "raised");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Heading 2" }), "4xl");

    const theme = session.history.document.getState().theme;
    expect(theme.cards.style).toBe("raised");
    expect(theme.typeScale.h2.size).toBe("4xl");
    expect(labels(session)).toEqual(["Changed card style", "Changed text size for Heading 2"]);
  });

  it("asks before switching the preset, and switches once confirmed (D7)", async () => {
    const session = sessionWith();
    const siteWide = { confirmSiteWide: vi.fn(() => Promise.resolve(true)) };
    render(<ThemePanel session={session} siteWide={siteWide} />);

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Theme" }), "atelier");

    expect(siteWide.confirmSiteWide).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(labels(session)).toEqual(["Changed theme to 'Atelier'"]));
    expect(await screen.findByRole("heading", { name: "Theme: Atelier" })).toBeTruthy();
  });

  it("says when a colour is hard to read with those it's used with (WCAG AA)", async () => {
    const site = starterSite();
    // A pale brand colour: its own text, and the brand as text on the page, both fail.
    site.theme.colors.primary = { l: 0.85, c: 0.08, h: 277 };
    render(<ThemePanel session={sessionWith(site)} />);

    const brand = colourPicker("Brand").closest("[data-field]");
    if (!(brand instanceof HTMLElement)) throw new Error("no Brand row");
    expect(
      within(brand).getByText(/Hard to read with Text on Brand: [\d.]+:1, needs 4.5:1\./),
    ).toBeTruthy();
    expect(
      within(brand).getByText(/Hard to read with Surface: [\d.]+:1, needs 4.5:1\./),
    ).toBeTruthy();
    expect(colourPicker("Accent").closest("[data-field]")?.textContent).not.toMatch(/Hard to read/);
  });

  it("changes a colour from its hex code, once asked", async () => {
    const session = sessionWith();
    const siteWide = { confirmSiteWide: vi.fn(() => Promise.resolve(true)) };
    render(<ThemePanel session={session} siteWide={siteWide} />);

    const hex = screen.getByRole("textbox", { name: "Accent hex code" });
    await userEvent.clear(hex);
    await userEvent.type(hex, "#b45309{Enter}");

    await vi.waitFor(() => expect(labels(session)).toEqual(["Changed accent colour"]));
    expect(siteWide.confirmSiteWide).toHaveBeenCalledWith(
      expect.objectContaining({ action: "Change the Accent colour?" }),
    );
  });
});
