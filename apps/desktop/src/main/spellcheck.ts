import { t } from "@webforge/i18n";
import type {
  BrowserWindow,
  ContextMenuParams,
  IpcMain,
  MenuItemConstructorOptions,
  Session,
  WebContents,
} from "electron";
import { registerIpcHandler } from "./ipc.js";

/**
 * Spell check while editing text (F-ED-19, G5). Windows and macOS use their own system checkers,
 * so no dictionary is downloaded. On Windows the checker follows the site's language (Site
 * Settings); macOS picks languages itself and Electron can't set them there. Linux would download
 * Hunspell dictionaries from Google's servers, so spell check stays off there.
 */

/** Whether spell check runs on `platform`: with the system's checker, never a downloaded one. */
export const spellCheckAvailable = (platform: NodeJS.Platform) =>
  platform === "win32" || platform === "darwin";

/** How many suggestions the menu offers, as most editors do. */
const MAX_SUGGESTIONS = 5;

/** What the context menu does; the window wiring passes the real Electron calls. */
export type ContextMenuActions = {
  replaceMisspelling(word: string): void;
  addToDictionary(word: string): void;
};

/** The parts of Electron's context-menu parameters the menu uses. */
type MenuParams = Pick<
  ContextMenuParams,
  "misspelledWord" | "dictionarySuggestions" | "isEditable" | "selectionText" | "editFlags"
>;

/**
 * The context menu for a right-click in the window: for a misspelt word, its suggestions and Add to
 * Dictionary; in editable text, Cut, Copy, Paste and Select All; on selected text elsewhere, Copy.
 * Empty when there is nothing to offer (the page may have a menu of its own there).
 */
export function contextMenuTemplate(
  params: MenuParams,
  actions: ContextMenuActions,
): MenuItemConstructorOptions[] {
  const items: MenuItemConstructorOptions[] = [];
  const word = params.misspelledWord;
  if (word !== "") {
    const suggestions = params.dictionarySuggestions.slice(0, MAX_SUGGESTIONS);
    items.push(
      ...(suggestions.length === 0
        ? [{ label: t("spellcheck.noSuggestions"), enabled: false }]
        : suggestions.map((suggestion) => ({
            label: suggestion,
            click: () => actions.replaceMisspelling(suggestion),
          }))),
      { type: "separator" },
      { label: t("spellcheck.addToDictionary"), click: () => actions.addToDictionary(word) },
    );
  }
  const { canCut, canCopy, canPaste, canSelectAll } = params.editFlags;
  if (params.isEditable) {
    if (items.length > 0) items.push({ type: "separator" });
    items.push(
      { role: "cut", label: t("edit.cut"), enabled: canCut },
      { role: "copy", label: t("edit.copy"), enabled: canCopy },
      { role: "paste", label: t("edit.paste"), enabled: canPaste },
      { type: "separator" },
      { role: "selectAll", label: t("edit.selectAll"), enabled: canSelectAll },
    );
  } else if (params.selectionText.trim() !== "") {
    if (items.length > 0) items.push({ type: "separator" });
    items.push({ role: "copy", label: t("edit.copy"), enabled: canCopy });
  }
  return items;
}

/**
 * The checker language for a site language: the same tag (`en-GB`), else the first one of the same
 * language (`en` → `en-US`), else none. Matching ignores case, as Windows reports `en-GB`.
 */
export function spellCheckLanguageFor(
  siteLanguage: string,
  available: readonly string[],
): string | undefined {
  const wanted = siteLanguage.toLowerCase();
  const base = wanted.split("-")[0] ?? wanted;
  return (
    available.find((language) => language.toLowerCase() === wanted) ??
    available.find((language) => language.toLowerCase().split("-")[0] === base)
  );
}

/**
 * Sets the window's spell checker to the site's language, on Windows only: macOS chooses for
 * itself. A language the system has no checker for leaves the current one.
 */
export function setSpellCheckLanguage(
  session: Pick<Session, "availableSpellCheckerLanguages" | "setSpellCheckerLanguages">,
  siteLanguage: string,
  platform: NodeJS.Platform,
): void {
  if (platform !== "win32") {
    return;
  }
  const language = spellCheckLanguageFor(siteLanguage, session.availableSpellCheckerLanguages);
  if (language !== undefined) {
    session.setSpellCheckerLanguages([language]);
  }
}

/** Shows the context menu ({@link contextMenuTemplate}) on right-clicks in `window`. */
export function installContextMenu(
  window: BrowserWindow,
  buildMenu: (template: MenuItemConstructorOptions[]) => {
    popup(options: { window: BrowserWindow }): void;
  },
): void {
  const contents: WebContents = window.webContents;
  contents.on("context-menu", (_event, params) => {
    const template = contextMenuTemplate(params, {
      replaceMisspelling: (word) => contents.replaceMisspelling(word),
      addToDictionary: (word) => contents.session.addWordToSpellCheckerDictionary(word),
    });
    if (template.length > 0) {
      buildMenu(template).popup({ window });
    }
  });
}

/**
 * Where Electron would fetch Hunspell dictionaries: a local port nothing listens on. On Windows,
 * a language the system checker lacks would otherwise be downloaded from Google's servers; this
 * way the download fails and only the system's own checkers are used.
 */
const NO_DICTIONARY_DOWNLOADS = "http://127.0.0.1:9/";

/**
 * Serves `app:set-spellcheck-language` for the editor's session, and stops that session from ever
 * downloading dictionaries (see {@link NO_DICTIONARY_DOWNLOADS}).
 */
export function registerSpellCheckHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  session: Pick<
    Session,
    | "availableSpellCheckerLanguages"
    | "setSpellCheckerLanguages"
    | "setSpellCheckerDictionaryDownloadURL"
  >,
  platform: NodeJS.Platform,
): void {
  session.setSpellCheckerDictionaryDownloadURL(NO_DICTIONARY_DOWNLOADS);
  registerIpcHandler(ipc, "setSpellCheckLanguage", isTrustedSender, (language) => {
    setSpellCheckLanguage(session, language, platform);
    return null;
  });
}
