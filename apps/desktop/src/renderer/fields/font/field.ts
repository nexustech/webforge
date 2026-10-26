import type { FieldRenderer } from "@webforge/editor-ui";
import type { FontsApi } from "../../../shared/ipc/fonts.js";
import { fontFieldRenderer } from "./FontField.js";

/**
 * The Theme tab's font fields (2.3a, 2.3c): a font the computer has, bundled or downloaded, or one
 * of Fontsource's, downloaded once chosen, from the font picker.
 */
export const fontField = (
  fonts: () => FontsApi = () => window.webforge.fonts,
): FieldRenderer<"font"> => fontFieldRenderer(fonts);
