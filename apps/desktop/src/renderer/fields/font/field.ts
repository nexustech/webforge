import type { FieldRenderer } from "@webforge/editor-ui";
import { FontField } from "./FontField.js";

/** The Theme tab's font fields (2.3a): one of the app's fonts, chosen in the font picker. */
export const fontField = (): FieldRenderer<"font"> => FontField;
