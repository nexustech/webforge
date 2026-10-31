import { toast } from "@webforge/editor-ui";
import type { Area, EditorContext } from "../editor/areas.js";
import { sharedCutConfirmation } from "../editor/shared-confirmations.js";
import { followLayoutLock } from "../shell/preferences-store.js";
import { registerLookCommands } from "./apply-look.js";
import { registerClipboardCommands } from "./register-clipboard-commands.js";
import { registerStyleCommands } from "./style-clipboard.js";

/**
 * Cut, Copy and Paste of sections and elements (1.25), first among the canvas's actions, as in
 * other apps' menus (2.20, B1).
 */
export const clipboardCommandsArea: Area<EditorContext> = {
  id: "clipboardCommands",
  register: ({ api, engine, session, commands, preferences, siteWide }) =>
    engine.whileMounted(({ connection }) => {
      const clipboardCommands = registerClipboardCommands(
        commands,
        session,
        api.clipboard,
        connection.flush,
        (message) => toast(message),
        siteWide === undefined ? undefined : sharedCutConfirmation(session, siteWide),
      );
      const stopLock = followLayoutLock(preferences, clipboardCommands.setLayoutLocked);
      // Several selected elements (1.31): Cut and Copy act on one.
      const stopSelection = session.ui.subscribe((ui) =>
        clipboardCommands.setHasSelection(ui.nodeId !== null && (ui.others ?? []).length === 0),
      );
      return () => {
        stopSelection();
        stopLock();
        clipboardCommands.remove();
      };
    }),
};

/**
 * Copy Style and Paste Style (1.37), after Cut, Copy and Paste (2.20, B1); then Apply Look to
 * Every… on this page and on the site (2.27, ST-4).
 */
export const styleCommandsArea: Area<EditorContext> = {
  id: "styleCommands",
  register: ({ engine, session, commands, preferences, siteWide }) =>
    engine.whileMounted(({ connection }) => {
      const styleCommands = registerStyleCommands(commands, session, connection.flush);
      const lookCommands = registerLookCommands(
        commands,
        session,
        connection.flush,
        siteWide,
        (message) => toast(message),
      );
      const stopLocks = [styleCommands, lookCommands].map((registered) =>
        followLayoutLock(preferences, registered.setLayoutLocked),
      );
      return () => {
        for (const stop of stopLocks) stop();
        lookCommands.remove();
        styleCommands.remove();
      };
    }),
};
