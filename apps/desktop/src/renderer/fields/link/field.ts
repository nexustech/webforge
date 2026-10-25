import type { FieldRenderer } from "@webforge/editor-ui";
import { linkFieldRenderer } from "../../links/index.js";
import type { FieldRendererContext } from "../field-context.js";

/** The Edit panel's link fields (F-ED-18): the links area's own field, with its dialog. */
export const linkField = ({ session }: FieldRendererContext): FieldRenderer<"link"> =>
  linkFieldRenderer({ session });
