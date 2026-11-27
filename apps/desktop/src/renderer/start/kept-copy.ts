import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { KeptCopyInfo, SaveKeptCopyResult } from "../../shared/ipc/project.js";
import type { Area, WindowContext } from "../editor/areas.js";
import { reportFailure } from "../log.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { CommandRegistry } from "../shell/commands.js";
import { siteSession } from "../storage/index.js";

/** What the person is told once the copy is saved, or why it wasn't. */
function tell(result: SaveKeptCopyResult): void {
  if (result.status === "saved") {
    toast.success(t("site.keptCopy.saved", { name: result.fileName }), {
      description: t("site.keptCopy.savedDescription"),
    });
  } else if (result.status === "failed") {
    toast.error(
      t(
        result.reason === "open-site"
          ? "site.keptCopy.saveOverOpenSite"
          : "site.keptCopy.saveFailed",
      ),
    );
  }
}

/** What the toast says of a copy just kept: the releases it's for, when they're known. */
function keptMessage(kept: Extract<KeptCopyInfo, { status: "kept" }>): string {
  const { first, last } = kept;
  if (first === null || last === null) return t("site.keptCopy.keptUnnamed");
  const versions = first === last ? first : t("site.keptCopy.versions", { first, last });
  return t("site.keptCopy.kept", { versions });
}

/**
 * File → Save the Copy from Before the Update… (#1525, UC-2): the open site's file as an older
 * Webforge wrote it, kept before this one first wrote it in a newer format, saved as a site file of
 * its own for that version to open. Main asks where and copies it, byte for byte. Off while it
 * runs. Returns its run, for the toast that offers it, and its removal.
 */
function registerKeptCopyCommand(
  registry: CommandRegistry,
  save: () => Promise<SaveKeptCopyResult>,
): { readonly run: () => Promise<void>; readonly dispose: () => void } {
  const run = async () => {
    registry.update(COMMAND_IDS.saveKeptCopy, { enabled: false });
    try {
      tell(await save());
    } catch (error) {
      reportFailure("site.saveKeptCopy", error);
      toast.error(t("site.keptCopy.saveFailed"));
    } finally {
      registry.update(COMMAND_IDS.saveKeptCopy, { enabled: true });
    }
  };
  const dispose = registry.register({
    id: COMMAND_IDS.saveKeptCopy,
    label: t("command.saveKeptCopy"),
    menu: "file",
    run,
  });
  return { run, dispose };
}

/**
 * Save the Copy from Before the Update…, in the File menu only while the open site has such a copy
 * (rare, so never greyed out on every site): looked for as the window starts, and offered in a
 * toast when one is kept as this site is first changed.
 */
export const keptCopyArea: Area<WindowContext> = {
  id: "keptCopy",
  register: ({ api, commands }) => {
    let command: ReturnType<typeof registerKeptCopyCommand> | undefined;
    let stopped = false;
    /** Offers the copy, if the site has one: in the File menu, and when `announce`, in a toast. */
    const offer = async (announce: boolean) => {
      // The copy of the site this page was loaded for (R6, #663).
      const kept = await api.project.keptCopy(siteSession());
      if (stopped || kept.status !== "kept") return;
      command ??= registerKeptCopyCommand(commands, () => api.project.saveKeptCopy(siteSession()));
      const offered = command;
      if (announce) {
        toast(keptMessage(kept), {
          description: t("site.keptCopy.keptDescription"),
          action: { label: t("site.keptCopy.save"), onClick: () => void offered.run() },
        });
      }
    };
    const failed = (error: unknown) => reportFailure("site.keptCopy", error);
    void offer(false).catch(failed);
    const stop = api.app.onCopyKept(() => {
      void offer(true).catch(failed);
    });
    return () => {
      stopped = true;
      stop();
      command?.dispose();
    };
  },
};
