import { type ElectronApplication, expect, type Page } from "@playwright/test";

type ProjectSummary = {
  sessionId: string;
  name: string;
  fileName: string;
  formatVersion: number;
  syncService: string | null;
};

/** The parts of `window.webforge` the site tests call (the renderer's global, seen from tests). */
export type RendererWindow = {
  webforge: {
    project: {
      create(request: { name: string; theme: string; template?: string }): Promise<unknown>;
      open(): Promise<unknown>;
      getCurrent(): Promise<ProjectSummary | null>;
      readSite(): Promise<unknown>;
      commit(sessionId: string, changes: readonly unknown[]): Promise<unknown>;
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

/**
 * File → Export Site… as the person goes through it (3.3): past the web address prompt when it's
 * asked, with the export dialog as it opens, until the report shows. Gives the report's text, and
 * closes it.
 */
export async function exportFromEditor(page: Page, timeout = 30_000): Promise<string> {
  await page.getByRole("button", { name: "Export Site…", exact: true }).click();
  const prompt = page.getByRole("alertdialog", { name: "Add your site's web address?" });
  const options = page.getByRole("dialog", { name: "Export Site" });
  await expect(prompt.or(options)).toBeVisible();
  if (await prompt.isVisible()) {
    await prompt.getByRole("button", { name: "Export without it" }).click();
  }
  await options.getByRole("button", { name: "Export…" }).click();
  const report = page.getByRole("dialog", { name: "Site exported" });
  await expect(report).toBeVisible({ timeout });
  const text = (await report.textContent()) ?? "";
  await report.getByRole("button", { name: "Done" }).click();
  await expect(report).toBeHidden();
  return text;
}

/**
 * Opens the preview server's `url` in a browser's `site` page, once more if Windows had no socket
 * buffer free for the connection (WSAENOBUFS, `net::ERR_NO_BUFFER_SPACE`). That happened once on
 * CI's busy runner (#678), 50 ms after the same server had answered: the connection fails in the
 * operating system, before it reaches the server, so it says nothing about the app.
 */
export async function openPreview(site: Page, url: string): ReturnType<Page["goto"]> {
  try {
    return await site.goto(url);
  } catch (error) {
    if (!String(error).includes("net::ERR_NO_BUFFER_SPACE")) throw error;
    return site.goto(url);
  }
}
