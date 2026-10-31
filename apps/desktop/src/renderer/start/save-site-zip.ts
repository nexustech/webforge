import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { SaveSiteZipResult } from "../../shared/ipc-contract.js";
import type { Area, WindowContext } from "../editor/areas.js";
import { reportFailure } from "../log.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { CommandRegistry } from "../shell/commands.js";

/** What the person is told once a copy is saved, or why it wasn't. */
function tell(result: SaveSiteZipResult): void {
  if (result.status === "saved") {
    toast.success(t("site.zip.saved", { name: result.fileName }), {
      description: t("site.zip.savedDescription"),
    });
  } else if (result.status === "failed") {
    toast.error(
      result.reason === "too-large"
        ? t("site.zip.tooLarge")
        : result.reason === "own-file"
          ? t("site.zip.ownFile")
          : t("site.zip.saveFailed"),
    );
  }
}

/**
 * File → Save a Copy as ZIP… (4.7, F-SITE-5): the whole site, with its versions, as one ZIP file
 * for a backup or another computer, which Open Site from ZIP… opens again. Main asks where, saves
 * the last changes and writes it. Not Export, which makes the website. Off while it runs.
 */
export function registerSaveSiteZipCommand(
  registry: CommandRegistry,
  save: () => Promise<SaveSiteZipResult>,
): () => void {
  const run = async () => {
    registry.update(COMMAND_IDS.saveSiteZip, { enabled: false });
    try {
      tell(await save());
    } catch (error) {
      reportFailure("site.saveZip", error);
      toast.error(t("site.zip.saveFailed"));
    } finally {
      registry.update(COMMAND_IDS.saveSiteZip, { enabled: true });
    }
  };
  return registry.register({
    id: COMMAND_IDS.saveSiteZip,
    label: t("command.saveSiteZip"),
    menu: "file",
    run,
  });
}

/** Save a Copy as ZIP…, after Export in the File menu. */
export const saveSiteZipArea: Area<WindowContext> = {
  id: "saveSiteZip",
  register: (context) => registerSaveSiteZipCommand(context.commands, context.saveSiteZip),
};
