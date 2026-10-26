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
import { setColor, switchPreset } from "./theme-edits.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** One of the person's own themes, `name`d, with id `theme000000000<n>`. */
const own = (n: number | string, name: string): OwnTheme => ({
  ...structuredClone(DEFAULT_THEME),
  own: { id: themeIdSchema.parse(`theme000000000${n}`), name },
});

/** `window.webforge.themes` as a fake that lists `listed`. */
function fakeApi(listed: OwnTheme[] = []) {
  return {
    list: vi.fn(() => Promise.resolve(listed)),
    keep: vi.fn((_theme: OwnTheme) => Promise.resolve<"kept" | "full">("kept")),
    remove: vi.fn((_id: string) => Promise.resolve(null)),
  } satisfies ThemesApi;
}

const names = (themes: readonly OwnTheme[]) => themes.map((each) => each.own.name);

describe("My themes (2.23)", () => {
  it("lists, keeps and removes the person's own themes, most recent first", async () => {
    const api = fakeApi([own(1, "Bakery"), own(2, "Shop")]);
    const themes = createOwnThemes(() => api);
    await themes.refresh();
    expect(names(themes.store.getState().themes)).toEqual(["Bakery", "Shop"]);

    themes.keep(own(2, "Corner shop"));
    themes.remove(themeIdSchema.parse("theme0000000001"));
    await themes.flush();

    expect(names(themes.store.getState().themes)).toEqual(["Corner shop"]);
    expect(api.keep).toHaveBeenCalledWith(own(2, "Corner shop"));
    expect(api.remove).toHaveBeenCalledWith("theme0000000001");
  });

  it("keeps a run of changes to a theme as one write, after the last (#500 review)", async () => {
    vi.useFakeTimers();
    const api = fakeApi();
    const themes = createOwnThemes(() => api);

    themes.keep(own(1, "Bakery"));
    themes.keep(own(1, "Bakery, warmer"));
    themes.keep(own(1, "Bakery, warmest"));
    // Listed as it is at once; written once, after a pause.
    expect(names(themes.store.getState().themes)).toEqual(["Bakery, warmest"]);
    expect(api.keep).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);

    expect(api.keep).toHaveBeenCalledOnce();
    expect(api.keep).toHaveBeenCalledWith(own(1, "Bakery, warmest"));
  });

  it("drops a list read before a change, and lists a change still waiting to be kept", async () => {
    let answer: (themes: OwnTheme[]) => void = () => undefined;
    const api = {
      ...fakeApi(),
      list: vi.fn(
        () =>
          new Promise<OwnTheme[]>((resolve) => {
            answer = resolve;
          }),
      ),
    };
    const themes = createOwnThemes(() => api, { delayMs: 60_000 });

    const stale = themes.refresh();
    themes.keep(own(1, "Bakery"));
    answer([own(2, "Shop")]);
    await stale;
    expect(names(themes.store.getState().themes)).toEqual(["Bakery"]);

    // A list read after it comes with the change in front, until it's kept.
    const fresh = themes.refresh();
    answer([own(2, "Shop")]);
    await fresh;
    expect(names(themes.store.getState().themes)).toEqual(["Bakery", "Shop"]);
  });

  it("says when a theme couldn't be kept or removed, or My themes is full, and reads the list again", async () => {
    const notify = vi.fn();
    const api = fakeApi([own(2, "Shop")]);
    const themes = createOwnThemes(() => api, { notify });
    const listed = () => names(themes.store.getState().themes);

    api.keep.mockRejectedValueOnce(new Error("disk"));
    themes.keep(own(1, "Bakery"));
    await themes.flush();
    expect(notify).toHaveBeenLastCalledWith(expect.stringContaining("'Bakery' couldn't be saved"));
    await waitFor(() => expect(listed()).toEqual(["Shop"]));

    api.keep.mockResolvedValueOnce("full");
    themes.keep(own(3, "One too many"));
    await themes.flush();
    expect(notify).toHaveBeenLastCalledWith(expect.stringContaining("My themes is full"));
    await waitFor(() => expect(listed()).toEqual(["Shop"]));

    api.remove.mockRejectedValueOnce(new Error("disk"));
    themes.remove(themeIdSchema.parse("theme0000000002"));
    await waitFor(() =>
      expect(notify).toHaveBeenLastCalledWith(expect.stringContaining("couldn't be removed")),
    );
    await waitFor(() => expect(listed()).toEqual(["Shop"]));
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

  it("lists the site's own theme first when this computer doesn't have it, as the site has it", () => {
    const library = [own(1, "Bakery")];
    expect(ownThemeList(library, DEFAULT_THEME)).toBe(library);
    // The site's copy is the latest of it.
    expect(names(ownThemeList(library, own(1, "Bakery, renamed")))).toEqual(["Bakery, renamed"]);
    expect(names(ownThemeList(library, own(3, "From another computer")))).toEqual([
      "From another computer",
      "Bakery",
    ]);
    // Not one deleted from My themes in this window.
    expect(ownThemeList(library, own(3, "Deleted"), ["theme0000000003"])).toBe(library);
  });

  it("keeps the site's theme whenever it changes while it's the person's own, undo included", async () => {
    const api = fakeApi();
    const themes = createOwnThemes(() => api, { delayMs: 0 });
    const session = sessionWith();
    const dialogs = createWindowDialogs();
    const remove = registerOwnThemes(dialogs, session, themes, new EventTarget());
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

    await waitFor(() => expect(api.keep).toHaveBeenCalledTimes(1));
    expect(api.keep).toHaveBeenLastCalledWith(
      expect.objectContaining({ own: { id: expect.any(String), name: "Bakery" } }),
    );
    // Undoing to the built-in theme keeps nothing; redoing keeps it again.
    act(() => {
      session.history.undo();
    });
    act(() => {
      session.history.redo();
    });
    await waitFor(() => expect(api.keep).toHaveBeenCalledTimes(2));

    remove();
    act(() => {
      session.history.undo();
      session.history.redo();
    });
    await themes.flush();
    expect(api.keep).toHaveBeenCalledTimes(2);
  });

  it("sends what's waiting as the window closes", async () => {
    const api = fakeApi();
    const themes = createOwnThemes(() => api, { delayMs: 60_000 });
    const unload = new EventTarget();
    registerOwnThemes(createWindowDialogs(), sessionWith(), themes, unload);

    themes.keep(own(1, "Bakery"));
    expect(api.keep).not.toHaveBeenCalled();
    unload.dispatchEvent(new Event("beforeunload"));

    await waitFor(() => expect(api.keep).toHaveBeenCalledWith(own(1, "Bakery")));
  });

  it("deletes the theme the site uses for good, until the site uses another (#500 review)", async () => {
    const api = fakeApi();
    const themes = createOwnThemes(() => api, { delayMs: 0 });
    const session = sessionWith();
    registerOwnThemes(createWindowDialogs(), session, themes, new EventTarget());
    const night = own(1, "Night");
    await switchPreset(session, undefined, night);
    await waitFor(() => expect(api.keep).toHaveBeenCalledTimes(1));

    themes.remove(night.own.id);
    const site = () => session.history.document.getState().theme;
    const { themes: library, deleted } = themes.store.getState();
    expect(ownThemeList(library, site(), deleted)).toEqual([]);
    // A change to the site's theme, its undo and redo, don't bring it back.
    await setColor(session, undefined, "primary", { l: 0.5, c: 0.2, h: 30 });
    act(() => {
      session.history.undo();
      session.history.redo();
    });
    await themes.flush();
    expect(api.keep).toHaveBeenCalledTimes(1);

    // Once the site uses another theme, the deleted one is forgotten: coming back keeps it again.
    await switchPreset(session, undefined, own(2, "Day"));
    act(() => {
      session.history.undo();
    });
    await waitFor(() =>
      expect(api.keep).toHaveBeenLastCalledWith(expect.objectContaining({ own: night.own })),
    );
  });
});
