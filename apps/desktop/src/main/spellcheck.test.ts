import type { BrowserWindow, ContextMenuParams, MenuItemConstructorOptions } from "electron";
import { describe, expect, it, vi } from "vitest";
import {
  contextMenuTemplate,
  installContextMenu,
  registerSpellCheckHandlers,
  setSpellCheckLanguage,
  spellCheckAvailable,
  spellCheckLanguageFor,
} from "./spellcheck.js";

const EDIT_FLAGS = {
  canUndo: false,
  canRedo: false,
  canCut: true,
  canCopy: true,
  canPaste: true,
  canDelete: true,
  canSelectAll: true,
  canEditRichly: false,
};

const params = (extra: Partial<ContextMenuParams> = {}) => ({
  misspelledWord: "",
  dictionarySuggestions: [],
  isEditable: true,
  selectionText: "",
  editFlags: EDIT_FLAGS,
  ...extra,
});

/** The menu as labels, separators as "—", disabled items in brackets. */
const labels = (items: MenuItemConstructorOptions[]) =>
  items.map((item) =>
    item.type === "separator" ? "—" : item.enabled === false ? `[${item.label}]` : item.label,
  );

describe("contextMenuTemplate (F-ED-19)", () => {
  it("offers suggestions and Add to Dictionary for a misspelt word, then editing", () => {
    const actions = { replaceMisspelling: vi.fn(), addToDictionary: vi.fn() };

    const items = contextMenuTemplate(
      params({
        misspelledWord: "bakeyr",
        dictionarySuggestions: ["bakery", "baker", "bakers", "bake", "bakes", "baked"],
      }),
      actions,
    );

    expect(labels(items)).toEqual([
      "bakery",
      "baker",
      "bakers",
      "bake",
      "bakes",
      "—",
      "Add to Dictionary",
      "—",
      "Cut",
      "Copy",
      "Paste",
      "—",
      "Select All",
    ]);
    items[0]?.click?.(undefined as never, undefined, undefined as never);
    items[6]?.click?.(undefined as never, undefined, undefined as never);
    expect(actions.replaceMisspelling).toHaveBeenCalledWith("bakery");
    expect(actions.addToDictionary).toHaveBeenCalledWith("bakeyr");
  });

  it("says when there are no suggestions, and disables what can't be done", () => {
    const items = contextMenuTemplate(
      params({
        misspelledWord: "zzxq",
        editFlags: { ...EDIT_FLAGS, canCut: false, canPaste: false },
      }),
      { replaceMisspelling: vi.fn(), addToDictionary: vi.fn() },
    );

    expect(labels(items).slice(0, 6)).toEqual([
      "[No Suggestions]",
      "—",
      "Add to Dictionary",
      "—",
      "[Cut]",
      "Copy",
    ]);
  });

  it("offers Copy on selected text that can't be edited, and nothing elsewhere", () => {
    const actions = { replaceMisspelling: vi.fn(), addToDictionary: vi.fn() };

    expect(
      labels(contextMenuTemplate(params({ isEditable: false, selectionText: "Hours" }), actions)),
    ).toEqual(["Copy"]);
    expect(contextMenuTemplate(params({ isEditable: false, selectionText: " " }), actions)).toEqual(
      [],
    );
  });
});

describe("spell check languages", () => {
  const windows = ["en-GB", "en-US", "fr-FR", "de-DE"];

  it("runs only with the system's own checker: Windows and macOS", () => {
    expect(spellCheckAvailable("win32")).toBe(true);
    expect(spellCheckAvailable("darwin")).toBe(true);
    expect(spellCheckAvailable("linux")).toBe(false);
  });

  it("picks a regional language: the site's, else the system's, else the first one", () => {
    const available = ["en", "en-US", "en-GB", "fr", "fr-FR", "de-DE"];

    expect(spellCheckLanguageFor("en-gb", available)).toBe("en-GB");
    // A bare language takes the system's region when the system speaks it; Windows' own
    // checkers know only regional languages.
    expect(spellCheckLanguageFor("en", available, ["de-AT", "en-GB"])).toBe("en-GB");
    expect(spellCheckLanguageFor("en", available, ["de-DE"])).toBe("en-US");
    expect(spellCheckLanguageFor("fr-CA", available)).toBe("fr-FR");
    expect(spellCheckLanguageFor("ja", available)).toBeUndefined();
  });

  it("sets the site's language on Windows only, keeping the current one when there is none", () => {
    const session = { availableSpellCheckerLanguages: windows, setSpellCheckerLanguages: vi.fn() };

    setSpellCheckLanguage(session, "de", "win32", ["de-CH"]);
    setSpellCheckLanguage(session, "ja", "win32");
    setSpellCheckLanguage(session, "fr", "darwin");

    expect(session.setSpellCheckerLanguages.mock.calls).toEqual([[["de-DE"]]]);
  });

  it("serves the renderer's request through IPC, from the app's own page only", async () => {
    const handlers = new Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>();
    const ipc = {
      handle: vi.fn((channel: string, handler: never) => handlers.set(channel, handler)),
    };
    const session = {
      availableSpellCheckerLanguages: windows,
      setSpellCheckerLanguages: vi.fn(),
      setSpellCheckerDictionaryDownloadURL: vi.fn(),
    };
    registerSpellCheckHandlers(ipc, (url) => url === "app://index.html", session, "win32");
    // Dictionaries are never downloaded: the system's own checkers only.
    expect(session.setSpellCheckerDictionaryDownloadURL).toHaveBeenCalledWith(
      "http://127.0.0.1:9/",
    );
    const handler = handlers.get("app:set-spellcheck-language");

    await expect(handler?.({ senderFrame: { url: "app://index.html" } }, "fr")).resolves.toBeNull();
    await expect(
      handler?.({ senderFrame: { url: "https://evil.example" } }, "de"),
    ).rejects.toThrow();
    await expect(
      handler?.({ senderFrame: { url: "app://index.html" } }, "not a tag"),
    ).rejects.toThrow();

    expect(session.setSpellCheckerLanguages.mock.calls).toEqual([[["fr-FR"]]]);
  });
});

describe("installContextMenu", () => {
  it("pops the menu up on right-clicks that have something to offer", () => {
    let onContextMenu: ((event: unknown, params: ContextMenuParams) => void) | undefined;
    const contents = {
      on: vi.fn((_name: string, listener: typeof onContextMenu) => {
        onContextMenu = listener;
      }),
      replaceMisspelling: vi.fn(),
      session: { addWordToSpellCheckerDictionary: vi.fn() },
    };
    const window = { webContents: contents } as unknown as BrowserWindow;
    const popup = vi.fn();
    const buildMenu = vi.fn(() => ({ popup }));
    installContextMenu(window, buildMenu);

    onContextMenu?.({}, params({ isEditable: false }) as ContextMenuParams);
    expect(buildMenu).not.toHaveBeenCalled();

    onContextMenu?.(
      {},
      params({ misspelledWord: "teh", dictionarySuggestions: ["the"] }) as ContextMenuParams,
    );
    expect(popup).toHaveBeenCalledWith({ window });
    const [template] = buildMenu.mock.calls[0] as unknown as [MenuItemConstructorOptions[]];
    template[0]?.click?.(undefined as never, undefined, undefined as never);
    template[2]?.click?.(undefined as never, undefined, undefined as never);
    expect(contents.replaceMisspelling).toHaveBeenCalledWith("the");
    expect(contents.session.addWordToSpellCheckerDictionary).toHaveBeenCalledWith("teh");
  });
});
