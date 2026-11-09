import type { ReactElement } from "react";
import type { Preferences } from "../shared/ipc/prefs.js";
import type { ProjectSummary, ReadSiteResult, SiteUiState } from "../shared/ipc/project.js";
import type { AppInfo } from "../shared/ipc-contract.js";
import { starterSite } from "../shared/starter-site.js";
import { App } from "./App.js";
import { loadSite } from "./storage/load-site.js";

/** Draws the editor with the app's details and the person's preferences. */
export type ShowEditor = (info: AppInfo, preferences: Preferences) => ReactElement;

/**
 * The editor's way in, which `main.tsx` loads with `import()` only when a site is open (#896): the
 * start screen's first bundle then holds none of the editor's code, its site components or Puck.
 *
 * Takes the open site `current`, what reading it gave, and its editor state, which main read while
 * this code loaded. Gives the editor for them, or nothing when the site couldn't be read (one this
 * build can't read, or one closed meanwhile), for the start screen instead.
 */
export async function editorFor(
  current: ProjectSummary,
  site: ReadSiteResult,
  uiState: SiteUiState | null,
): Promise<ShowEditor | undefined> {
  const loaded = await loadSite(
    { getCurrent: async () => current, readSite: async () => site },
    starterSite,
  );
  if (loaded.kind !== "file") return undefined;
  return (info, preferences) => (
    <App info={info} preferences={preferences} loaded={loaded} uiState={uiState} />
  );
}
