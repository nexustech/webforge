import type { FieldRenderer } from "@webforge/editor-ui";
import { createElement } from "react";
import { ThemeColorField, type ThemeColorPreview } from "./ThemeColorField.js";

/**
 * The Theme tab's colours (2.3a): a colour of the theme, and its contrast warnings; with
 * `preview`, what shows the colour named `name` while it's dragged (5.30).
 */
export const themeColorField = (
  preview?: (name: string) => ThemeColorPreview | undefined,
): FieldRenderer<"themeColor"> =>
  preview === undefined
    ? ThemeColorField
    : function PreviewedThemeColorField(props) {
        return createElement(ThemeColorField, { ...props, preview: preview(props.name ?? "") });
      };
