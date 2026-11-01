import { t } from "@webforge/i18n";
import type { SiteCodePiece, SiteDoc } from "@webforge/model";
import { type ComponentLibrary, siteLibrary } from "@webforge/site-components";
import { createElement } from "react";
import type { Area, WindowContext } from "../editor/areas.js";
import { describePlace } from "../site-check/index.js";
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
  register: ({ codeTrust, session, windowDialogs }) => {
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
