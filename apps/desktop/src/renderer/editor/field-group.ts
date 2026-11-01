import type { FieldDef } from "@webforge/site-components";

/**
 * The Edit panel tab a field goes on: its own `group`, else Content for text, images, links, icons
 * and code, else Style. Copy Style (1.37) copies the Style ones, so it never carries a Custom Code
 * element's code to another (#649).
 */
export function fieldGroupOf(field: FieldDef): "content" | "style" {
  return (
    field.group ??
    (field.kind === "text" ||
    field.kind === "media" ||
    field.kind === "link" ||
    field.kind === "icon" ||
    field.kind === "code"
      ? "content"
      : "style")
  );
}
