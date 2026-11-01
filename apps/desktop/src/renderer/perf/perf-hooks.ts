import { syncDraft } from "@webforge/history";
import { t } from "@webforge/i18n";
import { findNode, pageDocSchema } from "@webforge/model";
import { currentPage, type EditorSession } from "../editor/editor-session.js";
import { labelFor } from "../editor/labels.js";

// Hooks for the large-page performance check (spec/04 item 0.4, ADR 0007). Only builds made with
// `electron-vite build --mode perf` load this module (see App.tsx); normal builds never include it.

/** What the performance tests can call on `window.__webforgePerf`. */
export type PerfHooks = {
  /** Replaces the current page with `page` (validated) and forgets the history, to start clean. */
  loadPage(page: unknown): void;
  /** Adds `count` history steps, each toggling the first heading's size (a real props edit). */
  addSteps(count: number): void;
  /**
   * Turns the theme's italic look for Heading on, or off again, as one history step: a theme
   * change the canvas draws by drawing the whole page again (`setLooks`, A25).
   */
  toggleHeadingLook(): void;
  /**
   * When the site last changed (`Date.now()`), or 0: where the preview's timing starts (3.2), as
   * the edit lands, apart from the clicks and dialogs that made it.
   */
  lastChange(): number;
};

declare global {
  interface Window {
    __webforgePerf?: PerfHooks;
  }
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
      page: currentPage(session)?.doc ?? { root: { props: {} }, content: [] },
      selection: null,
    },
    session.library,
  );
  let changed = 0;
  session.history.document.subscribe(() => {
    changed = Date.now();
  });
  return {
    lastChange: () => changed,
    loadPage(raw) {
      const page = pageDocSchema.parse(raw);
      const { pageId } = session.ui.getState();
      session.history.run(t("history.editedPage"), (draft) => {
        const target = draft.pages[pageId];
        if (target !== undefined) syncDraft(target.doc, page);
      });
      session.history.clear();
    },
    addSteps(count) {
      for (let step = 0; step < count; step++) {
        const { pageId } = session.ui.getState();
        session.history.run(label, (draft) => {
          const content = draft.pages[pageId]?.doc.content ?? [];
          const heading = findNode(content, (node) => node.type === "Heading");
          if (heading !== undefined) {
            heading.props.size = heading.props.size === "large" ? "medium" : "large";
          }
        });
      }
    },
    toggleHeadingLook() {
      const on = session.history.document.getState().theme.looks?.Heading?.lookItalic !== true;
      const item = session.library.components.Heading?.label ?? "Heading";
      const label = t(on ? "theme.history.look" : "theme.history.lookReset", { item });
      session.history.run(label, (draft) => {
        const { Heading: _heading, ...others } = draft.theme.looks ?? {};
        const looks = on ? { ...others, Heading: { lookItalic: true } } : others;
        if (Object.keys(looks).length === 0) delete draft.theme.looks;
        else draft.theme.looks = looks;
      });
    },
  };
}

/** Installs the hooks on `window` for the performance tests. */
export function installPerfHooks(session: EditorSession): void {
  window.__webforgePerf = createPerfHooks(session);
}
