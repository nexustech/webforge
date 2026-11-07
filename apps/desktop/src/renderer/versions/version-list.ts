import { createStore, type StoreApi } from "zustand/vanilla";
import type { ListVersionsResult, VersionSummary } from "../../shared/ipc/versions.js";
import { reportFailure } from "../log.js";

/** What the Version History panel shows: the site's versions once main has listed them. */
export type VersionListState =
  | { readonly status: "loading" }
  | { readonly status: "failed" }
  | {
      readonly status: "ready";
      /** Newest first. */
      readonly versions: readonly VersionSummary[];
      /** What all of them keep that the site itself doesn't. */
      readonly bytes: number;
    };

/** The open site's versions, listed again after each change to them. */
export type VersionList = {
  readonly state: StoreApi<VersionListState>;
  /** Lists the versions again; resolves once the newest listing is shown. */
  refresh(): Promise<void>;
};

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
