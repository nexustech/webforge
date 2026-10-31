import type { FieldRenderer } from "@webforge/editor-ui";
import { imageFieldRenderer } from "../../media/index.js";
import type { FieldRendererContext } from "../field-context.js";

/** The Edit panel's image fields (`media` fields, F-ED-5): Media's own field, with its picker. */
export const imageField = ({
  api,
  session,
  imagePicks,
}: FieldRendererContext): FieldRenderer<"image"> =>
  imageFieldRenderer({ session, media: api.media, picks: imagePicks });
