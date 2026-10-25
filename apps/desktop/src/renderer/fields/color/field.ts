import type { FieldRenderer } from "@webforge/editor-ui";
import { textStylesOf } from "@webforge/site-components";
import { fieldTarget } from "../../editor/field-target.js";
import type { FieldRendererContext } from "../field-context.js";
import { colourFieldRenderer } from "./ColourField.js";

/**
 * The Edit panel's colour fields (1.37, UX-25): the theme's own colours and a contrast warning, for
 * the selected element's text styles wherever it is (the page, the shared Header or Footer, a
 * linked copy), as the Edit panel finds it.
 */
export const colourField = ({
  session,
  preferences,
}: FieldRendererContext): FieldRenderer<"color"> =>
  colourFieldRenderer({
    session,
    preferences,
    textStyles: () => {
      const { pageId, nodeId } = session.ui.getState();
      const target = fieldTarget(
        session.history.document.getState(),
        session.library,
        pageId,
        nodeId,
      );
      return target === undefined ? [] : textStylesOf(target.node, session.library);
    },
  });
