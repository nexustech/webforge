import type { FieldRenderer, FieldRendererProps } from "@webforge/editor-ui";
import { createElement } from "react";
import type { FieldRendererContext } from "../field-context.js";
import { PagesField } from "./PagesField.js";

/** The Edit panel's pages fields (HF-8): the site's pages, as checkboxes. */
export const pagesField = ({ session }: FieldRendererContext): FieldRenderer<"pages"> =>
  function SessionPagesField(props: FieldRendererProps<"pages">) {
    return createElement(PagesField, { ...props, session });
  };
