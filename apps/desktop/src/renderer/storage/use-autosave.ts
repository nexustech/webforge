import { useEffect, useState } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { AppApi } from "../../shared/ipc/app.js";
import type { ProjectApi } from "../../shared/ipc/project.js";
import type { EditorSession } from "../editor/editor-session.js";
import { createAutosave, type SaveStatus } from "./autosave.js";
import type { LoadedSite } from "./load-site.js";
import { installSaveTriggers } from "./save-triggers.js";
import { siteSession } from "./site-session.js";

/** The parts of `window.webforge` autosave uses; injectable for tests. */
export type AutosaveApi = {
  readonly project: Pick<ProjectApi, "commit">;
  readonly app: Pick<AppApi, "onFlushRequest">;
};

/**
 * Autosaves the session's site while a site file is open (`loaded?.kind === "file"`), with the save
 * triggers of P2. Returns the save status to show, or `undefined` for a site in memory only. `api`
 * defaults to the preload API.
 */
export function useAutosave(
  session: EditorSession,
  loaded: LoadedSite | undefined,
  api: AutosaveApi | undefined,
): StoreApi<{ readonly status: SaveStatus }> | undefined {
  const [status, setStatus] = useState<StoreApi<{ readonly status: SaveStatus }>>();

  useEffect(() => {
    if (loaded?.kind !== "file") {
      return undefined;
    }
    const { project, app } = api ?? window.webforge;
    const autosave = createAutosave({
      document: session.history.document,
      saved: loaded.saved,
      commit: (changes) => project.commit(siteSession(), changes),
    });
    const removeTriggers = installSaveTriggers(window, autosave, session.ui, (save) =>
      app.onFlushRequest(save),
    );
    setStatus(autosave.status);
    return () => {
      removeTriggers();
      autosave.dispose();
    };
  }, [session, loaded, api]);

  return status;
}
