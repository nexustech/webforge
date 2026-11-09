import { isMessageKey, t } from "@webforge/i18n";

/**
 * A page recipe's name in the editor (QS-3), or its page's own title should it have none. A module
 * of its own, so the start screen's Quick start takes it without the Pages panel (#896).
 */
export function recipeName(id: string, title: string): string {
  const key = `recipe.${id}`;
  return isMessageKey(key) ? t(key) : title;
}
