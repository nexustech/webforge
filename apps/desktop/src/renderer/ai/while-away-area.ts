import { t } from "@webforge/i18n";
import { pageEntryOf, pageIdSchema } from "@webforge/model";
import { createElement } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { AiRequest, AiResponse } from "../../shared/ipc/ai.js";
import type { ListVersionsResult } from "../../shared/ipc/versions.js";
import type { EditorSession } from "../editor/editor-session.js";
import type { VersionActions } from "../editor/version-history.js";
import { reportFailure } from "../log.js";
import type { WindowDialogRegistry } from "../shell/window-dialogs.js";
import { WhileAwayDialog } from "./WhileAwayDialog.js";
import { type AwayChange, createAwayLog, groupAway, versionBefore } from "./while-away.js";

/** What *While you were away* works with; the window's own in the app, fakes in tests. */
export type WhileAwayDeps = {
  readonly windowDialogs: Pick<WindowDialogRegistry, "register">;
  readonly session: Pick<EditorSession, "history" | "showPage">;
  /** The open site's versions, newest first, as main lists them. */
  readonly listVersions: () => Promise<ListVersionsResult>;
  readonly restore: VersionActions["restore"];
  /** Says what went wrong, in the window's toasts. */
  readonly notify: (message: string) => void;
  /** Whether the person is at the window: it has the focus. */
  readonly present: () => boolean;
  /** Calls `listener` each time the person comes back to the window; returns how to stop. */
  readonly onReturn: (listener: () => void) => () => void;
  readonly now?: () => number;
};

/** *While you were away*, once registered. */
export type WhileAway = {
  /** Keeps a change an app made unasked while the person was away, from its request and answer. */
  heard(request: AiRequest, response: AiResponse): void;
  /** Removes the dialog and stops following the person's comings and goings. */
  remove(): void;
};

/**
 * Registers *While you were away* (5.36, UA-3): each change an AI app makes without asking (5.35)
 * while the window doesn't have the focus is kept, and shown in a dialog when the person comes
 * back, by app and page. **Undo All** restores the version before the app's first change, through
 * Version History, as one undo step.
 */
export function registerWhileAway(deps: WhileAwayDeps): WhileAway {
  const now = deps.now ?? Date.now;
  const log = createAwayLog();
  /** The changes the dialog shows, and the app whose Undo All is under way. */
  const shown = createStore<{ readonly changes: readonly AwayChange[]; readonly undoing?: string }>(
    () => ({ changes: [] }),
  );
  const close = () => shown.setState({ changes: [] }, true);
  const pageTitle = (pageId: string) =>
    pageEntryOf(deps.session.history.document.getState().pages, pageId)?.title;

  const undoAll = async (app: string) => {
    const [group] = groupAway(
      shown.getState().changes.filter((change) => change.app === app),
      pageTitle,
    );
    if (group === undefined) return;
    shown.setState({ undoing: app });
    try {
      const listed = await deps.listVersions();
      if (listed.status !== "ok") {
        deps.notify(t("ai.away.failed"));
        return;
      }
      const version = versionBefore(listed.versions, group.firstAt);
      if (version === undefined) {
        deps.notify(t("ai.away.noVersion", { app }));
        return;
      }
      if (await deps.restore(version)) {
        // The restore took back every change made since the version, another app's too: none of
        // them is listed any more, and the dialog closes with the last.
        const since = Date.parse(version.createdAt);
        const changes = shown.getState().changes.filter((change) => change.at < since);
        shown.setState({ changes });
      }
    } catch (error) {
      reportFailure("ai.away.undoAll", error);
      deps.notify(t("ai.away.failed"));
    } finally {
      const { undoing: _done, ...rest } = shown.getState();
      shown.setState(rest, true);
    }
  };

  function Dialog() {
    const { changes, undoing } = useStore(shown);
    return createElement(WhileAwayDialog, {
      open: changes.length > 0,
      apps: groupAway(changes, pageTitle),
      undoing,
      onShowPage: (pageId) => {
        // A page the site has: the id came from the app's answer.
        const page = pageIdSchema.safeParse(pageId);
        if (page.success && pageTitle(page.data) !== undefined) deps.session.showPage(page.data);
        close();
      },
      onUndoAll: (app) => void undoAll(app),
      onClose: close,
    });
  }

  const removeDialog = deps.windowDialogs.register({ id: "aiWhileAway", component: Dialog, close });
  const stopFollowing = deps.onReturn(() => {
    const taken = log.take();
    // Kept with any still shown: the dialog shows all of them.
    if (taken.length > 0) shown.setState({ changes: [...shown.getState().changes, ...taken] });
  });

  return {
    heard(request, response) {
      if (request.kind !== "command" || request.unasked !== true || deps.present()) return;
      if (response.status !== "done" || !("label" in response)) return;
      log.record({
        app: request.app,
        label: response.label,
        pageId: response.target?.pageId,
        at: now(),
      });
    },
    remove() {
      stopFollowing();
      removeDialog();
    },
  };
}
