import type { EditorSession } from "../editor/editor-session.js";
import type { LoadedSite } from "./load-site.js";
import { SaveStatus } from "./SaveStatus.js";
import { type AutosaveApi, useAutosave } from "./use-autosave.js";

/** Props of {@link AutosaveStatus}. */
export type AutosaveStatusProps = {
  readonly session: EditorSession;
  /** The site as read at start-up; nothing is saved when it is `undefined` or in memory only. */
  readonly loaded: LoadedSite | undefined;
  /** Saves the site; injectable for tests. Defaults to the preload API. */
  readonly api?: AutosaveApi;
};

/**
 * Autosaves the session's site and shows "Saved" / "Saving…" (P2). Self-contained, so the shell
 * only mounts it where the save status belongs (the title bar, UI1).
 */
export function AutosaveStatus({ session, loaded, api }: AutosaveStatusProps) {
  const status = useAutosave(session, loaded, api);
  return status === undefined ? null : <SaveStatus status={status} />;
}
