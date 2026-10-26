import type { EditorSession } from "../editor/editor-session.js";
import { useDocument } from "../editor/use-document.js";
import type { WindowDialogRegistry } from "../shell/window-dialogs.js";
import { OwnThemeDialogs } from "./OwnThemeDialogs.js";
import type { OwnThemes } from "./own-themes.js";

/**
 * My themes for the window (2.23, PH2-17): its dialogs, drawn once whatever the panels show, and
 * the site's theme kept in My themes whenever it changes while it's the person's own, an undo or
 * redo included, so their other sites have it as it is; not one deleted from My themes here, until
 * the site uses another theme. What's still waiting to be kept goes as the window closes (`unload`,
 * the window's own events; main finishes the write before the app exits). Returns a function that
 * removes them.
 */
export function registerOwnThemes(
  dialogs: WindowDialogRegistry,
  session: EditorSession,
  ownThemes: OwnThemes,
  unload: Pick<EventTarget, "addEventListener" | "removeEventListener"> = window,
): () => void {
  function Dialogs() {
    const site = useDocument(session, (doc) => doc.theme);
    return <OwnThemeDialogs ownThemes={ownThemes} site={site} />;
  }
  const removeDialogs = dialogs.register({ id: "ownThemes", component: Dialogs });
  const stopKeeping = session.history.document.subscribe((doc, before) => {
    const theme = doc.theme;
    if (theme === before.theme) return;
    if (theme.own?.id !== before.theme.own?.id) ownThemes.siteThemeIs(theme.own?.id);
    if (theme.own !== undefined) ownThemes.keep({ ...theme, own: theme.own });
  });
  const flush = () => {
    void ownThemes.flush();
  };
  unload.addEventListener("beforeunload", flush);
  return () => {
    unload.removeEventListener("beforeunload", flush);
    flush();
    stopKeeping();
    removeDialogs();
  };
}
