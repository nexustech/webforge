import { t } from "@webforge/i18n";
import type { NodeDoc } from "@webforge/model";
import type { ReactNode } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { EditorSession } from "../../editor/editor-session.js";
import type { ItemCssServices } from "../../editor/ItemCssView.js";
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
  /** The worker and clipboard for the *CSS* tab in Advanced mode (3.14); no tab without them. */
  readonly itemCss?: Omit<ItemCssServices, "onOpenCustomCode"> | undefined;
};

/**
 * *Style this ‹kind›…* (3.13a, CT-2): the window's dialog, and its command in the Edit menu and the
 * command box, which the Style tab's button, the quick actions and the element menu run. Named for
 * the selected item's kind; off with nothing selected that has a look, with several selected, and
 * in Content mode (M3), which has no Style tab. While it's open it holds others' changes to the
 * site (AI apps', F-AI-1), so its steps are all its own. Returns a function that removes them.
 */
export function registerStyleDialog(
  dialogs: WindowDialogRegistry,
  registry: CommandRegistry,
  session: EditorSession,
  preferences: PreferencesStore,
  state: StoreApi<StyleDialogState>,
  { asks, itemPreviews, itemCss }: StyleDialogOptions = {},
): () => void {
  // The CSS tab points at Custom Code (3.14), through its command.
  const css: ItemCssServices | undefined =
    itemCss === undefined
      ? undefined
      : { ...itemCss, onOpenCustomCode: () => void registry.run(COMMAND_IDS.customCode) };
  function Style() {
    return (
      <StyleDialog
        session={session}
        state={state}
        preferences={preferences}
        asks={asks}
        itemPreviews={itemPreviews}
        itemCss={css}
      />
    );
  }
  let locked = false;
  // What the command was last set to: set again only when that changes, not on every keystroke.
  let last = "";
  const update = () => {
    // Named for the kind in Content mode too, as Apply Look's commands are, and off there.
    const item = styledItem(session);
    const enabled = !locked && item !== undefined;
    const label =
      item === undefined
        ? t("style.command.any")
        : t("style.command", { item: item.component.label });
    if (`${enabled}:${label}` === last) return;
    last = `${enabled}:${label}`;
    registry.update(COMMAND_IDS.styleThis, { enabled, label });
  };
  // While it's open, nothing but the person changes the site (AI apps wait, F-AI-1): every step
  // since it opened is its own, to merge or take back.
  let release: (() => void) | undefined;
  const follow = ({ open }: StyleDialogState) => {
    if (open && release === undefined) release = session.hold();
    if (!open && release !== undefined) {
      release();
      release = undefined;
    }
  };
  const removers = [
    state.subscribe(follow),
    () => follow({ ...state.getState(), open: false }),
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
