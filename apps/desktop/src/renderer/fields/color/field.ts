import type { FieldRenderer } from "@webforge/editor-ui";
import { textStylesOf } from "@webforge/site-components";
import { fieldTarget } from "../../editor/field-target.js";
import type { FieldRendererContext } from "../field-context.js";
import { colourFieldRenderer } from "./ColourField.js";

/**
 * The Edit panel's colour fields (1.37, UX-25): the theme's own colours and a contrast warning, for
 * the selected element's text styles wherever it is (the page, the shared Header or Footer, a
 * linked copy), as the Edit panel finds it; *Style this ‹kind›…*'s too (3.13a).
 */
export const colourField = ({
  session,
  preferences,
}: Pick<FieldRendererContext, "session" | "preferences">): FieldRenderer<"color"> =>
  colourFieldRenderer({
    session,
    preferences,
    textStyles: () => {
      const { pageId, nodeId } = session.ui.getState();
      const site = session.history.document.getState();
      const target = fieldTarget(site, session.library, pageId, nodeId);
      // With its kind's look (3.12): a look's size or weight sets the large-text threshold too.
      return target === undefined
        ? []
        : textStylesOf(target.node, session.library, site.theme.looks);
    },
  });
