import type { FieldRenderer } from "@webforge/editor-ui";
import type { FieldRendererContext } from "../field-context.js";
import { classesFieldRenderer } from "./ClassesField.js";

/**
 * The Edit panel's CSS classes field (Advanced mode, F-ED-11, #276): suggestions as a class is
 * typed, a browser of every class the site's styles support, and a warning for one that makes none.
 */
export const classesField = ({ api, session }: FieldRendererContext): FieldRenderer<"classes"> =>
  classesFieldRenderer({ session, canvas: () => api.canvas });
