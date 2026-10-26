import { isMessageKey, type MessageKey, t } from "@webforge/i18n";
import {
  type ColorRole,
  copyTheme,
  type FontRef,
  type Oklch,
  type TEXT_SIZES,
  type TextStyle,
  type ThemeTokens,
} from "@webforge/model";
import type { BrandProposal, FontPairing } from "@webforge/themes";
import { catalogueFont, fontRefOf, inverseColors } from "@webforge/themes";
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
const BRAND_COLORS: readonly ColorRole[] = ["primary", "secondary", "accent"];

/**
 * Sets page colour `role` in `tokens`, a draft being changed: the one rule for the page's colours,
 * wherever they change (the Theme tab, Theme Studio's Page column, colours from an image; #200,
 * #457 review). A brand colour carries its hue and chroma into reversed sections, at the lightness
 * they have it, when the theme has reversed colours of its own; a theme without them shows its page
 * colours there, so they follow as they are. Only Theme Studio's Reversed column changes reversed
 * sections' colours on their own.
 */
function setPageColor(tokens: ThemeTokens, role: ColorRole, color: Oklch): void {
  tokens.colors[role] = { ...color };
  const reversed = tokens.inverse?.[role];
  if (reversed !== undefined && BRAND_COLORS.includes(role)) {
    reversed.c = color.c;
    reversed.h = color.h;
  }
}

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

/**
 * Every colour role's name, as Theme Studio's palette rows show it: the glossary's Brand, Accent,
 * Second accent, Surface and Text, the surfaces after them, and each colour's text.
 */
export const ROLE_NAMES: Readonly<Record<ColorRole, MessageKey>> = {
  "base-100": "colour.role.surface",
  "base-200": "theme.role.surface2",
  "base-300": "theme.role.surface3",
  "base-content": "colour.role.text",
  primary: "colour.role.brand",
  "primary-content": "theme.role.onBrand",
  secondary: "colour.role.accent",
  "secondary-content": "theme.role.onAccent",
  accent: "colour.role.secondAccent",
  "accent-content": "theme.role.onSecondAccent",
  neutral: "theme.role.neutral",
  "neutral-content": "theme.role.onNeutral",
  info: "theme.role.info",
  "info-content": "theme.role.onInfo",
  success: "theme.role.success",
  "success-content": "theme.role.onSuccess",
  warning: "theme.role.warning",
  "warning-content": "theme.role.onWarning",
  error: "theme.role.error",
  "error-content": "theme.role.onError",
};

/** A preset's name (`theme.preset.<name>`); its own name for one the catalogue hasn't named yet. */
export function presetName(preset: string): string {
  const key = `theme.preset.${preset}`;
  return isMessageKey(key) ? t(key) : preset;
}

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

/** How a text style looks: its size, weight and line height. */
type TextStep = ThemeTokens["typeScale"][TextStyle];

/**
 * Sets text style `style`'s size, weight or line height (Theme Studio): one step, "Changed text
 * style for Heading 1", or none if nothing changes.
 */
export function setTextStep(
  session: ThemeSession,
  style: TextStyle,
  change: Partial<TextStep>,
): void {
  const now = theme(session).typeScale[style];
  const next = { ...now, ...change };
  if (next.size === now.size && next.weight === now.weight && next.leading === now.leading) return;
  session.edit(
    "props",
    t("theme.history.textStyle", { style: t(`theme.textStyle.${style}`) }),
    (draft) => {
      draft.theme.typeScale[style] = next;
    },
  );
}

/**
 * Sets colour `role` of the page's colours or reversed sections' (Theme Studio, F-DS-7): asked
 * first (D7), then one step, "Changed Brand colour in reversed sections". A page colour follows the
 * one rule for page colours ({@link setPageColor}): a brand colour's hue reaches reversed sections.
 * A reversed colour changes there alone; a theme without reversed colours of its own starts them
 * from those it shows there ({@link inverseColors}).
 */
export async function setPaletteColor(
  session: ThemeSession,
  confirm: Confirm,
  palette: "colors" | "inverse",
  role: ColorRole,
  color: Oklch,
): Promise<boolean> {
  const tokens = theme(session);
  const now = (palette === "colors" ? tokens.colors : inverseColors(tokens))[role];
  if (now.l === color.l && now.c === color.c && now.h === color.h) return false;
  const name = t(ROLE_NAMES[role]);
  const reversed = palette === "inverse";
  const ok = await confirmed(session, confirm, {
    action: reversed
      ? t("theme.color.confirmReversed", { name })
      : t("theme.color.confirm", { name }),
    description: t("theme.color.confirmDescription"),
    confirm: t("theme.color.confirmButton"),
  });
  if (!ok) return false;
  // Reversed sections' colours as the theme shows them now, copied, for a theme without its own.
  const start = JSON.parse(JSON.stringify(inverseColors(theme(session)))) as ThemeTokens["colors"];
  session.edit(
    "props",
    reversed ? t("theme.history.colorReversed", { name }) : t("theme.history.color", { name }),
    (draft) => {
      if (!reversed) {
        setPageColor(draft.theme, role, color);
        return;
      }
      draft.theme.inverse ??= start;
      draft.theme.inverse[role] = { ...color };
    },
  );
  return true;
}

/**
 * Uses the brand colours a palette from image `image` proposes (PG-2, F-DS-7): asked first (D7),
 * then one step, "Changed brand colours from 'Logo.png'": Brand, Accent and Second accent, each
 * with its text. Reversed sections take each brand colour's hue and chroma at their own lightness,
 * as the Theme tab's colours do (#200).
 */
export async function setBrandColours(
  session: ThemeSession,
  confirm: Confirm,
  proposal: BrandProposal,
  image: string,
): Promise<boolean> {
  const ok = await confirmed(session, confirm, {
    action: t("theme.image.confirm", { name: image }),
    description: t("theme.image.confirmDescription"),
    confirm: t("theme.image.confirmButton"),
  });
  if (!ok) return false;
  session.edit("props", t("theme.history.image", { name: image }), (draft) => {
    for (const [role, color] of Object.entries(proposal) as [keyof BrandProposal, Oklch][]) {
      setPageColor(draft.theme, role, color);
    }
  });
  return true;
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
    setPageColor(draft.theme, role, color);
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
