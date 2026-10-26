import type { FieldRenderer } from "@webforge/editor-ui";
import { ThemeColorField } from "./ThemeColorField.js";

/** The Theme tab's colours (2.3a): a colour of the theme, and its contrast warnings. */
export const themeColorField = (): FieldRenderer<"themeColor"> => ThemeColorField;
