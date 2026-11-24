import { t } from "@webforge/i18n";
import { imageChangeOf } from "@webforge/model";

/**
 * How an undo step names the field of `item` a change set, lower-case as in "Changed Hero title".
 * An image field is named by what the change set (#1370): its alt text when only that changed
 * ("Changed Hero alt text"), else the field, called "picture" where it is named like its element,
 * so an Image's picture is "Changed Image picture" and not "Changed Image image". `before` and
 * `after` are the field's values, when the change is known. The Edit panel and AI apps name a
 * change alike.
 */
export function fieldInLabel(
  item: string,
  field: { readonly kind: string; readonly label: string },
  before?: unknown,
  after?: unknown,
): string {
  const name = field.label.toLowerCase();
  if (field.kind !== "media") return name;
  if (imageChangeOf(before, after) === "alt") return t("history.part.alt");
  return name === item.toLowerCase() ? t("history.part.picture") : name;
}
