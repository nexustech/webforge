import { syncDraft } from "@webforge/history";
import { t } from "@webforge/i18n";
import { isNodeDoc, type NodeDoc, pageDocSchema } from "@webforge/model";
import { type EditorSession, labelFor } from "../editor/editor-session.js";

// Hooks for the large-page performance check (spec/04 item 0.4, ADR 0007). Only builds made with
// `electron-vite build --mode perf` load this module (see App.tsx); normal builds never include it.

/** What the performance tests can call on `window.__webforgePerf`. */
export type PerfHooks = {
  /** Replaces the page with `page` (validated), then forgets the history so tests start clean. */
  loadPage(page: unknown): void;
  /** Adds `count` history steps, each toggling the first heading's size (a real props edit). */
  addSteps(count: number): void;
};

declare global {
  interface Window {
    __webforgePerf?: PerfHooks;
  }
}

function firstHeading(nodes: readonly NodeDoc[]): NodeDoc | undefined {
  for (const node of nodes) {
    if (node.type === "Heading") {
      return node;
    }
    for (const value of Object.values(node.props)) {
      const found = Array.isArray(value) ? firstHeading(value.filter(isNodeDoc)) : undefined;
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

/** Creates the hooks for `session`. */
export function createPerfHooks(session: EditorSession): PerfHooks {
  // The label a real size change gets ("Changed Heading size").
  const label = labelFor(
    {
      kind: "props",
      nodeId: null,
      componentType: "Heading",
      field: "size",
      page: session.history.document.getState().page,
      selection: null,
    },
    session.library,
  );
  return {
    loadPage(raw) {
      const page = pageDocSchema.parse(raw);
      session.history.run(t("history.editedPage"), (draft) => syncDraft(draft.page, page));
      session.history.clear();
    },
    addSteps(count) {
      for (let step = 0; step < count; step++) {
        session.history.run(label, (draft) => {
          const heading = firstHeading(draft.page.content);
          if (heading !== undefined) {
            heading.props.size = heading.props.size === "large" ? "medium" : "large";
          }
        });
      }
    },
  };
}

/** Installs the hooks on `window` for the performance tests. */
export function installPerfHooks(session: EditorSession): void {
  window.__webforgePerf = createPerfHooks(session);
}
