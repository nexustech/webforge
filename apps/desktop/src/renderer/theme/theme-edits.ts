import { isMessageKey, type MessageKey, plural, t } from "@webforge/i18n";
import {
  type ColorRole,
  copyTheme,
  type FontRef,
  isNodeDoc,
  type NodeDoc,
  newId,
  type Oklch,
  type SiteDoc,
  sameJson,
  type TEXT_SIZES,
  type TextStyle,
  type ThemeTokens,
} from "@webforge/model";
import type { BrandProposal, FontPairing } from "@webforge/themes";
import { brandedTheme, catalogueFont, fontRefOf, inverseColors } from "@webforge/themes";
import type { OwnTheme } from "../../shared/ipc/themes.js";
import type { EditorSession } from "../editor/editor-session.js";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";
import type { OwnThemeNames } from "./own-themes.js";
import { setTokenValue, type TokenControl, tokenValue } from "./theme-controls.js";

/** What the theme's edits change the site through: its history, as labelled undo steps. */
type ThemeSession = Pick<EditorSession, "edit"> & {
  readonly history: Pick<EditorSession["history"], "document">;
};

/**
 * What a theme change asks first, if given: before a change to every page (D7), and for a name
 * before the first change to a built-in theme, which is read-only (2.23, PH2-17). Without them,
 * changes happen at once.
 */
export type ThemeAsks =
  | {
      readonly siteWide?: Pick<SiteWideConfirm, "confirmSiteWide"> | undefined;
      readonly names?: OwnThemeNames | undefined;
      /**
       * Says that a change was cancelled at one of its questions ("Not changed", #614): an Escape
       * meant for the dialog behind can answer one, and the control goes back as it was.
       */
      readonly notify?: ((message: string) => void) | undefined;
    }
  | undefined;

/** A question before a change to every page (D7): its title, what it does and its button. */
type SiteWideQuestion = {
  readonly action: string;
  readonly description: string;
  readonly confirm: string;
};

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

/** A theme's name: the person's own name for it (2.23), or its preset's. */
export const themeName = (tokens: ThemeTokens): string =>
  tokens.own?.name ?? presetName(tokens.preset);

/** How many pages a theme change changes: all of them. */
const pageCount = (session: ThemeSession) =>
  Object.keys(session.history.document.getState().pages).length;

const theme = (session: ThemeSession) => session.history.document.getState().theme;

/** Asks `asks.siteWide`, if there is one, before `action` changes every page. */
async function confirmed(
  session: ThemeSession,
  asks: ThemeAsks,
  action: SiteWideQuestion,
): Promise<boolean> {
  if (asks?.siteWide === undefined) return true;
  const ok = await asks.siteWide.confirmSiteWide({ ...action, affectedPages: pageCount(session) });
  if (!ok) sayNotChanged(asks);
  return ok;
}

/** Says that a change was cancelled at a question, so nothing changed (#614). */
function sayNotChanged(asks: ThemeAsks): void {
  asks?.notify?.(t("theme.notChanged"));
}

/**
 * Changes the theme by `recipe`: one step, `label`. A built-in theme is read-only (2.23, PH2-17):
 * with `asks.names`, the first change to one asks for a name for the person's own version, and
 * the same step makes it theirs ("Saved theme 'Light (my version)'"). A change to every page asks
 * `question` first too (D7). Cancelling either changes nothing, and says so (#614). False if nothing
 * changed.
 */
async function changeTheme(
  session: ThemeSession,
  asks: ThemeAsks,
  label: string,
  question: SiteWideQuestion | undefined,
  recipe: (tokens: ThemeTokens) => void,
): Promise<boolean> {
  const now = theme(session);
  let own: ThemeTokens["own"];
  if (asks?.names !== undefined && now.own === undefined) {
    const name = presetName(now.preset);
    const chosen = await asks.names.askName({
      title: t("theme.own.title", { name }),
      description: t("theme.own.description"),
      initial: t("theme.own.defaultName", { name }),
      confirm: t("theme.own.save"),
    });
    if (chosen === undefined) {
      sayNotChanged(asks);
      return false;
    }
    own = { id: newId("theme"), name: chosen };
  }
  if (question !== undefined && !(await confirmed(session, asks, question))) return false;
  session.edit(
    "props",
    own === undefined ? label : t("theme.history.saved", { name: own.name }),
    (draft) => {
      recipe(draft.theme);
      if (own !== undefined) draft.theme.own = { ...own };
    },
  );
  return true;
}

