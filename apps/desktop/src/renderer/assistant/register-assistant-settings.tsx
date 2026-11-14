import type { FormSpec } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { z } from "zod";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { AssistantApi } from "../../shared/ipc/assistant.js";
import { type SettingsRegistry, settingsPart } from "../editor/settings-registry.js";
import type { WindowDialogRegistry } from "../shell/window-dialogs.js";
import { AssistantSettingsDialog } from "./AssistantSettingsDialog.js";

/** A line in Settings that opens the assistant's own dialog, which acts as it's used (#752). */
const assistantSpec = (
  open: () => void,
): FormSpec<Record<string, never>, Record<string, never>> => ({
  fields: () => [
    {
      kind: "action",
      name: "assistant",
      label: t("assistant.settings.title"),
      help: t("assistant.settings.line"),
      button: t("assistant.settings.open"),
      run: open,
    },
  ],
  schema: z.strictObject({}),
  toModel: () => ({}),
});

/**
 * Adds *Settings › Assistant* (6.9c) and the dialog it opens, drawn once by the window. Returns how
 * to open the dialog, for the panel's *Set Up the Assistant…*, and how to remove both.
 */
export function registerAssistantSettings(
  settings: Pick<SettingsRegistry, "register">,
  dialogs: Pick<WindowDialogRegistry, "register">,
  api: AssistantApi,
): { readonly open: () => void; readonly remove: () => void } {
  const shown = createStore(() => false);
  const open = () => shown.setState(true, true);
  function Dialog() {
    const isOpen = useStore(shown);
    return (
      <AssistantSettingsDialog
        open={isOpen}
        onOpenChange={(next) => shown.setState(next, true)}
        api={api}
      />
    );
  }
  const stops = [
    dialogs.register({ id: "assistantSettings", component: Dialog }),
    settings.register({
      id: "assistant",
      heading: "app",
      // After AI apps, the last of App's parts.
      order: 5,
      open: () =>
        settingsPart({
          id: "assistant",
          heading: "app",
          label: t("assistant.settings.title"),
          spec: assistantSpec(open),
          initial: {},
          // Nothing to keep: the dialog changes main's settings at once.
          save: () => undefined,
        }),
    }),
  ];
  return {
    open,
    remove: () => {
      for (const stop of stops) stop();
    },
  };
}
