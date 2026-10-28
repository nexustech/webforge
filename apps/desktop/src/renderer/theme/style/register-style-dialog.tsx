import { t } from "@webforge/i18n";
import type { NodeDoc } from "@webforge/model";
import type { ReactNode } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { EditorSession } from "../../editor/editor-session.js";
import { COMMAND_IDS } from "../../shell/command-ids.js";
import type { CommandRegistry } from "../../shell/commands.js";
import { followLayoutLock, type PreferencesStore } from "../../shell/preferences-store.js";
import type { WindowDialogRegistry } from "../../shell/window-dialogs.js";
import { StyleDialog } from "./StyleDialog.js";
import { openStyle, type StyleAsks, styledItem } from "./style-apply.js";
import type { StyleDialogState } from "./style-state.js";

/** What the dialog asks with and draws, where the window has them. */
type StyleDialogOptions = {
  readonly asks?: StyleAsks | undefined;
  readonly itemPreviews?: ((node: NodeDoc, device: "desktop" | "mobile") => ReactNode) | undefined;
};

/**
 * *Style this ‹kind›…* (3.13a, CT-2): the window's dialog, and its command in the Edit menu and the
 * command box, which the Style tab's button, the quick actions and the element menu run. Named for
 * the selected item's kind; off with nothing selected that has a look, with several selected, and
 * in Content mode (M3), which has no Style tab. Returns a function that removes them.
 */
export function registerStyleDialog(
  dialogs: WindowDialogRegistry,
  registry: CommandRegistry,
  session: EditorSession,
  preferences: PreferencesStore,
  state: StoreApi<StyleDialogState>,
  { asks, itemPreviews }: StyleDialogOptions = {},
): () => void {
  function Style() {
    return (
      <StyleDialog
        session={session}
        state={state}
        preferences={preferences}
        asks={asks}
        itemPreviews={itemPreviews}
      />
    );
  }
  let locked = false;
  const update = () => {
    const item = locked ? undefined : styledItem(session);
    registry.update(COMMAND_IDS.styleThis, {
      enabled: item !== undefined,
      label:
        item === undefined
          ? t("style.command.any")
          : t("style.command", { item: item.component.label }),
    });
  };
  const removers = [
    dialogs.register({ id: "styleThis", component: Style }),
    registry.register({
      id: COMMAND_IDS.styleThis,
      label: t("style.command.any"),
      menu: "edit",
      enabled: false,
      run: () => {
        if (locked || styledItem(session) === undefined || state.getState().open) return;
        state.setState({ open: true, since: openStyle(session), scope: "this" });
      },
    }),
    session.ui.subscribe(update),
    session.history.document.subscribe(update),
    followLayoutLock(preferences, (next) => {
      locked = next;
      update();
    }),
  ];
  update();
  return () => {
    for (const remove of removers.toReversed()) remove();
  };
}
