import { createStore } from "zustand/vanilla";
import type { ListVersionsResult } from "../../shared/ipc/versions.js";
import type { VersionList, VersionListState } from "../editor/version-history.js";
import { reportFailure } from "../log.js";

/**
 * The open site's versions, from `list` (main's `versions:list`). A listing that comes back after a
 * later one started is dropped, so the panel never goes back to an older list.
 */
export function createVersionList(list: () => Promise<ListVersionsResult>): VersionList {
  const state = createStore<VersionListState>(() => ({ status: "loading" }));
  let latest = 0;
  return {
    state,
    async refresh() {
      latest += 1;
      const asked = latest;
      let next: VersionListState;
      try {
        const result = await list();
        next =
          result.status === "ok"
            ? { status: "ready", versions: result.versions, bytes: result.bytes }
            : { status: "failed" };
      } catch (error) {
        reportFailure("versions.list", error);
        next = { status: "failed" };
      }
      if (asked === latest) state.setState(next, true);
    },
  };
}