/** Sets a token the Theme tab offers as a choice: one step, named for its group. */
export function setToken(
  session: ThemeSession,
  asks: ThemeAsks,
  control: TokenControl,
  value: unknown,
): Promise<boolean> {
  if (tokenValue(theme(session), control) === value) return Promise.resolve(false);
  return changeTheme(
    session,
    asks,
    t(`theme.history.${control.group}` as MessageKey),
    undefined,
    (tokens) => setTokenValue(tokens, control, value),
  );
}

/** Every node in `nodes`, at any depth: in a section's content, a list's items. */
function* everyNode(nodes: readonly NodeDoc[]): Generator<NodeDoc> {
  for (const node of nodes) {
    yield node;
    for (const value of Object.values(node.props)) {
      if (Array.isArray(value)) yield* everyNode(value.filter(isNodeDoc));
    }
  }
}

/**
 * How many elements of `type` the site has that a change to their kind's look for `fields` restyles
 * (3.12, CT-1): those that leave one of the fields to it, its whole value unset (on every device),
 * as decision 4 has it. On every page, in the shared Header and
 * Footer, and in each shared section once, which all its copies show.
 */
export function lookReach(site: SiteDoc, type: string, fields: readonly string[]): number {
  const roots = [
    ...Object.values(site.pages).flatMap((page) => page.doc.content),
    ...site.layout.header,
    ...site.layout.footer,
    ...Object.values(site.sharedSections).map((shared) => shared.section),
  ];
  let count = 0;
  for (const node of everyNode(roots)) {
    if (node.type === type && fields.some((field) => node.props[field] === undefined)) count++;
  }
  return count;
}

/**
 * Changes the theme's look for elements of `type`, named `item` ("Button"), by `change` (3.12,
 * CT-1): each field to its value, or taken off for `undefined`, so the kind goes back to its
 * defaults there. One step, "Changed the theme's look for Button"; asked first (D7) when it
 * restyles anything, saying how many. False if nothing changed.
 */
export function setLook(
  session: ThemeSession,
  asks: ThemeAsks,
  type: string,
  item: string,
  change: Readonly<Record<string, unknown>>,
): Promise<boolean> {
  const look: Readonly<Record<string, unknown>> = theme(session).looks?.[type] ?? {};
  const fields = Object.keys(change).filter((field) => !sameJson(look[field], change[field]));
  if (fields.length === 0) return Promise.resolve(false);
  const reach = lookReach(session.history.document.getState(), type, fields);
  const resets = fields.every((field) => change[field] === undefined);
  return changeTheme(
    session,
    asks,
    t(resets ? "theme.history.lookReset" : "theme.history.look", { item }),
    reach === 0
      ? undefined
      : {
          action: t("theme.look.confirm", { item }),
          description: plural("theme.look.confirm", reach),
          confirm: t("theme.look.confirmButton"),
        },
    (tokens) => {
      const next: Record<string, unknown> = { ...tokens.looks?.[type] };
      for (const field of fields) {
        if (change[field] === undefined) delete next[field];
        else next[field] = structuredClone(change[field]);
      }
      const looks = { ...tokens.looks };
      if (Object.keys(next).length === 0) delete looks[type];
      else looks[type] = next as NonNullable<ThemeTokens["looks"]>[string];
      if (Object.keys(looks).length === 0) delete tokens.looks;
      else tokens.looks = looks;
    },
  );
}

