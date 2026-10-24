import type { Area, EditorContext } from "../editor/areas.js";
import { followLayoutLock } from "../shell/preferences-store.js";
import { registerSharedSectionCommands } from "./SharedSectionCommands.js";

/** The shared-section commands (1.29), after the canvas's own actions (2.20, B1). */
export const sharedSectionCommandsArea: Area<EditorContext> = {
  id: "sharedSectionCommands",
  register: ({ engine, session, commands, preferences, siteWide, dialogs }) =>
    engine.whileMounted(({ connection }) => {
      const sharedCommands = registerSharedSectionCommands(
        commands,
        session,
        connection.flush,
        dialogs.nameSharedSection,
        siteWide,
      );
      const stopLock = followLayoutLock(preferences, sharedCommands.setLayoutLocked);
      return () => {
        stopLock();
        sharedCommands.remove();
      };
    }),
};
