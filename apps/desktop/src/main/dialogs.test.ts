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
  it("asks where to save a new site, modal to the focused window, with the .wforge filter", async () => {
    const { dialogs, dialog } = setUp();

    await expect(dialogs.project.chooseNewProjectPath()).resolves.toBe("/sites/A.wforge");
    expect(dialog.showSaveDialog).toHaveBeenCalledWith(parent, {
      title: t("site.newDialogTitle"),
      defaultPath: `${t("site.untitledName")}.wforge`,
      filters: [{ name: t("site.fileType"), extensions: ["wforge"] }],
    });
  });

  it("answers nothing for a cancelled or nameless save, and opens without a parent when none is focused", async () => {
    await expect(
      setUp({ save: { canceled: true, filePath: "/x" } }).dialogs.project.chooseNewProjectPath(),
    ).resolves.toBeUndefined();
    await expect(
      setUp({ save: { canceled: false, filePath: "" } }).dialogs.project.chooseNewProjectPath(),
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

  it("takes a test's answer instead of opening a site or export dialog (e2e builds)", async () => {
    const { dialogs, dialog } = setUp({ test: { path: "/test/Site.wforge" } });

    await expect(dialogs.project.chooseNewProjectPath()).resolves.toBe("/test/Site.wforge");
    await expect(dialogs.project.chooseProjectToOpen()).resolves.toBe("/test/Site.wforge");
    await expect(dialogs.export.chooseExportFolder()).resolves.toBe("/test/Site.wforge");
    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
    expect(dialog.showOpenDialog).not.toHaveBeenCalled();
  });
});
