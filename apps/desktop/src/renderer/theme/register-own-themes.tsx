import type { EditorSession } from "../editor/editor-session.js";
import { useDocument } from "../editor/use-document.js";
import type { WindowDialogRegistry } from "../shell/window-dialogs.js";
import { OwnThemeDialogs } from "./OwnThemeDialogs.js";
import type { OwnThemes } from "./own-themes.js";

/**
 * My themes for the window (2.22, PH2-17): its dialogs, drawn once whatever the panels show, and
 * the site's theme kept in My themes whenever it changes while it's the person's own, an undo or
 * redo included, so their other sites have it as it is. Returns a function that removes them.
 */
export function registerOwnThemes(
  dialogs: WindowDialogRegistry,
  session: EditorSession,
  ownThemes: OwnThemes,
): () => void {
  function Dialogs() {
    const site = useDocument(session, (doc) => doc.theme);
    return <OwnThemeDialogs ownThemes={ownThemes} site={site} />;
  }
  const removeDialogs = dialogs.register({ id: "ownThemes", component: Dialogs });
  const stopKeeping = session.history.document.subscribe((doc, before) => {
    const theme = doc.theme;
    if (theme === before.theme || theme.own === undefined) return;
    ownThemes.keep({ ...theme, own: theme.own });
  });
  return () => {
    stopKeeping();
    removeDialogs();
  };
}
