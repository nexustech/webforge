import { existsSync, readFileSync } from "node:fs";
import type { TemplateFolder } from "@webforge/templates/node";
import type { IpcMain } from "electron";
import type { TemplateSummary } from "../shared/ipc/templates.js";
import { registerIpcHandler } from "./ipc.js";

/**
 * What New Site shows of a template (2.14a): never its content, which only main reads, but its
 * thumbnail (2.14b) as a data URL, or none if the folder has none.
 */
function templateSummary({ template, thumbnail }: TemplateFolder): TemplateSummary {
  const pages = Object.values(template.site.pages).filter((page) => page.kind === "page");
  return {
    id: template.id,
    category: template.category,
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
 * them (read once, from the folder the installer puts beside app.asar). Their summaries, thumbnails
 * and all, are made once too, when first listed: they never change while the app runs, and each
 * New Site would otherwise read and encode every thumbnail again on the main thread (#456 review).
 */
export function registerTemplatesHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  templates: () => readonly TemplateFolder[],
): void {
  let summaries: readonly TemplateSummary[] | undefined;
  registerIpcHandler(ipc, "listTemplates", isTrustedSender, () => {
    summaries ??= templates().map(templateSummary);
    return [...summaries];
  });
}
