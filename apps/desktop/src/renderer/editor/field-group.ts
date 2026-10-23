import type { FieldDef } from "@webforge/site-components";

/**
 * The Edit panel tab a field goes on: its own `group`, else Content for text, images and links,
 * else Style. Copy Style (1.37) copies the Style ones.
 */
export function fieldGroupOf(field: FieldDef): "content" | "style" {
  return (
    field.group ??
    (field.kind === "text" || field.kind === "media" || field.kind === "link" ? "content" : "style")
  );
}
