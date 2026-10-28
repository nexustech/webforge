import { t } from "@webforge/i18n";
import type { PageId } from "@webforge/model";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { EditorSession } from "../editor/editor-session.js";
import { useDocument } from "../editor/use-document.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { CommandRegistry } from "../shell/commands.js";
import type { WindowDialogRegistry } from "../shell/window-dialogs.js";
import { PageSettingsDialog } from "./PageSettingsDialog.js";
import { changePageSettings, type PagesSession } from "./page-actions.js";

/** The page whose settings the window's dialog shows, while it's open. */
type Opened = { readonly open: boolean; readonly pageId: PageId | undefined };

/**
 * *Page Settings…* for the page shown (3.17), in the command palette: the dialog the Pages panel's
 * page menu opens, drawn in the window, so another area can open it too, as Site Check's *Fix* on a
 * page without a description does (`COMMAND_IDS.pageSettings`). Saving is one undo step. Returns a
 * function that removes the command and the dialog.
 */
export function registerPageSettingsCommand(
  commands: CommandRegistry,
  windowDialogs: WindowDialogRegistry,
  session: PagesSession & Pick<EditorSession, "ui">,
): () => void {
  const opened = createStore<Opened>(() => ({ open: false, pageId: undefined }));
  const close = () => opened.setState({ open: false });

  function PageSettings() {
    const { open, pageId } = useStore(opened);
    const site = useDocument(session, (doc) => doc);
    return (
      <PageSettingsDialog
        open={open}
        site={site}
        page={pageId === undefined ? undefined : site.pages[pageId]}
        onSave={(change) => {
          if (pageId !== undefined) changePageSettings(session, pageId, change);
          close();
        }}
        onCancel={close}
      />
    );
  }

  const removeDialog = windowDialogs.register({ id: "pageSettings", component: PageSettings });
  const removeCommand = commands.register({
    id: COMMAND_IDS.pageSettings,
    label: t("pageSettings.open"),
    run: () => opened.setState({ open: true, pageId: session.ui.getState().pageId }),
  });
  return () => {
    removeCommand();
    removeDialog();
  };
}
