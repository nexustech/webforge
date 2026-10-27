import type { StoreApi } from "zustand/vanilla";
import type { EditorSession } from "../editor/editor-session.js";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";
import type { WindowDialogRegistry } from "../shell/window-dialogs.js";
import type { OwnThemes } from "./own-themes.js";
import type { StudioState } from "./studio/studio-state.js";
import { ThemeStudio } from "./studio/ThemeStudio.js";

/**
 * Adds Theme Studio (2.3b) to the window's dialogs: drawn once, whatever the panels show, so the
 * Theme tab's button and View → Theme Studio… open it from anywhere (#457 review). Returns a
 * function that removes it.
 */
export function registerThemeStudio(
  dialogs: WindowDialogRegistry,
  session: EditorSession,
  studio: StoreApi<StudioState>,
  siteWide?: Pick<SiteWideConfirm, "confirmSiteWide">,
  ownThemes?: OwnThemes,
): () => void {
  function Studio() {
    return (
      <ThemeStudio session={session} studio={studio} siteWide={siteWide} ownThemes={ownThemes} />
    );
  }
  return dialogs.register({ id: "themeStudio", component: Studio });
}
