import type { FieldRenderer } from "@webforge/editor-ui";
import { IconField } from "./IconField.js";

/** The Edit panel's icon fields (F-ED-22): one of Lucide's icons, chosen in a searchable picker. */
export const iconField = (): FieldRenderer<"icon"> => IconField;
