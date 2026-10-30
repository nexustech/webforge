import { t } from "@webforge/i18n";
import { DOCUMENT_EXTENSIONS } from "@webforge/model";
import type { BaseWindow, Dialog, OpenDialogOptions, SaveDialogOptions } from "electron";
import type { E2eDialog } from "./e2e-dialogs.js";
import type { ExportDialogs } from "./export-ipc.js";
import type { MediaDialogs } from "./media-ipc.js";
import { type ProjectDialogs, siteFileName } from "./project-ipc.js";
import { PROJECT_EXTENSION } from "./project-session.js";

/** What the native dialogs are made with; fakes in tests. */
export type DialogParts = {
  /**
   * Electron's `dialog`. Its methods are looked up at call time: the unpacked E2E tests replace
   * `showSaveDialog` and `showOpenDialog` on it.
   */
  readonly dialog: Pick<Dialog, "showSaveDialog" | "showOpenDialog">;
  /** The window a dialog is modal to: the focused one, if any. */
  focusedWindow(): BaseWindow | null;
  /**
   * A test's answer for a file dialog, in `--mode e2e` builds only (e2e-dialogs.ts): the packaged
   * E2E tests can't replace `dialog`. `undefined` everywhere else, and the dialog opens.
   */
  testAnswer(kind: E2eDialog): Promise<{ path: string | undefined } | undefined>;
};

/** The native file dialogs of sites, the export and Media. */
export type NativeDialogs = {
  readonly project: ProjectDialogs;
  readonly export: ExportDialogs;
  readonly media: MediaDialogs;
};

/** The native file dialogs, each modal to the focused window when there is one. */
export function createNativeDialogs(parts: DialogParts): NativeDialogs {
  const { dialog } = parts;
  const projectFilters = [{ name: t("site.fileType"), extensions: [PROJECT_EXTENSION.slice(1)] }];
  const siteZipFilters = [{ name: t("site.zip.fileType"), extensions: ["zip"] }];

  const save = (options: SaveDialogOptions) => {
    const parent = parts.focusedWindow();
    return parent === null
      ? dialog.showSaveDialog(options)
      : dialog.showSaveDialog(parent, options);
  };
  const open = (options: OpenDialogOptions) => {
    const parent = parts.focusedWindow();
    return parent === null
      ? dialog.showOpenDialog(options)
      : dialog.showOpenDialog(parent, options);
  };

  return {
    project: {
      chooseNewProjectPath: async (siteName) => {
        const answer = await parts.testAnswer("save");
        if (answer !== undefined) return answer.path;
        const result = await save({
          title: t("site.newDialogTitle"),
          defaultPath: `${siteFileName(siteName, t("site.untitledName"))}${PROJECT_EXTENSION}`,
          filters: projectFilters,
        });
        return result.canceled || result.filePath === "" ? undefined : result.filePath;
      },
      chooseProjectToOpen: async () => {
        const answer = await parts.testAnswer("open");
        if (answer !== undefined) return answer.path;
        const result = await open({
          title: t("site.openDialogTitle"),
          filters: projectFilters,
          properties: ["openFile"],
        });
        return result.canceled ? undefined : result.filePaths[0];
      },
      chooseSiteZipToSave: async (siteName) => {
        const answer = await parts.testAnswer("save");
        if (answer !== undefined) return answer.path;
        // The system's dialog asks before replacing a file of that name.
        const result = await save({
          title: t("site.zip.saveDialogTitle"),
          defaultPath: `${siteFileName(siteName, t("site.untitledName"))}.zip`,
          filters: siteZipFilters,
        });
        return result.canceled || result.filePath === "" ? undefined : result.filePath;
      },
      chooseSiteZipToOpen: async () => {
        const answer = await parts.testAnswer("open");
        if (answer !== undefined) return answer.path;
        const result = await open({
          title: t("site.zip.openDialogTitle"),
          filters: siteZipFilters,
          properties: ["openFile"],
        });
        return result.canceled ? undefined : result.filePaths[0];
      },
    },
    export: {
      chooseExportFolder: async () => {
        const answer = await parts.testAnswer("folder");
        if (answer !== undefined) return answer.path;
        const result = await open({
          title: t("export.dialogTitle"),
          properties: ["openDirectory", "createDirectory", "promptToCreate"],
        });
        return result.canceled ? undefined : result.filePaths[0];
      },
      chooseExportZip: async (siteName) => {
        const answer = await parts.testAnswer("save");
        if (answer !== undefined) return answer.path;
        // The system's dialog asks before replacing a file of that name.
        const result = await save({
          title: t("export.zipDialogTitle"),
          defaultPath: `${siteFileName(siteName, t("site.untitledName"))}.zip`,
          filters: [{ name: t("export.zipFileType"), extensions: ["zip"] }],
        });
        return result.canceled || result.filePath === "" ? undefined : result.filePath;
      },
    },
    media: {
      chooseMediaFiles: async () => {
        const result = await open({
          title: t("site.media.chooseTitle"),
          filters: [
            {
              name: t("site.media.fileType"),
              extensions: ["jpg", "jpeg", "png", ...Object.values(DOCUMENT_EXTENSIONS)],
            },
          ],
          properties: ["openFile", "multiSelections"],
        });
        return result.canceled ? undefined : result.filePaths;
      },
    },
  };
}
