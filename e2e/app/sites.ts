import type { ElectronApplication } from "@playwright/test";

type ProjectSummary = { name: string; fileName: string; formatVersion: number };

/** The parts of `window.webforge` the site tests call (the renderer's global, seen from tests). */
export type RendererWindow = {
  webforge: {
    project: {
      create(): Promise<unknown>;
      open(): Promise<unknown>;
      getCurrent(): Promise<ProjectSummary | null>;
    };
  };
};

/**
 * Makes the main process's native save and open dialogs answer with `filePath` instead of
 * showing up. The app looks the dialog functions up at call time, so replacing them works.
 */
export async function stubFileDialogs(app: ElectronApplication, filePath: string): Promise<void> {
  await app.evaluate(({ dialog }, path) => {
    Object.assign(dialog, {
      showSaveDialog: async () => ({ canceled: false, filePath: path }),
      showOpenDialog: async () => ({ canceled: false, filePaths: [path] }),
    });
  }, filePath);
}
