import { t } from "@webforge/i18n";
import type { BaseWindow, Dialog, OpenDialogOptions, SaveDialogOptions } from "electron";
import { describe, expect, it, vi } from "vitest";
import { createNativeDialogs, type DialogParts } from "./dialogs.js";

const parent = { id: 1 } as unknown as BaseWindow;

/** Dialogs answered as `answers` says, recording how they were asked. */
function setUp(
  answers: {
    readonly save?: { canceled: boolean; filePath: string };
    readonly open?: { canceled: boolean; filePaths: string[] };
    readonly test?: { path: string | undefined };
    readonly focused?: BaseWindow | null;
  } = {},
) {
  const dialog = {
    showSaveDialog: vi.fn(
      async (_parent: unknown, _options?: SaveDialogOptions) =>
        answers.save ?? { canceled: false, filePath: "/sites/A.wforge" },
    ),
    showOpenDialog: vi.fn(
      async (_parent: unknown, _options?: OpenDialogOptions) =>
        answers.open ?? { canceled: false, filePaths: ["/a", "/b"] },
    ),
  };
  const parts: DialogParts = {
    dialog: dialog as unknown as Pick<Dialog, "showSaveDialog" | "showOpenDialog">,
    focusedWindow: () => (answers.focused === undefined ? parent : answers.focused),
    testAnswer: async () => answers.test,
  };
  return { dialogs: createNativeDialogs(parts), dialog };
}

describe("createNativeDialogs", () => {
  it("asks where to save a new site, named after it, modal to the focused window", async () => {
    const { dialogs, dialog } = setUp();

    await expect(dialogs.project.chooseNewProjectPath("Rosie's Bakery")).resolves.toBe(
      "/sites/A.wforge",
    );
    await dialogs.project.chooseNewProjectPath("");
    expect(dialog.showSaveDialog).toHaveBeenCalledWith(parent, {
      title: t("site.newDialogTitle"),
      defaultPath: "Rosie's Bakery.wforge",
      filters: [{ name: t("site.fileType"), extensions: ["wforge"] }],
    });
    // A site without a name is offered the untitled one.
    expect(dialog.showSaveDialog.mock.calls[1]?.[1]?.defaultPath).toBe(
      `${t("site.untitledName")}.wforge`,
    );
  });

  it("answers nothing for a cancelled or nameless save, and opens without a parent when none is focused", async () => {
    await expect(
      setUp({ save: { canceled: true, filePath: "/x" } }).dialogs.project.chooseNewProjectPath(""),
    ).resolves.toBeUndefined();
    await expect(
      setUp({ save: { canceled: false, filePath: "" } }).dialogs.project.chooseNewProjectPath(""),
    ).resolves.toBeUndefined();

    const { dialogs, dialog } = setUp({ focused: null });
    await dialogs.project.chooseProjectToOpen();
    expect(dialog.showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({ properties: ["openFile"] }),
    );
  });

  it("opens one site, an export folder, and several Media files", async () => {
    const { dialogs, dialog } = setUp();

    await expect(dialogs.project.chooseProjectToOpen()).resolves.toBe("/a");
    await expect(dialogs.export.chooseExportFolder()).resolves.toBe("/a");
    await expect(dialogs.media.chooseMediaFiles()).resolves.toEqual(["/a", "/b"]);
    expect(dialog.showOpenDialog.mock.calls.map(([, options]) => options?.properties)).toEqual([
      ["openFile"],
      ["openDirectory", "createDirectory", "promptToCreate"],
      ["openFile", "multiSelections"],
    ]);
    const cancelled = setUp({ open: { canceled: true, filePaths: [] } }).dialogs;
    await expect(cancelled.export.chooseExportFolder()).resolves.toBeUndefined();
    await expect(cancelled.media.chooseMediaFiles()).resolves.toBeUndefined();
  });

  it("saves an export's ZIP under the site's name, as a .zip (3.3)", async () => {
    const { dialogs, dialog } = setUp({ save: { canceled: false, filePath: "/sites/Bakery.zip" } });

    await expect(dialogs.export.chooseExportZip("Rosa's Bakery")).resolves.toBe(
      "/sites/Bakery.zip",
    );
    expect(dialog.showSaveDialog.mock.calls[0]?.at(-1)).toMatchObject({
      defaultPath: "Rosa's Bakery.zip",
      filters: [{ extensions: ["zip"] }],
    });
    await expect(
      setUp({ save: { canceled: true, filePath: "" } }).dialogs.export.chooseExportZip("Bakery"),
    ).resolves.toBeUndefined();
  });

  it("saves a copy of a site as a ZIP under its name, and opens one ZIP (4.7)", async () => {
    const { dialogs, dialog } = setUp({
      save: { canceled: false, filePath: "/backups/Bakery.zip" },
    });

    await expect(dialogs.project.chooseSiteZipToSave("Rosa's Bakery")).resolves.toBe(
      "/backups/Bakery.zip",
    );
    expect(dialog.showSaveDialog.mock.calls[0]?.at(-1)).toMatchObject({
      title: "Save a copy of your site as a ZIP file",
      defaultPath: "Rosa's Bakery.zip",
      filters: [{ extensions: ["zip"] }],
    });
    await expect(dialogs.project.chooseSiteZipToOpen()).resolves.toBe("/a");
    expect(dialog.showOpenDialog.mock.calls[0]?.at(-1)).toMatchObject({
      title: "Open a site from a ZIP file",
      filters: [{ extensions: ["zip"] }],
      properties: ["openFile"],
    });
    const cancelled = setUp({
      save: { canceled: true, filePath: "" },
      open: { canceled: true, filePaths: [] },
    }).dialogs;
    await expect(cancelled.project.chooseSiteZipToSave("Bakery")).resolves.toBeUndefined();
    await expect(cancelled.project.chooseSiteZipToOpen()).resolves.toBeUndefined();
  });

  it("takes a test's answer instead of opening a site or export dialog (e2e builds)", async () => {
    const { dialogs, dialog } = setUp({ test: { path: "/test/Site.wforge" } });

    await expect(dialogs.project.chooseNewProjectPath("")).resolves.toBe("/test/Site.wforge");
    await expect(dialogs.project.chooseProjectToOpen()).resolves.toBe("/test/Site.wforge");
    await expect(dialogs.export.chooseExportFolder()).resolves.toBe("/test/Site.wforge");
    await expect(dialogs.export.chooseExportZip("Bakery")).resolves.toBe("/test/Site.wforge");
    await expect(dialogs.project.chooseSiteZipToSave("Bakery")).resolves.toBe("/test/Site.wforge");
    await expect(dialogs.project.chooseSiteZipToOpen()).resolves.toBe("/test/Site.wforge");
    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
    expect(dialog.showOpenDialog).not.toHaveBeenCalled();
  });
});
