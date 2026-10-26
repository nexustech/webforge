// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_THEME, themeIdSchema } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OwnTheme, ThemesApi } from "../../shared/ipc/themes.js";
import { createWindowDialogs, WindowDialogs } from "../shell/window-dialogs.js";
import { sessionWith } from "../testing/fixtures.js";
import { createOwnThemes } from "./own-themes.js";
import { ownThemeList } from "./own-themes-list.js";
import { registerOwnThemes } from "./register-own-themes.js";
import { setColor } from "./theme-edits.js";

afterEach(cleanup);

/** One of the person's own themes, `name`d, with id `theme000000000<n>`. */
const own = (n: number, name: string): OwnTheme => ({
  ...structuredClone(DEFAULT_THEME),
  own: { id: themeIdSchema.parse(`theme000000000${n}`), name },
});

/** `window.webforge.themes` as a fake that lists `listed`. */
function fakeApi(listed: OwnTheme[] = []) {
  return {
    list: vi.fn(() => Promise.resolve(listed)),
    keep: vi.fn(() => Promise.resolve(null)),
    remove: vi.fn(() => Promise.resolve(null)),
  } satisfies ThemesApi;
}

describe("My themes (2.23)", () => {
  it("lists, keeps and removes the person's own themes, most recent first", async () => {
    const api = fakeApi([own(1, "Bakery"), own(2, "Shop")]);
    const themes = createOwnThemes(() => api);
    await themes.refresh();
    expect(themes.store.getState().themes.map((each) => each.own.name)).toEqual(["Bakery", "Shop"]);

    themes.keep(own(2, "Corner shop"));
    themes.remove(themeIdSchema.parse("theme0000000001"));

    expect(themes.store.getState().themes.map((each) => each.own.name)).toEqual(["Corner shop"]);
    expect(api.keep).toHaveBeenCalledWith(own(2, "Corner shop"));
    expect(api.remove).toHaveBeenCalledWith("theme0000000001");
  });

  it("keeps its list when My themes can't be read", async () => {
    const themes = createOwnThemes(() => ({
      ...fakeApi(),
      list: () => Promise.reject(new Error()),
    }));
    await themes.refresh();
    expect(themes.store.getState().themes).toEqual([]);
  });

  it("asks one question at a time: asking again cancels the one open", async () => {
    const themes = createOwnThemes(() => fakeApi());
    const first = themes.askName({ title: "A", initial: "a", confirm: "OK" });
    const second = themes.confirmDelete("Shop", false);
    expect(themes.store.getState().question).toEqual({
      kind: "delete",
      name: "Shop",
      inUse: false,
    });
    themes.answer(true);

    expect(await first).toBeUndefined();
    expect(await second).toBe(true);
    expect(themes.store.getState().question).toBeNull();
  });

  it("lists the site's own theme first when this computer doesn't have it", () => {
    const library = [own(1, "Bakery")];
    expect(ownThemeList(library, DEFAULT_THEME)).toBe(library);
    // The site's copy is the latest of it.
    expect(ownThemeList(library, own(1, "Bakery, renamed")).map((each) => each.own.name)).toEqual([
      "Bakery, renamed",
    ]);
    expect(
      ownThemeList(library, own(3, "From another computer")).map((each) => each.own.name),
    ).toEqual(["From another computer", "Bakery"]);
  });

  it("keeps the site's theme whenever it changes while it's the person's own, undo included", async () => {
    const api = fakeApi();
    const themes = createOwnThemes(() => api);
    const session = sessionWith();
    const dialogs = createWindowDialogs();
    const remove = registerOwnThemes(dialogs, session, themes);
    render(<WindowDialogs registry={dialogs} />);

    // The first change to the built-in theme asks for a name, in the window's dialog.
    const changed = setColor(session, { names: themes }, "primary", { l: 0.5, c: 0.2, h: 30 });
    const dialog = await screen.findByRole("dialog", { name: "Save your own version of 'Light'?" });
    const name = within(dialog).getByRole("textbox", { name: "Theme name" });
    expect((name as HTMLInputElement).value).toBe("Light (my version)");
    await userEvent.clear(name);
    await userEvent.type(name, "Bakery");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save Theme" }));
    expect(await changed).toBe(true);

    expect(api.keep).toHaveBeenCalledTimes(1);
    expect(api.keep).toHaveBeenLastCalledWith(
      expect.objectContaining({ own: { id: expect.any(String), name: "Bakery" } }),
    );
    // Undoing to the built-in theme keeps nothing; redoing keeps it again.
    act(() => {
      session.history.undo();
    });
    expect(api.keep).toHaveBeenCalledTimes(1);
    act(() => {
      session.history.redo();
    });
    await waitFor(() => expect(api.keep).toHaveBeenCalledTimes(2));

    remove();
    act(() => {
      session.history.undo();
      session.history.redo();
    });
    expect(api.keep).toHaveBeenCalledTimes(2);
  });
});
