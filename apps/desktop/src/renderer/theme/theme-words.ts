import { isMessageKey, t } from "@webforge/i18n";

/**
 * A message whose key is made at run time from the theme's schema (`theme.token.<path>`), if the
 * catalogue has it: a test checks every key the Theme tab and Theme Studio make.
 */
export const named = (key: string): string | undefined => (isMessageKey(key) ? t(key) : undefined);
