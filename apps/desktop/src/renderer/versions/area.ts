import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { createElement } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { VERSION_NAME_MAX } from "../../shared/ipc/versions.js";
import type { Area, WindowContext } from "../editor/areas.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { NameDialog } from "../shell/NameDialog.js";
import { siteSession } from "../storage/index.js";
import { registerVersionHistoryPanel } from "./register-version-history-panel.js";
import { createVersionActions } from "./version-actions.js";
import { createVersionList } from "./version-list.js";
import { registerVersionSettings } from "./versions-settings.js";

/**
 * Version History (F-SITE-4, 4.6): its panel beside Undo History, File → Save Version…
 * (Ctrl/Cmd+Alt+S) with its name dialog, the automatic version before a change to every page
 * (`setBeforeSiteWideAction`, A21), and Versions kept in the app's Settings. Each version's
 * Republish… asks Publish to republish it, and the list is read again once a publish goes live
 * (4.6b). Registered once, with the window, on the opening of the site it was loaded for (R6).
 */
export const versionHistoryArea: Area<WindowContext> = {
  id: "versionHistory",
  register: ({
    api,
    session,
    commands,
    panels,
    siteWide,
    windowDialogs,
    settings,
    preferences,
    publishing,
  }) => {
    const list = createVersionList(() => api.versions.list(siteSession()));
    const actions = createVersionActions({
      versions: api.versions,
      preview: api.preview,
      sessionId: siteSession,
      session,
      list,
      notify: {
        success: (message) => toast.success(message),
        error: (message) => toast.error(message),
        working: (message) => {
          const id = toast.loading(message);
          return () => toast.dismiss(id);
        },
      },
      restart: () => window.location.reload(),
      republish: (version) => publishing.republish(version),
    });

    const naming = createStore<{ readonly open: boolean }>(() => ({ open: false }));
    const askName = () => naming.setState({ open: true });
    const close = () => naming.setState({ open: false });
    function SaveVersion() {
      const { open } = useStore(naming);
      return createElement(NameDialog, {
        open,
        title: t("versionHistory.saveDialog.title"),
        description: t("versionHistory.saveDialog.description"),
        label: t("versionHistory.saveDialog.name"),
        initialValue: "",
        confirm: t("versionHistory.saveDialog.confirm"),
        maxLength: VERSION_NAME_MAX,
        onSubmit: (name) => {
          close();
          void actions.save(name);
        },
        onCancel: close,
      });
    }

    const stops = [
      windowDialogs.register({ id: "saveVersion", component: SaveVersion }),
      commands.register({
        id: COMMAND_IDS.saveVersion,
        label: t("versionHistory.save"),
        menu: "file",
        run: askName,
      }),
      registerVersionHistoryPanel(panels, list, actions, askName),
      siteWide.setBeforeSiteWideAction((action, options) =>
        actions.beforeSiteWide(action, options),
      ),
      registerVersionSettings(settings, preferences),
      // A publish saves a version, and a republish records where one went.
      publishing.onPublished(() => {
        void list.refresh();
      }),
    ];
    return () => {
      for (const stop of stops.toReversed()) stop();
    };
  },
};
