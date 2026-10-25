import type { MediaApi, MediaImportResult } from "../../shared/ipc/media.js";
import type { Call } from "./call.js";

/**
 * The path of a dropped file on the user's computer (Electron's `webUtils.getPathForFile`), or
 * `""` for a file that has none, such as one a page made: the renderer can't invent a path.
 */
export type PathOfFile = (file: File) => string;

/** What importing no files gives. */
const nothingImported = (): MediaImportResult => ({ status: "imported", items: [], rejected: [] });

/** `window.webforge.media`. */
export const mediaApi = (call: Call, pathOf: PathOfFile): MediaApi => ({
  import: (sessionId, files) => call("importMedia", sessionId, [...files]),
  async importFiles(sessionId, files) {
    // The paths stay here and in the main process: the renderer only learns which files had none.
    const paths = files.map((file) => {
      try {
        return pathOf(file);
      } catch {
        return "";
      }
    });
    const withoutPath = paths.flatMap((path, index) => (path === "" ? [index] : []));
    const found = paths.filter((path) => path !== "");
    const result =
      found.length === 0 ? nothingImported() : await call("importMediaPaths", sessionId, found);
    return { result, withoutPath };
  },
  choose: (sessionId) => call("chooseMedia", sessionId),
});
