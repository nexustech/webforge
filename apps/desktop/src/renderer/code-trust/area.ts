import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { SiteCodePiece, SiteDoc } from "@webforge/model";
import { type ComponentLibrary, siteLibrary } from "@webforge/site-components";
import { createElement } from "react";
import type { Area, WindowContext } from "../editor/areas.js";
import { createCodeTrust } from "../editor/code-trust.js";
import { provide } from "../editor/services.js";
import { TrustedCode } from "../editor/window-services.js";
import { describePlace, jumpTo } from "../site-check/index.js";
import { siteSession } from "../storage/index.js";
import { CodeTrustDialog } from "./CodeTrustDialog.js";

/**
 * Where the prompt says a Custom Code element is: as Site Check says, but "Custom Code element on
 * Home" on a page (product owner, 1 Nov 2026, #732).
 */
export function codeElementPlace(
  { on, nodeId }: Extract<SiteCodePiece, { kind: "element" }>,
  site: SiteDoc,
  library: ComponentLibrary,
): string {
  return describePlace(
    { key: "", place: { kind: "element", on, nodeId } },
    site,
    library,
    (element, page) => t("site.code.trust.place.page", { element, page }),
  );
}

/**
 * The code trust step's prompt (#649), drawn once in the window: export and Preview ask through
 * the window's `codeTrust` before the site's code runs. It follows what the owner writes while the
 * window's areas are connected.
 */
export const codeTrustArea: Area<WindowContext> = {
  id: "codeTrust",
  provides: [
    provide(TrustedCode, ({ api, session, panels, settings, commands }: WindowContext) =>
      createCodeTrust({
        api: api.trust,
        session,
        sessionId: siteSession,
        // Review: Settings' Custom Code, or the element, as Site Check shows a finding there.
        review: (piece) =>
          jumpTo(
            piece.kind === "element"
              ? { kind: "element", on: piece.on, nodeId: piece.nodeId }
              : { kind: "code", part: piece.kind === "code" ? piece.part : "head" },
            { session, panels, settings, commands, openGuide: () => {} },
          ),
        notify: () => toast.error(t("site.code.trust.failed")),
      }),
    ),
  ],
  register: ({ session, windowDialogs, use }) => {
    const codeTrust = use(TrustedCode);
    const disconnect = codeTrust.connect();
    const removeDialog = windowDialogs.register({
      id: "codeTrust",
      component: () =>
        createElement(CodeTrustDialog, {
          state: codeTrust.question,
          elementPlace: (piece) =>
            codeElementPlace(piece, session.history.document.getState(), siteLibrary),
        }),
    });
    return () => {
      removeDialog();
      disconnect();
    };
  },
};
