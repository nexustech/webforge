import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useEffect, useState } from "react";
import type { NewSiteRequest, ProjectApi, ProjectResult } from "../../shared/ipc/project.js";
import type { TemplateSummary, TemplatesApi } from "../../shared/ipc/templates.js";
import { reportFailure } from "../log.js";
import { useCommandRegistry } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { NewSiteDialog, templateName } from "./NewSiteDialog.js";
import { openSiteWith } from "./open-site.js";
import { QuickStartDialog } from "./QuickStartDialog.js";

/** Props of {@link SiteCommands}. */
export type SiteCommandsProps = {
  /** Creates and opens sites; injectable for tests. Defaults to the preload API. */
  readonly project?: Pick<ProjectApi, "create" | "open">;
  /** Lists the templates New Site offers; injectable for tests. Defaults to the preload API. */
  readonly templates?: Pick<TemplatesApi, "list">;
  /** Starts the window over with the newly opened site; injectable for tests. */
  readonly restart?: () => void;
  /** Offers Help → Try an Example (PG-3): on the start screen, which lists the templates for it. */
  readonly example?: boolean;
};

/**
 * File → New Site… (Ctrl/Cmd+N), Start a Site… (the quick start, QS-1) and Open Site…
 * (Ctrl/Cmd+O), the title bar's New and Open buttons (F-SITE-1, F-SITE-2), and on the start screen
 * Help → Try an Example (PG-3). New Site and the quick start show their dialogs (2.14a, 3.11b) with
 * the templates main lists; then main shows the save dialog and saves the open site before
 * switching. A failure appears as a toast.
 */
export function SiteCommands({
  project,
  templates,
  restart,
  example: offer = false,
}: SiteCommandsProps) {
  const registry = useCommandRegistry();
  // The dialog open, New Site or the quick start, with the templates it shows; `null` for none.
  const [open, setOpen] = useState<{
    readonly dialog: "newSite" | "quickStart";
    readonly templates: readonly TemplateSummary[];
  } | null>(null);

  useEffect(() => {
    // Without the templates, a Blank site can still be made.
    const listed = () =>
      (templates ?? window.webforge.templates).list().catch((error: unknown) => {
        reportFailure("site.templates", error);
        return [];
      });
    const removeNew = registry.register({
      id: COMMAND_IDS.newSite,
      label: t("command.newSite"),
      menu: "file",
      run: () => listed().then((list) => setOpen({ dialog: "newSite", templates: list })),
    });
    const removeQuick = registry.register({
      id: COMMAND_IDS.quickStart,
      label: t("command.quickStart"),
      menu: "file",
      run: () => listed().then((list) => setOpen({ dialog: "quickStart", templates: list })),
    });
    const removeOpen = registry.register({
      id: COMMAND_IDS.openSite,
      label: t("command.openSite"),
      menu: "file",
      run: () => openWith(restart, () => (project ?? window.webforge.project).open()),
    });
    return () => {
      removeNew();
      removeQuick();
      removeOpen();
    };
  }, [registry, project, templates, restart]);

  // Try an example (PG-3, 2.14b): the first template marked as one, if the app ships any.
  const [example, setExample] = useState<TemplateSummary>();
  useEffect(() => {
    if (!offer) return;
    let current = true;
    (templates ?? window.webforge.templates).list().then(
      (listed) => {
        if (current) setExample(listed.find((template) => template.example));
      },
      (error: unknown) => reportFailure("site.templates", error),
    );
    return () => {
      current = false;
    };
  }, [offer, templates]);
  useEffect(() => {
    if (example === undefined) return;
    // Pre-filled and named after the example, straight from the template: no New Site dialog.
    return registry.register({
      id: COMMAND_IDS.tryExample,
      label: t("command.tryExample"),
      menu: "help",
      run: () =>
        openWith(restart, () =>
          (project ?? window.webforge.project).create(exampleRequest(example)),
        ),
    });
  }, [registry, example, project, restart]);

  const create = (request: NewSiteRequest) => {
    setOpen(null);
    openWith(restart, () => (project ?? window.webforge.project).create(request));
  };
  const listedTemplates = open?.templates ?? [];

  return (
    <>
      <NewSiteDialog
        open={open?.dialog === "newSite"}
        templates={listedTemplates}
        onCreate={create}
        onCancel={() => setOpen(null)}
      />
      <QuickStartDialog
        open={open?.dialog === "quickStart"}
        templates={listedTemplates}
        onCreate={create}
        onTryExample={(template) => create(exampleRequest(template))}
        // New Site, with the templates already listed: one click away (QS-4).
        onChooseTemplate={() => setOpen({ dialog: "newSite", templates: listedTemplates })}
        onCancel={() => setOpen(null)}
      />
    </>
  );
}

/** A template's finished example (PG-3): pre-filled and named after it, its sample business kept. */
const exampleRequest = (template: TemplateSummary): NewSiteRequest => ({
  name: templateName(template.id),
  theme: template.theme,
  template: template.id,
});

/** Runs a create or open request, showing why it failed as a toast. */
function openWith(restart: (() => void) | undefined, request: () => Promise<ProjectResult>) {
  void openSiteWith(request, restart).then((message) => {
    if (message !== undefined) toast.error(message);
  });
}
