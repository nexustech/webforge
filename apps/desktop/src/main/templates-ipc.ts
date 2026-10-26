import { existsSync, readFileSync } from "node:fs";
import type { TemplateCategory } from "@webforge/templates";
import type { TemplateFolder } from "@webforge/templates/node";
import type { IpcMain } from "electron";
import type { TemplateSummary } from "../shared/ipc/templates.js";
import { registerIpcHandler } from "./ipc.js";

/**
 * What New Site shows of a template (2.14a): never its content, which only main reads, but its
 * thumbnail (2.14b) as a data URL, or none if the folder has none.
 */
function templateSummary(
  { template, thumbnail }: TemplateFolder,
  category: TemplateCategory,
): TemplateSummary {
  const pages = Object.values(template.site.pages).filter((page) => page.kind === "page");
  return {
    id: template.id,
    category,
    example: template.example,
    pages: pages.length,
    theme: template.site.theme.preset,
    thumbnail: existsSync(thumbnail)
      ? `data:image/png;base64,${readFileSync(thumbnail).toString("base64")}`
      : null,
  };
}

/**
 * Registers the `templates` IPC calls (2.14a): the templates the app ships, as `templates` gives
 * them (read once, from the folder the installer puts beside app.asar). Not Blank (2.15c), which
 * has no business type: New Site offers it on its own and makes it when no template is chosen.
 */
export function registerTemplatesHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  templates: () => readonly TemplateFolder[],
): void {
  registerIpcHandler(ipc, "listTemplates", isTrustedSender, () =>
    templates().flatMap((folder) =>
      folder.template.category === null ? [] : [templateSummary(folder, folder.template.category)],
    ),
  );
}
