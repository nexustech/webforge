import { t } from "@webforge/i18n";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { CommandRegistry } from "../shell/commands.js";
import type { WindowDialogRegistry } from "../shell/window-dialogs.js";
import { AssistantExamplesDialog } from "./AssistantExamplesDialog.js";

/**
 * Adds *Things You Can Ask* (5.21, OL-8), drawn once by the window, and *Help › Things You Can Ask
 * the Assistant…*, which opens it. `tryExample` puts a tried example in the assistant's box.
 * Returns how to open it, for the panel's link, and how to remove both.
 */
export function registerAssistantExamples(
  commands: Pick<CommandRegistry, "register">,
  dialogs: Pick<WindowDialogRegistry, "register">,
  tryExample: (text: string) => void,
): { readonly open: () => void; readonly remove: () => void } {
  const shown = createStore(() => false);
  const open = () => shown.setState(true, true);
  function Dialog() {
    const isOpen = useStore(shown);
    return (
      <AssistantExamplesDialog
        open={isOpen}
        onOpenChange={(next) => shown.setState(next, true)}
        onTry={tryExample}
      />
    );
  }
  const stops = [
    dialogs.register({ id: "assistantExamples", component: Dialog }),
    commands.register({
      id: COMMAND_IDS.assistantExamples,
      label: t("command.assistantExamples"),
      menu: "help",
      run: open,
    }),
  ];
  return {
    open,
    remove: () => {
      for (const stop of stops) stop();
    },
  };
}
