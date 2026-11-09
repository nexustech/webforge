import type { Area, WindowContext } from "../editor/areas.js";
import { showUpdateReady, updateReadyNotices } from "./update-ready.js";

/**
 * Webforge's own updates (0.5a): main downloads them in the background and installs one as Webforge
 * closes. The window says so once, quietly, when one is ready: as it opens, if main already has one,
 * and whenever main says one has downloaded.
 */
export const updatesArea: Area<WindowContext> = {
  id: "updates",
  register: ({ api }) => {
    const notice = updateReadyNotices(showUpdateReady);
    const stop = api.updates.onStatus(notice);
    void api.updates
      .status()
      .then(notice)
      .catch(() => undefined);
    return stop;
  },
};
