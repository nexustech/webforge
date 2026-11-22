// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { t } from "@webforge/i18n";
import { DEFAULT_THEME, themeIdSchema } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "../../shared/ipc/prefs.js";
import { starterSite } from "../../shared/starter-site.js";
import { themePreviewOf } from "../editor/theme-preview.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { registriesForTest, sessionWith } from "../testing/fixtures.js";
import { createOwnThemes } from "./own-themes.js";
import { registerThemePanel } from "./register-theme-panel.js";
import { createStudio } from "./studio/studio-state.js";
import { ThemePanel } from "./ThemePanel.js";

afterEach(cleanup);

/** A colour's picker (5.26): its swatch button, named by the colour. */
const colourPicker = (name: string) => screen.getByRole("button", { name });

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
    render(<ThemePanel session={sessionWith()} advanced />);

    expect(screen.getByRole("heading", { name: "Theme: Light" })).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "Theme" }) as HTMLSelectElement).value).toBe(
      "light",
    );
    for (const colour of ["Brand", "Accent", "Second accent", "Surface", "Text"]) {
      expect(colourPicker(colour)).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Headings Inter" })).toBeTruthy();
    // The accent font (3.22), beside the other two.
    expect(screen.getByRole("button", { name: "Accent Inter" })).toBeTruthy();
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
    // A name no preset has (2.13c added a Harbour), as a site from a newer Webforge may have.
    site.theme.preset = "from-a-newer-webforge";
    render(<ThemePanel session={sessionWith(site)} />);

    const preset = screen.getByRole("combobox", { name: "Theme" }) as HTMLSelectElement;
    expect(preset.value).toBe("from-a-newer-webforge");
    expect(screen.getByRole("heading", { name: "Theme: from-a-newer-webforge" })).toBeTruthy();
  });

  it("makes a token's change one labelled step", async () => {
    const session = sessionWith();
    render(<ThemePanel session={session} advanced />);

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

  it("says when a colour is hard to read with those it's used with, in words, the ratio in Advanced mode (WCAG AA, #1174)", () => {
    const site = starterSite();
    // A pale brand colour: its own text, and the brand as text on the page, both fail.
    site.theme.colors.primary = { l: 0.85, c: 0.08, h: 277 };
    const { unmount } = render(<ThemePanel session={sessionWith(site)} />);

    const row = (name: string) => {
      const found = colourPicker(name).closest("[data-field]");
      if (!(found instanceof HTMLElement)) throw new Error(`no ${name} row`);
      return found;
    };
    // As Site Check's row says it.
    expect(within(row("Brand")).getByText("Text on Brand is hard to read on Brand")).toBeTruthy();
    expect(within(row("Brand")).getByText("Brand is hard to read on Surface")).toBeTruthy();
    expect(row("Accent").textContent).not.toMatch(/hard to read/);
    unmount();

    render(<ThemePanel session={sessionWith(site)} advanced />);
    expect(
      within(row("Brand")).getByText(/^Brand is hard to read on Surface: [\d.]+:1, needs 4\.5:1$/),
    ).toBeTruthy();
  });

  it("offers a shade that reads beside a colour that doesn't, which takes the warnings away in one step (#1174)", async () => {
    const site = starterSite();
    site.theme.colors.primary = { l: 0.85, c: 0.08, h: 277 };
    const session = sessionWith(site);
    render(<ThemePanel session={session} />);

    await userEvent.click(screen.getByRole("button", { name: "Use a darker shade" }));

    await vi.waitFor(() => expect(labels(session)).toEqual(["Changed brand colour"]));
    const brand = session.history.document.getState().theme.colors.primary;
    // Its own hue and chroma, as close as a screen shows them.
    expect(brand.c).toBeCloseTo(0.08, 2);
    expect(Math.abs(brand.h - 277)).toBeLessThan(1);
    expect(brand.l).toBeLessThan(0.85);
    expect(screen.queryByText(/hard to read/)).toBeNull();
    expect(screen.queryByRole("button", { name: /shade/ })).toBeNull();
  });

  it("shows no codes in Simple mode: no hex codes, and one text size for the site (LF-16)", async () => {
    const session = sessionWith();
    const { container } = render(<ThemePanel session={session} />);

    expect(screen.queryByRole("textbox", { name: /hex code/ })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Heading 1" })).toBeNull();
    // None shown: a colour's swatch tells a screen reader its code, out of sight.
    const shown = container.cloneNode(true) as HTMLElement;
    for (const hidden of shown.querySelectorAll(".sr-only")) hidden.remove();
    expect(shown.textContent).not.toMatch(/#[0-9a-f]{6}|\d\s?px\b/i);
    const size = screen.getByRole("combobox", { name: "Text size" }) as HTMLSelectElement;
    expect([...size.options].map((option) => option.text)).toEqual([
      "Smaller",
      "Standard",
      "Larger",
    ]);
    expect(size.value).toBe("standard");

    await userEvent.selectOptions(size, "larger");

    const scale = session.history.document.getState().theme.typeScale;
    // Every style a size larger than the theme has it.
    expect([scale.h1.size, scale.h2.size, scale.body.size, scale.small.size]).toEqual([
      "6xl",
      "4xl",
      "xl",
      "base",
    ]);
    expect(labels(session)).toEqual(["Changed text size"]);
    expect(size.value).toBe("larger");
  });

  it("says Your own for sizes set one by one, in Theme Studio or Advanced mode (LF-16)", () => {
    const site = starterSite();
    site.theme.typeScale.h2.size = "4xl";
    render(<ThemePanel session={sessionWith(site)} />);

    const size = screen.getByRole("combobox", { name: "Text size" }) as HTMLSelectElement;
    expect(size.value).toBe("own");
    expect(size.selectedOptions[0]?.text).toBe("Your own");
  });

  it("changes a colour from its hex code at once in Advanced mode, asking nothing (LF-15)", async () => {
    const session = sessionWith();
    const siteWide = { confirmSiteWide: vi.fn(() => Promise.resolve(true)) };
    render(<ThemePanel session={session} siteWide={siteWide} advanced />);

    const hex = screen.getByRole("textbox", { name: "Accent hex code" });
    await userEvent.clear(hex);
    await userEvent.type(hex, "#b45309{Enter}");

    await vi.waitFor(() => expect(labels(session)).toEqual(["Changed accent colour"]));
    expect(siteWide.confirmSiteWide).not.toHaveBeenCalled();
  });

  it("shows a colour while it's dragged, then makes it one step as the picker closes (5.30)", async () => {
    const session = sessionWith();
    const user = userEvent.setup({ delay: null });
    render(<ThemePanel session={session} />);
    const previews = themePreviewOf(session);
    const before = session.history.document.getState().theme.colors.primary;

    await user.click(colourPicker("Brand"));
    screen.getByRole("slider", { name: "Hue" }).focus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    // Shown, not changed: the theme as it would be, and no step yet.
    const shown = previews.getState().preview;
    expect(shown?.chosen).toBe(false);
    expect(shown?.theme.colors.primary).not.toEqual(before);
    expect(session.history.document.getState().theme.colors.primary).toEqual(before);
    expect(labels(session)).toEqual([]);

    await user.click(colourPicker("Brand"));
    await vi.waitFor(() => expect(labels(session)).toEqual(["Changed brand colour"]));
    expect(session.history.document.getState().theme.colors.primary).toEqual(
      shown?.theme.colors.primary,
    );
    expect(previews.getState().preview?.chosen).toBe(true);
  });

  it("leaves the theme as it was when the picker is closed with Escape, with no step (5.30)", async () => {
    const session = sessionWith();
    const user = userEvent.setup({ delay: null });
    render(<ThemePanel session={session} />);
    const before = session.history.document.getState();

    await user.click(colourPicker("Accent"));
    screen.getByRole("slider", { name: "Hue" }).focus();
    await user.keyboard("{End}");
    expect(themePreviewOf(session).getState().preview).toBeDefined();
    await user.keyboard("{Escape}");

    expect(themePreviewOf(session).getState().preview).toBeUndefined();
    expect(session.history.document.getState()).toBe(before);
    expect(labels(session)).toEqual([]);
  });
});

describe("the Theme tab's own themes (2.23, PH2-17)", () => {
  it("lists the person's own themes first, and saves one without asking at a built-in one's first change (LF-15)", async () => {
    const session = sessionWith();
    const night = {
      ...structuredClone(DEFAULT_THEME),
      own: { id: themeIdSchema.parse("theme0000000000n"), name: "Night" },
    };
    const ownThemes = createOwnThemes(() => ({
      list: () => Promise.resolve([night]),
      keep: () => Promise.resolve("kept" as const),
      remove: () => Promise.resolve(null),
    }));
    const askName = vi.spyOn(ownThemes, "askName");
    render(<ThemePanel session={session} ownThemes={ownThemes} />);

    const preset = screen.getByRole("combobox", { name: "Theme" }) as HTMLSelectElement;
    await vi.waitFor(() => expect(preset.options[0]?.textContent).toBe("Night"));
    expect(preset.options[1]?.textContent).toBe("Light");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Card style" }), "raised");
    await vi.waitFor(() => expect(labels(session)).toEqual(["Changed card style"]));
    expect(askName).not.toHaveBeenCalled();
    expect(session.history.document.getState().theme.own?.name).toBe("Light (yours)");
    expect(screen.getByRole("heading", { name: /Light \(yours\)/ })).toBeDefined();
  });
});

describe("the Theme tab's reveal (3.12, CT-3)", () => {
  it("scrolls to the field a request names and focuses it, once drawn", () => {
    const { panels } = registriesForTest();
    const remove = registerThemePanel(panels, sessionWith());
    const Theme = panels.list()[0]?.component;
    if (Theme === undefined) throw new Error("not registered");
    // Asked for before the tab is drawn, as the Edit panel's provenance does.
    panels.show("theme", "token.shadow");
    render(<Theme />);

    const row = document.querySelector('[data-field="token.shadow"]');
    expect(row?.contains(document.activeElement)).toBe(true);
    remove();
  });

  it("reveals Simple mode's Text size for a text style's size, and the style's own in Advanced", () => {
    const { panels } = registriesForTest();
    const remove = registerThemePanel(panels, sessionWith());
    const Theme = panels.list()[0]?.component;
    if (Theme === undefined) throw new Error("not registered");
    // As the Edit panel's "Theme's: Heading 2" asks (provenance), in Simple mode (LF-16).
    panels.show("theme", "textSize.h2");
    const { unmount } = render(<Theme />);
    expect(
      document.querySelector('[data-field="textScale"]')?.contains(document.activeElement),
    ).toBe(true);
    unmount();
    remove();

    const advanced = createPreferencesStore({
      preferences: { ...DEFAULT_PREFERENCES, editorLevel: "advanced" },
    });
    const removeAdvanced = registerThemePanel(
      panels,
      sessionWith(),
      undefined,
      undefined,
      undefined,
      undefined,
      advanced,
    );
    const InMode = panels.list()[0]?.component;
    if (InMode === undefined) throw new Error("not registered");
    panels.show("theme", "textSize.h2");
    render(<InMode />);
    expect(
      document.querySelector('[data-field="textSize.h2"]')?.contains(document.activeElement),
    ).toBe(true);
    removeAdvanced();
  });

  it("opens Theme Studio's Components at a kind's look", () => {
    const { panels } = registriesForTest();
    const studio = createStudio();
    const remove = registerThemePanel(panels, sessionWith(), undefined, studio);

    panels.show("theme", "look:Button");

    expect(studio.getState()).toMatchObject({
      open: true,
      section: "components",
      kind: "Button",
    });
    // Another kind's changes not applied yet come first, with the question about them (4.10).
    studio.setState({ draft: { type: "Hero", item: "Hero", change: { lookShadow: "large" } } });
    panels.show("theme", "look:Button");
    expect(studio.getState()).toMatchObject({ kind: "Hero", pending: { kind: "Button" } });
    // A draft that changes nothing any more asks nothing.
    studio.setState({
      kind: "Hero",
      pending: undefined,
      draft: { type: "Hero", item: "Hero", change: { lookShadow: undefined } },
    });
    panels.show("theme", "look:Button");
    expect(studio.getState()).toMatchObject({ kind: "Button", pending: undefined });
    remove();
    // Removed, it no longer listens.
    studio.setState({ open: false });
    panels.show("theme", "look:Hero");
    expect(studio.getState().open).toBe(false);
  });
});
