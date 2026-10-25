import { type MessageKey, t } from "@webforge/i18n";
import {
  copyTheme,
  type FontRef,
  type Oklch,
  type TEXT_SIZES,
  type TextStyle,
  type ThemeTokens,
} from "@webforge/model";
import type { FontPairing } from "@webforge/themes";
import { catalogueFont, fontRefOf } from "@webforge/themes";
import type { EditorSession } from "../editor/editor-session.js";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";
import { setTokenValue, type TokenControl, tokenValue } from "./theme-controls.js";

/** What the theme's edits change the site through: its history, as labelled undo steps. */
type ThemeSession = Pick<EditorSession, "edit"> & {
  readonly history: Pick<EditorSession["history"], "document">;
};

/** Asks before a change to every page (D7); without it, changes happen at once. */
type Confirm = Pick<SiteWideConfirm, "confirmSiteWide"> | undefined;

/** The colours the Theme tab offers by the glossary's names (23 Oct 2026). */
export const QUICK_COLORS = ["primary", "secondary", "accent", "base-100", "base-content"] as const;

/** One of {@link QUICK_COLORS}. */
export type QuickColor = (typeof QUICK_COLORS)[number];

/** The brand colours, which reversed sections take in their own lightness (#200). */
const BRAND_COLORS: readonly QuickColor[] = ["primary", "secondary", "accent"];

/** Each colour's name (glossary) and its undo step's. */
export const COLOR_WORDS: Readonly<
  Record<QuickColor, { readonly name: MessageKey; readonly history: MessageKey }>
> = {
  primary: { name: "colour.role.brand", history: "theme.history.color.brand" },
  secondary: { name: "colour.role.accent", history: "theme.history.color.accent" },
  accent: { name: "colour.role.secondAccent", history: "theme.history.color.secondAccent" },
  "base-100": { name: "colour.role.surface", history: "theme.history.color.surface" },
  "base-content": { name: "colour.role.text", history: "theme.history.color.text" },
};

/** A preset's name (`theme.preset.<name>`). */
export const presetName = (preset: string) => t(`theme.preset.${preset}` as MessageKey);

/** How many pages a theme change changes: all of them. */
const pageCount = (session: ThemeSession) =>
  Object.keys(session.history.document.getState().pages).length;

const theme = (session: ThemeSession) => session.history.document.getState().theme;

/** Asks `confirm`, if there is one, before `action` changes every page. */
async function confirmed(
  session: ThemeSession,
  confirm: Confirm,
  action: { readonly action: string; readonly description: string; readonly confirm: string },
): Promise<boolean> {
  if (confirm === undefined) return true;
  return confirm.confirmSiteWide({ ...action, affectedPages: pageCount(session) });
}

/** Sets a token the Theme tab offers as a choice: one step, named for its group. */
export function setToken(session: ThemeSession, control: TokenControl, value: unknown): void {
  if (tokenValue(theme(session), control) === value) return;
  session.edit("props", t(`theme.history.${control.group}` as MessageKey), (draft) => {
    setTokenValue(draft.theme, control, value);
  });
}

/** Sets the size of text style `style`: one step, "Changed text size for Heading 1". */
export function setTextSize(
  session: ThemeSession,
  style: TextStyle,
  size: (typeof TEXT_SIZES)[number],
): void {
  if (theme(session).typeScale[style].size === size) return;
  session.edit(
    "props",
    t("theme.history.textSize", { style: t(`theme.textStyle.${style}`) }),
    (draft) => {
      draft.theme.typeScale[style].size = size;
    },
  );
}

/**
 * Switches the theme to `preset` (D7): asked first, with the pages it changes, then one step,
 * "Changed theme to 'Bistro'". The preset's tokens replace the theme's, colours and fonts too.
 */
export async function switchPreset(
  session: ThemeSession,
  confirm: Confirm,
  preset: ThemeTokens,
): Promise<boolean> {
  const name = presetName(preset.preset);
  const ok = await confirmed(session, confirm, {
    action: t("theme.preset.confirm", { name }),
    description: t("theme.preset.confirmDescription"),
    confirm: t("theme.preset.confirmButton"),
  });
  if (!ok) return false;
  session.edit("props", t("theme.history.preset", { name }), (draft) => {
    draft.theme = copyTheme(preset);
  });
  return true;
}

/**
 * Sets colour `role` (D7): asked first, then one step ("Changed brand colour"). A brand colour on a
 * theme with colours for reversed sections changes there too, in the same step: to its hue and
 * chroma, at the lightness reversed sections have it (#200, decided for 2.3a). Surface and Text
 * leave reversed sections as they are: those are meant to be the opposite.
 */
export async function setColor(
  session: ThemeSession,
  confirm: Confirm,
  role: QuickColor,
  color: Oklch,
): Promise<boolean> {
  const now = theme(session).colors[role];
  if (now.l === color.l && now.c === color.c && now.h === color.h) return false;
  const name = t(COLOR_WORDS[role].name);
  const ok = await confirmed(session, confirm, {
    action: t("theme.color.confirm", { name }),
    description: t("theme.color.confirmDescription"),
    confirm: t("theme.color.confirmButton"),
  });
  if (!ok) return false;
  session.edit("props", t(COLOR_WORDS[role].history), (draft) => {
    draft.theme.colors[role] = { ...color };
    const reversed = draft.theme.inverse?.[role];
    if (reversed !== undefined && BRAND_COLORS.includes(role)) {
      reversed.c = color.c;
      reversed.h = color.h;
    }
  });
  return true;
}

/** Sets the fonts (D7): asked first, then one step, "Changed fonts". */
async function setFonts(
  session: ThemeSession,
  confirm: Confirm,
  fonts: { readonly heading: FontRef; readonly body: FontRef },
): Promise<boolean> {
  const now = theme(session).fonts;
  if (now.heading.family === fonts.heading.family && now.body.family === fonts.body.family) {
    return false;
  }
  const ok = await confirmed(session, confirm, {
    action: t("theme.fonts.confirm"),
    description: t("theme.fonts.confirmDescription"),
    confirm: t("theme.fonts.confirmButton"),
  });
  if (!ok) return false;
  session.edit("props", t("theme.history.fonts"), (draft) => {
    draft.theme.fonts = { heading: { ...fonts.heading }, body: { ...fonts.body } };
  });
  return true;
}

/** Sets the headings' or the body text's font: see {@link setFonts}. */
export function setFont(
  session: ThemeSession,
  confirm: Confirm,
  which: "heading" | "body",
  font: FontRef,
): Promise<boolean> {
  return setFonts(session, confirm, { ...theme(session).fonts, [which]: font });
}

/** Sets both fonts to a tested pairing's (F-DS-2): see {@link setFonts}. */
export function setPairing(
  session: ThemeSession,
  confirm: Confirm,
  pairing: FontPairing,
): Promise<boolean> {
  const heading = catalogueFont(pairing.heading);
  const body = catalogueFont(pairing.body);
  if (heading === undefined || body === undefined) return Promise.resolve(false);
  return setFonts(session, confirm, { heading: fontRefOf(heading), body: fontRefOf(body) });
}