/** Sets the size of text style `style`: one step, "Changed text size for Heading 1". */
export function setTextSize(
  session: ThemeSession,
  asks: ThemeAsks,
  style: TextStyle,
  size: (typeof TEXT_SIZES)[number],
): Promise<boolean> {
  if (theme(session).typeScale[style].size === size) return Promise.resolve(false);
  return changeTheme(
    session,
    asks,
    t("theme.history.textSize", { style: t(`theme.textStyle.${style}`) }),
    undefined,
    (tokens) => {
      tokens.typeScale[style].size = size;
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
  asks: ThemeAsks,
  style: TextStyle,
  change: Partial<TextStep>,
): Promise<boolean> {
  const now = theme(session).typeScale[style];
  const next = { ...now, ...change };
  if (next.size === now.size && next.weight === now.weight && next.leading === now.leading) {
    return Promise.resolve(false);
  }
  return changeTheme(
    session,
    asks,
    t("theme.history.textStyle", { style: t(`theme.textStyle.${style}`) }),
    undefined,
    (tokens) => {
      tokens.typeScale[style] = next;
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
  asks: ThemeAsks,
  palette: "colors" | "inverse",
  role: ColorRole,
  color: Oklch,
): Promise<boolean> {
  const tokens = theme(session);
  const now = (palette === "colors" ? tokens.colors : inverseColors(tokens))[role];
  if (now.l === color.l && now.c === color.c && now.h === color.h) return false;
  const name = t(ROLE_NAMES[role]);
  const reversed = palette === "inverse";
  return changeTheme(
    session,
    asks,
    reversed ? t("theme.history.colorReversed", { name }) : t("theme.history.color", { name }),
    {
      action: reversed
        ? t("theme.color.confirmReversed", { name })
        : t("theme.color.confirm", { name }),
      description: t("theme.color.confirmDescription"),
      confirm: t("theme.color.confirmButton"),
    },
    (tokens) => {
      if (!reversed) {
        setPageColor(tokens, role, color);
        return;
      }
      // Reversed sections' colours as the theme shows them, for a theme without its own.
      tokens.inverse ??= JSON.parse(JSON.stringify(inverseColors(tokens))) as ThemeTokens["colors"];
      tokens.inverse[role] = { ...color };
    },
  );
}

/**
 * Uses the brand colours a palette from image `image` proposes (PG-2, F-DS-7): asked first (D7),
 * then one step, "Changed brand colours from 'Logo.png'": Brand, Accent and Second accent, each
 * with its text. Reversed sections take each brand colour's hue and chroma at their own lightness
 * (#200), fitted to their own surface with their text as the page's are ({@link reversedBrand},
 * #462 review), so a reversed band stays readable.
 */
export async function setBrandColours(
  session: ThemeSession,
  asks: ThemeAsks,
  proposal: BrandProposal,
  image: string,
): Promise<boolean> {
  return changeTheme(
    session,
    asks,
    t("theme.history.image", { name: image }),
    {
      action: t("theme.image.confirm", { name: image }),
      description: t("theme.image.confirmDescription"),
      confirm: t("theme.image.confirmButton"),
    },
    (tokens) => {
      const branded = brandedTheme(tokens, proposal);
      tokens.colors = branded.colors;
      if (branded.inverse !== undefined) tokens.inverse = branded.inverse;
    },
  );
}

/**
 * Switches the theme to `preset` (D7): asked first, with the pages it changes, then one step,
 * "Changed theme to 'Bistro'". The preset's tokens replace the theme's, colours and fonts too.
 */
export async function switchPreset(
  session: ThemeSession,
  asks: ThemeAsks,
  preset: ThemeTokens,
): Promise<boolean> {
  const name = themeName(preset);
  const ok = await confirmed(session, asks, {
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
  asks: ThemeAsks,
  role: QuickColor,
  color: Oklch,
): Promise<boolean> {
  const now = theme(session).colors[role];
  if (now.l === color.l && now.c === color.c && now.h === color.h) return false;
  const name = t(COLOR_WORDS[role].name);
  return changeTheme(
    session,
    asks,
    t(COLOR_WORDS[role].history),
    {
      action: t("theme.color.confirm", { name }),
      description: t("theme.color.confirmDescription"),
      confirm: t("theme.color.confirmButton"),
    },
    (tokens) => setPageColor(tokens, role, color),
  );
}

/** The theme's fonts, by what each is for: headings, body text and the accent (3.22). */
type FontRole = keyof ThemeTokens["fonts"];

/** Sets the fonts (D7): asked first, then one step, "Changed fonts". */
async function setFonts(
  session: ThemeSession,
  asks: ThemeAsks,
  fonts: Readonly<Record<FontRole, FontRef>>,
): Promise<boolean> {
  const now = theme(session).fonts;
  const roles = ["heading", "body", "accent"] as const satisfies readonly FontRole[];
  const changed = roles.filter((role) => now[role].family !== fonts[role].family);
  if (changed.length === 0) {
    return false;
  }
  // The accent alone changes only what is set in it, so the question says so (3.22).
  const accentOnly = changed.every((role) => role === "accent");
  return changeTheme(
    session,
    asks,
    t("theme.history.fonts"),
    {
      action: t("theme.fonts.confirm"),
      description: t(
        accentOnly ? "theme.fonts.confirmAccentDescription" : "theme.fonts.confirmDescription",
      ),
      confirm: t("theme.fonts.confirmButton"),
    },
    (tokens) => {
      tokens.fonts = {
        heading: { ...fonts.heading },
        body: { ...fonts.body },
        accent: { ...fonts.accent },
      };
    },
  );
}

/** Sets the headings', the body text's or the accent's font: see {@link setFonts}. */
export function setFont(
  session: ThemeSession,
  asks: ThemeAsks,
  which: FontRole,
  font: FontRef,
): Promise<boolean> {
  return setFonts(session, asks, { ...theme(session).fonts, [which]: font });
}

/**
 * Sets the headings' and body text's fonts to a tested pairing's (F-DS-2), the accent's as it was:
 * see {@link setFonts}.
 */
export function setPairing(
  session: ThemeSession,
  asks: ThemeAsks,
  pairing: FontPairing,
): Promise<boolean> {
  const heading = catalogueFont(pairing.heading);
  const body = catalogueFont(pairing.body);
  if (heading === undefined || body === undefined) return Promise.resolve(false);
  return setFonts(session, asks, {
    ...theme(session).fonts,
    heading: fontRefOf(heading),
    body: fontRefOf(body),
  });
}

/** Whether `a` and `b` look the same on the page: the same tokens, whatever they're named (2.23). */
function looksTheSame(a: ThemeTokens, b: ThemeTokens): boolean {
  const { own: _a, ...aTokens } = a;
  const { own: _b, ...bTokens } = b;
  return sameJson(aTokens, bTokens);
}

/**
 * Creates one of the person's own themes (Theme Studio's *New theme*, 2.23): `base`'s tokens under
 * `name`, as the site's theme. Asked first when it changes how every page looks (D7), not when it
 * starts from the site's theme as it is; then one step, "Created theme 'Shop'".
 */
export async function createOwnTheme(
  session: ThemeSession,
  asks: ThemeAsks,
  base: ThemeTokens,
  name: string,
): Promise<boolean> {
  const ok =
    looksTheSame(base, theme(session)) ||
    (await confirmed(session, asks, {
      action: t("theme.preset.confirm", { name }),
      description: t("theme.preset.confirmDescription"),
      confirm: t("theme.preset.confirmButton"),
    }));
  if (!ok) return false;
  session.edit("props", t("theme.history.created", { name }), (draft) => {
    draft.theme = { ...copyTheme(base), own: { id: newId("theme"), name } };
  });
  return true;
}

/**
 * Renames one of the person's own themes (2.23). The site's theme, if it's that one, is renamed in
 * one step, "Renamed theme to 'Shop'", which the window keeps in My themes as it keeps every change
 * to it; another of theirs is renamed in My themes only (`keep`).
 */
export function renameOwnTheme(
  session: ThemeSession,
  own: OwnTheme,
  name: string,
  keep: (theme: OwnTheme) => void,
): void {
  if (name === own.own.name) return;
  if (theme(session).own?.id === own.own.id) {
    session.edit("props", t("theme.history.renamed", { name }), (draft) => {
      if (draft.theme.own !== undefined) draft.theme.own.name = name;
    });
    return;
  }
  keep({ ...copyTheme(own), own: { ...own.own, name } });
}
