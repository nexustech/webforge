import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useEffect } from "react";
import type { ProjectApi, ProjectResult } from "../../shared/ipc/project.js";
import { useCommandRegistry } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { openSiteWith } from "./open-site.js";

/** Props of {@link SiteCommands}. */
export type SiteCommandsProps = {
  /** Creates and opens sites; injectable for tests. Defaults to the preload API. */
  readonly project?: Pick<ProjectApi, "create" | "open">;
  /** Starts the window over with the newly opened site; injectable for tests. */
  readonly restart?: () => void;
};

/**
 * File → New Site… (Ctrl/Cmd+N) and Open Site… (Ctrl/Cmd+O), the title bar's New and Open
 * buttons (F-SITE-1, F-SITE-2). The main process shows the dialog and saves the open site before
 * switching. Renders nothing; a failure appears as a toast.
 */
export function SiteCommands({ project, restart }: SiteCommandsProps) {
  const registry = useCommandRegistry();

  useEffect(() => {
    const run =
      (request: (api: Pick<ProjectApi, "create" | "open">) => Promise<ProjectResult>) => () =>
        void openSiteWith(() => request(project ?? window.webforge.project), restart).then(
          (message) => {
            if (message !== undefined) toast.error(message);
          },
        );
    const removeNew = registry.register({
      id: COMMAND_IDS.newSite,
      label: t("command.newSite"),
      menu: "file",
      shortcut: "Mod+N",
      run: run((api) => api.create()),
    });
    const removeOpen = registry.register({
      id: COMMAND_IDS.openSite,
      label: t("command.openSite"),
      menu: "file",
      shortcut: "Mod+O",
      run: run((api) => api.open()),
    });
    return () => {
      removeNew();
      removeOpen();
    };
  }, [registry, project, restart]);

  return null;
}
