import type { FieldRenderer } from "@webforge/editor-ui";
import { CodeField } from "./CodeField.js";

/** The Edit panel's code fields. */
export const codeField = (): FieldRenderer<"code"> => CodeField;
