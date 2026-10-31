import { siteLibrary } from "@webforge/site-components";
import { createElement } from "react";
import type { Area, WindowContext } from "../editor/areas.js";
import { describePlace } from "../site-check/index.js";
import { CodeTrustDialog } from "./CodeTrustDialog.js";

/**
 * The code trust step's prompt (#649), drawn once in the window: export and Preview ask through
 * the window's `codeTrust` before the site's code runs.
 */
export const codeTrustArea: Area<WindowContext> = {
  id: "codeTrust",
  register: ({ codeTrust, session, windowDialogs }) =>
    windowDialogs.register({
      id: "codeTrust",
      component: () =>
        createElement(CodeTrustDialog, {
          state: codeTrust.question,
          elementPlace: ({ on, nodeId }) =>
            describePlace(
              { key: "", place: { kind: "element", on, nodeId } },
              session.history.document.getState(),
              siteLibrary,
            ),
        }),
    }),
};
