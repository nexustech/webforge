import { t } from "@webforge/i18n";
import type { ClipboardApi } from "../../shared/ipc/clipboard.js";
import type { SharedPlace } from "../editor/shared-confirmations.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { CommandRegistry } from "../shell/commands.js";
import { type ClipboardSession, copySelected, pasteElements } from "./element-clipboard.js";

/**
 * Registers Cut, Copy, Paste and Paste as Linked Copy (F-ED-23) for sections and elements (1.25)
 * in the Edit menu and the command box, with their usual shortcuts. In a text field or editable text, or with text selected, the
 * shortcuts stay the text's. Cut and Copy need a selected element; Cut and Paste change the
 * layout, so Content mode's lock (M3) turns them off. Returns a function that removes them, and
 * ones that follow the selection and the lock.
 */
export function registerClipboardCommands(
  registry: CommandRegistry,
  session: ClipboardSession,
  clipboard: Pick<ClipboardApi, "write" | "read">,
  beforeAction: () => void,
  notify: (message: string) => void,
  /** Asks before Cut removes an element from the shared Header or Footer (D7). */
  confirmSharedCut?: (item: string, place: SharedPlace) => Promise<boolean>,
): {
  readonly remove: () => void;
  readonly setHasSelection: (selected: boolean) => void;
  readonly setLayoutLocked: (locked: boolean) => void;
} {
  let selected = session.ui.getState().nodeId !== null;
  let locked = false;
  const removers = [
    registry.register({
      id: "edit.cut",
      label: t("edit.cut"),
      menu: "edit",
      enabled: selected,
      run: async () => {
        beforeAction();
        await copySelected(session, clipboard, notify, true, confirmSharedCut);
      },
    }),
    registry.register({
      id: "edit.copy",
      label: t("edit.copy"),
      menu: "edit",
      enabled: selected,
      run: async () => {
        beforeAction();
        await copySelected(session, clipboard, notify);
      },
    }),
    registry.register({
      id: "edit.paste",
      label: t("edit.paste"),
      menu: "edit",
      run: async () => {
        beforeAction();
        await pasteElements(session, clipboard, notify);
      },
    }),
    registry.register({
      id: COMMAND_IDS.pasteLinked,
      label: t("edit.pasteLinked"),
      menu: "edit",
      run: async () => {
        beforeAction();
        await pasteElements(session, clipboard, notify, true);
      },
    }),
  ];
  const update = () => {
    registry.update("edit.cut", { enabled: selected && !locked });
    registry.update("edit.copy", { enabled: selected });
    registry.update("edit.paste", { enabled: !locked });
    registry.update(COMMAND_IDS.pasteLinked, { enabled: !locked });
  };
  return {
    remove: () => {
      for (const remove of removers) remove();
    },
    setHasSelection: (next) => {
      selected = next;
      update();
    },
    setLayoutLocked: (next) => {
      locked = next;
      update();
    },
  };
}
