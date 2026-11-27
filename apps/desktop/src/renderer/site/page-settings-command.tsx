import { t } from "@webforge/i18n";
import type { PageId } from "@webforge/model";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { EditorSession } from "../editor/editor-session.js";
import { useDocument } from "../editor/use-document.js";
import type { PageSettingsOpener, PageSettingsTab } from "../editor/window-services.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { CommandRegistry } from "../shell/commands.js";
import type { WindowDialogRegistry } from "../shell/window-dialogs.js";
import { PageSettingsDialog } from "./PageSettingsDialog.js";
import { changePageSettings, type PagesSession } from "./page-actions.js";

/** The page whose settings the window's dialog shows, while it's open, and the tab it opens on. */
type Opened = {
  readonly open: boolean;
  readonly pageId: PageId | undefined;
  readonly tab: PageSettingsTab;
};

/** Each window's Page Settings opener, and the dialog's state it opens. */
const openedBy = new WeakMap<PageSettingsOpener, StoreApi<Opened>>();

/**
 * The window's Page Settings opener (#1443), its `PageSettings` service: `show(tab)` opens Page Settings for the page
 * shown, on `tab` (General when left out). The Site area provides it; Site Check and Find use it.
 */
export function createPageSettings(session: Pick<EditorSession, "ui">) {
  const opened = createStore<Opened>(() => ({ open: false, pageId: undefined, tab: "general" }));
  const service: PageSettingsOpener = {
    show: (tab = "general") =>
      opened.setState({ open: true, pageId: session.ui.getState().pageId, tab }),
  };
  openedBy.set(service, opened);
  return service;
}

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
  /** Whether the site has been published: a new file name then keeps the old address (#862). */
  published: () => boolean = () => false,
  /** The window's service, which opens the same dialog on a tab. */
  pageSettings: PageSettingsOpener = createPageSettings(session),
): () => void {
  const made = openedBy.get(pageSettings);
  if (made === undefined) throw new Error("Page Settings' opener wasn't made here");
  const opened: StoreApi<Opened> = made;
  const close = () => opened.setState({ open: false });

  function PageSettingsWindowDialog() {
    const { open, pageId, tab } = useStore(opened);
    // Closed, it follows nothing of the document, which every keystroke on the canvas changes (R9).
    return open ? <OpenPageSettings pageId={pageId} tab={tab} /> : null;
  }

  /** The dialog while it's open, on the site as it is. */
  function OpenPageSettings({
    pageId,
    tab,
  }: {
    readonly pageId: PageId | undefined;
    readonly tab: PageSettingsTab;
  }) {
    const site = useDocument(session, (doc) => doc);
    return (
      <PageSettingsDialog
        open
        site={site}
        page={pageId === undefined ? undefined : site.pages[pageId]}
        initialTab={tab}
        onSave={(change) => {
          if (pageId !== undefined) changePageSettings(session, pageId, change, published());
          close();
        }}
        onCancel={close}
      />
    );
  }

  const removeDialog = windowDialogs.register({
    id: "pageSettings",
    component: PageSettingsWindowDialog,
    close,
  });
  const removeCommand = commands.register({
    id: COMMAND_IDS.pageSettings,
    label: t("pageSettings.open"),
    run: () => pageSettings.show(),
  });
  return () => {
    removeCommand();
    removeDialog();
  };
}
