import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useEffect, useState } from "react";
import type { NewSiteRequest, ProjectApi, ProjectResult } from "../../shared/ipc/project.js";
import type { TemplateSummary, TemplatesApi } from "../../shared/ipc/templates.js";
import { reportFailure } from "../log.js";
import { useCommandRegistry } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { NewSiteDialog } from "./NewSiteDialog.js";
import { openSiteWith } from "./open-site.js";

/** Props of {@link SiteCommands}. */
export type SiteCommandsProps = {
  /** Creates and opens sites; injectable for tests. Defaults to the preload API. */
  readonly project?: Pick<ProjectApi, "create" | "open">;
  /** Lists the templates New Site offers; injectable for tests. Defaults to the preload API. */
  readonly templates?: Pick<TemplatesApi, "list">;
  /** Starts the window over with the newly opened site; injectable for tests. */
  readonly restart?: () => void;
};

/**
 * File → New Site… (Ctrl/Cmd+N) and Open Site… (Ctrl/Cmd+O), the title bar's New and Open
 * buttons (F-SITE-1, F-SITE-2). New Site shows its dialog (2.14a) with the templates main lists;
 * then main shows the save dialog and saves the open site before switching. A failure appears as
 * a toast.
 */
export function SiteCommands({ project, templates, restart }: SiteCommandsProps) {
  const registry = useCommandRegistry();
  // The templates New Site shows while it is open; `null` while it is closed.
  const [newSite, setNewSite] = useState<readonly TemplateSummary[] | null>(null);

  useEffect(() => {
    const removeNew = registry.register({
      id: COMMAND_IDS.newSite,
      label: t("command.newSite"),
      menu: "file",
      run: () =>
        (templates ?? window.webforge.templates).list().then(setNewSite, (error: unknown) => {
          // Without the templates, a Blank site can still be made.
          reportFailure("site.templates", error);
          setNewSite([]);
        }),
    });
    const removeOpen = registry.register({
      id: COMMAND_IDS.openSite,
      label: t("command.openSite"),
      menu: "file",
      run: () => openWith(restart, () => (project ?? window.webforge.project).open()),
    });
    return () => {
      removeNew();
      removeOpen();
    };
  }, [registry, project, templates, restart]);

  const create = (request: NewSiteRequest) => {
    setNewSite(null);
    openWith(restart, () => (project ?? window.webforge.project).create(request));
  };

  return (
    <NewSiteDialog
      open={newSite !== null}
      templates={newSite ?? []}
      onCreate={create}
      onCancel={() => setNewSite(null)}
    />
  );
}

/** Runs a create or open request, showing why it failed as a toast. */
function openWith(restart: (() => void) | undefined, request: () => Promise<ProjectResult>) {
  void openSiteWith(request, restart).then((message) => {
    if (message !== undefined) toast.error(message);
  });
}
