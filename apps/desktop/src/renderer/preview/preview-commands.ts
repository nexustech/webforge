import { t } from "@webforge/i18n";
import { type PageId, pagePath, type SiteDoc } from "@webforge/model";
import { type ComponentLibrary, siteContentFor } from "@webforge/site-components";
import type { StoreApi } from "zustand/vanilla";
import type { PreviewApi, PreviewPage } from "../../shared/ipc/preview.js";
import type { CodeDecision } from "../editor/code-trust.js";
import type { EditorSession } from "../editor/editor-session.js";
import { reportFailure } from "../log.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { CommandRegistry } from "../shell/commands.js";
import type { PhoneState } from "./PhonePreviewDialog.js";

/** At most one change of the site sent in this long: the first at once, the last at its end. */
export const PREVIEW_UPDATE_MS = 100;

/** What the preview commands work on and with. */
export type PreviewCommandsDeps = {
  readonly session: Pick<EditorSession, "history" | "ui">;
  readonly library: ComponentLibrary;
  readonly api: PreviewApi;
  /** The opening of the site this page was loaded for, sent with the site (R6, #663). */
  readonly sessionId: () => string;
  /** The phone dialog's state: the Preview on Phone command opens it. */
  readonly phone: StoreApi<PhoneState>;
  /** Tells the person something went wrong. */
  readonly notify: (message: string) => void;
  /**
   * Asks about the site's code its owner hasn't written here or confirmed (#649), before a preview
   * runs it in their browser or on their phone.
   */
  readonly confirmCode: (site: SiteDoc) => Promise<CodeDecision>;
  /**
   * Calls `listener` when more of the site's code is trusted, which the preview then builds with:
   * code the owner has just written is trusted a moment after their last change (#649).
   */
  readonly onCodeTrusted: (listener: () => void) => () => void;
};

/** The file of page `pageId` in the preview, as the build names it: `index.html`, `about.html`. */
export function previewPageOf(site: SiteDoc, pageId: PageId): PreviewPage {
  const page = site.pages[pageId];
  return page === undefined ? "index.html" : `${pagePath(page, site.homePageId)}.html`;
}

/**
 * Registers File → Preview (the title bar's Preview button, Ctrl/Cmd+I) and File → Preview on
 * Phone… (3.2, F-PV-1). Each first asks about code the owner hasn't written here or confirmed
 * (#649). Preview opens the site at the page shown in the default browser. Once
 * either has run, the preview follows the editor: each change of the site goes to it, at most one
 * every {@link PREVIEW_UPDATE_MS} (the first at once, so a lone change shows at once), and the page
 * shown, so the browser goes there. Returns a function that removes them and stops following.
 */
export function registerPreviewCommands(
  registry: CommandRegistry,
  deps: PreviewCommandsDeps,
): () => void {
  const { session, library, api, sessionId, phone, notify, confirmCode, onCodeTrusted } = deps;
  /** Runs `start` once the owner has said what to do with code they haven't confirmed (#649). */
  const afterCode = (start: () => void) => {
    confirmCode(site())
      .then((code) => {
        if (code.go) start();
      })
      .catch((error: unknown) => reportFailure("preview.code", error));
  };
  const site = () => session.history.document.getState();
  const content = () => siteContentFor(site(), library);
  const page = () => previewPageOf(site(), session.ui.getState().pageId);

  let following: (() => void) | undefined;

  // Stop Phone Preview (3.2): registered while a phone can open the preview, so the title bar
  // shows it is on, and in the File menu; it stops only the phone's listener.
  let stopping: (() => void) | undefined;
  const phoneOff = () => {
    stopping?.();
    stopping = undefined;
  };
  const phoneOn = () => {
    if (stopping !== undefined) return;
    stopping = registry.register({
      id: COMMAND_IDS.stopPhonePreview,
      label: t("command.stopPhonePreview"),
      menu: "file",
      run: () => {
        api
          .stopPhone()
          .then(() => {
            phoneOff();
            if (phone.getState().status === "ready") phone.setState({ status: "closed" }, true);
          })
          .catch((error: unknown) => reportFailure("preview.stopPhone", error));
      },
    });
  };
  // Main stops the phone's listener by itself once no phone has used it for a while, or the
  // computer left its network (S9): the cue goes, the address shown goes, and the person is told.
  const stopPhoneStopped = api.onPhoneStopped(() => {
    phoneOff();
    if (phone.getState().status === "ready") phone.setState({ status: "closed" }, true);
    notify(t("preview.phone.stopped"));
  });
  const follow = () => {
    if (following !== undefined) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let changedSince = false;
    const send = () => {
      api
        .update(sessionId(), content())
        .catch((error: unknown) => reportFailure("preview.update", error));
      timer = setTimeout(() => {
        timer = undefined;
        if (changedSince) {
          changedSince = false;
          send();
        }
      }, PREVIEW_UPDATE_MS);
    };
    const changed = () => {
      if (timer === undefined) send();
      else changedSince = true;
    };
    const stopSite = session.history.document.subscribe(changed);
    // Main builds only trusted code: once more is trusted, the preview builds again to show it.
    const stopTrusted = onCodeTrusted(changed);
    const stopPage = session.ui.subscribe((ui, before) => {
      if (ui.pageId === before.pageId) return;
      api.show(page()).catch((error: unknown) => reportFailure("preview.show", error));
    });
    following = () => {
      stopSite();
      stopTrusted();
      stopPage();
      if (timer !== undefined) clearTimeout(timer);
    };
  };

  const removers = [
    registry.register({
      id: COMMAND_IDS.preview,
      label: t("command.preview"),
      menu: "file",
      run: () =>
        afterCode(() => {
          follow();
          api
            .open(sessionId(), content(), page())
            .then((opened) => {
              if (opened === "failed") notify(t("preview.failed"));
            })
            .catch((error: unknown) => {
              reportFailure("preview.open", error);
              notify(t("preview.failed"));
            });
        }),
    }),
    registry.register({
      id: COMMAND_IDS.previewOnPhone,
      label: t("command.previewOnPhone"),
      menu: "file",
      run: () =>
        afterCode(() => {
          follow();
          phone.setState({ status: "starting" }, true);
          api
            .phone(sessionId(), content(), page())
            .then((address) => {
              // A phone can open it now, dialog open or not: the title bar says so until it stops.
              if (address.status === "ready") phoneOn();
              // Closed while it started: it stays closed.
              if (phone.getState().status === "starting") phone.setState(address, true);
            })
            .catch((error: unknown) => {
              reportFailure("preview.phone", error);
              if (phone.getState().status === "starting") {
                phone.setState({ status: "failed" }, true);
              }
            });
        }),
    }),
  ];
  return () => {
    for (const remove of removers) remove();
    stopPhoneStopped();
    phoneOff();
    following?.();
    following = undefined;
  };
}
