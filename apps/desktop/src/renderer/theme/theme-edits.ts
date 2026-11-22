import {
  type ComponentMessageKey,
  isComponentMessageKey,
  plural,
  t,
} from "@webforge/i18n/components";
import {
  type ColorRef,
  type ColorRole,
  colorFieldsIn,
  copyTheme,
  countOwnColorUses,
  DEFAULT_THEME,
  type FontRef,
  formatColorRef,
  type IsColorField,
  isNodeDoc,
  type NodeDoc,
  newId,
  newOwnColorId,
  type Oklch,
  OWN_COLOR_NAME_MAX,
  OWN_COLORS_MAX,
  rewriteOneOffUses,
  rewriteOwnColorUses,
  type SiteDoc,
  sameJson,
  TEXT_SIZES,
  TEXT_STYLES,
  type TextStyle,
  type ThemeTokens,
  toOwnColor,
} from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import type { BrandProposal, FontPairing } from "@webforge/themes";
import {
  brandedTheme,
  catalogueFont,
  fontRefOf,
  hexOf,
  hexToOklch,
  inverseColors,
  shadeOf,
  themePreset,
} from "@webforge/themes";
import type { OwnTheme } from "../../shared/ipc/themes.js";
import type { EditorSession } from "../editor/editor-session.js";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";
import { setTokenValue, type TokenControl, tokenValue } from "./theme-controls.js";

/** What the theme's edits change the site through: its history, as labelled undo steps. */
type ThemeSession = Pick<EditorSession, "edit"> & {
  readonly history: Pick<EditorSession["history"], "document">;
};

/** What a theme change asks of the window's site-wide confirmations. */
export type ThemeSiteWide = Pick<SiteWideConfirm, "confirmSiteWide"> &
  Partial<Pick<SiteWideConfirm, "beforeUnaskedChange">>;

/**
 * What a theme change asks first, if given: before choosing another theme or restyling a kind of
 * element on every page (D7). A colour or font change asks nothing: it applies at once, with an Undo
 * toast that says how far it reached (LF-15). With `names`, the first change to a built-in theme,
 * which is read-only (2.23, PH2-17), saves the person's own version too, without asking, under
 * {@link ownCopyName}. Without them, changes happen at once.
 */
export type ThemeAsks =
  | {
      /**
       * Asks before a change to every page (D7); a change that asks nothing runs its
       * `beforeUnaskedChange` first, where Version History saves a version (4.6).
       */
      readonly siteWide?: ThemeSiteWide | undefined;
      /** The person's own themes' names (My themes): see {@link ThemeNames}. */
      readonly names?: ThemeNames | undefined;
      /**
       * Says that a change was cancelled at one of its questions ("Not changed", #614): an Escape
       * meant for the dialog behind can answer one, and the control goes back as it was.
       */
      readonly notify?: ((message: string) => void) | undefined;
    }
  | undefined;

/** What a theme saved unasked needs of My themes (LF-15). */
type ThemeNames = {
  /** The names of the person's own themes, which a new one's mustn't repeat. */
  taken(): readonly string[];
  /** The name My themes lists the theme `id` under now, if it lists it. */
  nameOf(id: string): string | undefined;
};

/** A question before a change to every page (D7): its title, what it does and its button. */
type SiteWideQuestion = {
  readonly action: string;
  readonly description: string;
  readonly confirm: string;
};

/**
 * How a change to every page is made: after `question` (D7), or at once, saying `toast` with Undo
 * (LF-15). Neither, for a change that only the Theme tab's controls show, such as a token's.
 */
type Reach =
  | { readonly question: SiteWideQuestion; readonly toast?: undefined }
  | { readonly question?: undefined; readonly toast: (pages: number) => string }
  | undefined;

/**
 * The name the person's own version of the built-in theme `name` is saved under, without asking
 * (LF-15): "Bistro (yours)", or "Bistro (yours, 2)" and on when `taken`, the names of their themes
 * already, has it. Renaming it stays in Theme Studio.
 */
export function ownCopyName(name: string, taken: readonly string[]): string {
  const names = new Set(taken);
  let candidate = t("theme.own.defaultName", { name });
  for (let number = 2; names.has(candidate); number++) {
    candidate = t("theme.own.defaultNameNumbered", { name, number: String(number) });
  }
  return candidate;
}

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
  Record<QuickColor, { readonly name: ComponentMessageKey; readonly history: ComponentMessageKey }>
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
export const ROLE_NAMES: Readonly<Record<ColorRole, ComponentMessageKey>> = {
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
  return isComponentMessageKey(key) ? t(key) : preset;
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

/** The person's own versions saved unasked in each opening of a site, by its history: see below. */
const unaskedCopies = new WeakMap<object, Map<string, NonNullable<ThemeTokens["own"]>>>();

/**
 * The person's own version of built-in theme `preset`, saved unasked at its first change (LF-15):
 * the same one each time the site is back on `preset` in this opening, so trying a colour, undoing
 * it and trying another keeps one theme in My themes, not one a try. Only while My themes lists it,
 * under the name it has there now: one the person deleted meanwhile gives way to a new one, and one
 * they renamed keeps their name.
 */
function unaskedCopy(
  session: ThemeSession,
  preset: string,
  names: ThemeNames,
): NonNullable<ThemeTokens["own"]> {
  const made = unaskedCopies.get(session.history) ?? new Map();
  unaskedCopies.set(session.history, made);
  const before = made.get(preset);
  const listed = before === undefined ? undefined : names.nameOf(before.id);
  if (before !== undefined && listed !== undefined) return { id: before.id, name: listed };
  const own = { id: newId("theme"), name: ownCopyName(presetName(preset), names.taken()) };
  made.set(preset, own);
  return own;
}

/**
 * Changes the theme by `recipe`: one step, `label`. A change to every page asks `reach.question`
 * first (D7), and cancelling it changes nothing, and says so (#614); a colour or font change applies
 * at once, saying `reach.toast` with Undo (LF-15). A built-in theme is read-only (2.23, PH2-17):
 * with `asks.names`, the first change to one makes it the person's own in the same step, under
 * {@link ownCopyName}, without asking, and the same one again after an undo ({@link unaskedCopy}).
 * False if nothing changed.
 */
async function changeTheme(
  session: ThemeSession,
  asks: ThemeAsks,
  label: string,
  reach: Reach,
  recipe: (tokens: ThemeTokens) => void,
  /** What else the step changes in the site, beside its theme: a deleted colour's uses (#1218). */
  site?: (draft: SiteDoc) => void,
): Promise<boolean> {
  if (reach?.question !== undefined && !(await confirmed(session, asks, reach.question))) {
    return false;
  }
  const pages = pageCount(session);
  if (reach?.question === undefined) {
    await asks?.siteWide?.beforeUnaskedChange?.({
      action: label,
      confirm: label,
      affectedPages: pages,
    });
  }
  // Read after any wait: the theme as it is when the change is made.
  const now = theme(session);
  const own =
    asks?.names !== undefined && now.own === undefined
      ? unaskedCopy(session, now.preset, asks.names)
      : undefined;
  session.edit(
    "props",
    label,
    (draft) => {
      recipe(draft.theme);
      site?.(draft);
      if (own !== undefined) draft.theme.own = { ...own };
    },
    reach?.toast === undefined ? undefined : { announce: reach.toast(pages) },
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
    t(`theme.history.${control.group}` as ComponentMessageKey),
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
          question: {
            action: t("theme.look.confirm", { item }),
            description: plural("theme.look.confirm", reach),
            confirm: t("theme.look.confirmButton"),
          },
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

/**
 * Simple mode's text sizes (LF-16): the theme's own, as its preset has them, or every style one size
 * smaller or larger.
 */
export const TEXT_SCALES = ["smaller", "standard", "larger"] as const;

/** One of {@link TEXT_SCALES}. */
export type TextScale = (typeof TEXT_SCALES)[number];

/** How many sizes each style moves at each of {@link TEXT_SCALES}. */
const SCALE_STEP: Readonly<Record<TextScale, number>> = { smaller: -1, standard: 0, larger: 1 };

/**
 * The size of each of `theme`'s text styles at `scale`: its preset's, a size smaller or larger
 * (the smallest and largest stay). A theme from a preset this app doesn't list (a newer version's)
 * has the default theme's.
 */
export function textScaleSizes(
  theme: ThemeTokens,
  scale: TextScale,
): Readonly<Record<TextStyle, (typeof TEXT_SIZES)[number]>> {
  const standard = (themePreset(theme.preset) ?? DEFAULT_THEME).typeScale;
  const sizes = {} as Record<TextStyle, (typeof TEXT_SIZES)[number]>;
  for (const style of TEXT_STYLES) {
    const at = TEXT_SIZES.indexOf(standard[style].size) + SCALE_STEP[scale];
    sizes[style] =
      TEXT_SIZES[Math.min(Math.max(at, 0), TEXT_SIZES.length - 1)] ?? standard[style].size;
  }
  return sizes;
}

/** Which of {@link TEXT_SCALES} `theme`'s text sizes are, if they are one: none once sized one by one. */
export function textScaleOf(theme: ThemeTokens): TextScale | undefined {
  return TEXT_SCALES.find((scale) => {
    const sizes = textScaleSizes(theme, scale);
    return TEXT_STYLES.every((style) => theme.typeScale[style].size === sizes[style]);
  });
}

/**
 * Sets every text style's size to `scale`'s (Simple mode's Text size, LF-16): one step, "Changed
 * text size", or none if they are that already.
 */
export function setTextScale(
  session: ThemeSession,
  asks: ThemeAsks,
  scale: TextScale,
): Promise<boolean> {
  const current = theme(session);
  if (textScaleOf(current) === scale) return Promise.resolve(false);
  const sizes = textScaleSizes(current, scale);
  return changeTheme(session, asks, t("theme.history.textScale"), undefined, (tokens) => {
    for (const style of TEXT_STYLES) tokens.typeScale[style].size = sizes[style];
  });
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
 * Sets colour `role` of the page's colours or reversed sections' (Theme Studio, F-DS-7): at once,
 * one step, "Changed Brand colour in reversed sections", with an Undo toast (LF-15). A page colour follows the
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
      toast: (pages) =>
        plural(reversed ? "theme.changed.colorReversed" : "theme.changed.color", pages, { name }),
    },
    paletteColor(palette, role, color),
  );
}

/** Sets `palette`'s colour `role` to `color` in `tokens`: the change, or a preview of it (5.30). */
const paletteColor =
  (palette: "colors" | "inverse", role: ColorRole, color: Oklch) => (tokens: ThemeTokens) => {
    if (palette === "colors") {
      setPageColor(tokens, role, color);
      return;
    }
    // Reversed sections' colours as the theme shows them, for a theme without its own.
    tokens.inverse ??= JSON.parse(JSON.stringify(inverseColors(tokens))) as ThemeTokens["colors"];
    tokens.inverse[role] = { ...color };
  };

/**
 * The theme as it would be with `palette`'s colour `role` set to `color`, as {@link setPaletteColor}
 * and {@link setColor} set it: what a colour being dragged shows before it's chosen (5.30, OL-18).
 */
export function withPaletteColor(
  tokens: ThemeTokens,
  palette: "colors" | "inverse",
  role: ColorRole,
  color: Oklch,
): ThemeTokens {
  const next = structuredClone(tokens);
  paletteColor(palette, role, color)(next);
  return next;
}

/** The theme as it would be with colour `id` of the person's own set to `color` (5.30). */
export function withOwnColor(tokens: ThemeTokens, id: string, color: Oklch): ThemeTokens {
  const next = structuredClone(tokens);
  const colour = next.ownColors?.find((each) => each.id === id);
  if (colour !== undefined) colour.color = { ...color };
  return next;
}

/**
 * Uses the brand colours a palette from image `image` proposes (PG-2, F-DS-7): at once, one step,
 * "Changed brand colours from 'Logo.png'", with an Undo toast (LF-15): Brand, Accent and Second accent, each
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
    { toast: (pages) => plural("theme.changed.image", pages, { name: image }) },
    (tokens) => {
      const branded = brandedTheme(tokens, proposal);
      tokens.colors = branded.colors;
      if (branded.inverse !== undefined) tokens.inverse = branded.inverse;
    },
  );
}

/**
 * Switches the theme to `preset` (D7): asked first, with the pages it changes, then one step,
 * "Changed theme to 'Bistro'". The preset's tokens replace the theme's, colours and fonts too, but
 * not the person's own colours (TC-1a, #1217): those are the business's, and the site uses them.
 * One of their own themes brings its own with it, and keeps those the site had that it hasn't.
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
    const kept = copyTheme(draft.theme).ownColors ?? [];
    const next = copyTheme(preset);
    const brought = next.ownColors ?? [];
    const ownColors = [
      ...brought,
      ...kept.filter(({ id }) => !brought.some((each) => each.id === id)),
    ];
    draft.theme =
      ownColors.length === 0 && next.ownColors === undefined ? next : { ...next, ownColors };
  });
  return true;
}

/**
 * Sets colour `role`: at once, one step ("Changed brand colour"), with an Undo toast that says how
 * far it reached ("Brand colour changed on 6 pages", LF-15). A brand colour on a
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
    { toast: (pages) => plural("theme.changed.color", pages, { name }) },
    (tokens) => setPageColor(tokens, role, color),
  );
}

/** The theme's fonts, by what each is for: headings, body text and the accent (3.22). */
type FontRole = keyof ThemeTokens["fonts"];

/** Sets the fonts: at once, one step, "Changed fonts", with an Undo toast (LF-15). */
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
  // The accent alone changes only what is set in it, so the toast says so (3.22).
  const accentOnly = changed.every((role) => role === "accent");
  return changeTheme(
    session,
    asks,
    t("theme.history.fonts"),
    {
      toast: (pages) =>
        plural(accentOnly ? "theme.changed.accentFont" : "theme.changed.fonts", pages),
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
  const fonts = theme(session).fonts;
  return setFonts(
    session,
    asks,
    which === "heading" ? withHeading(fonts, font) : { ...fonts, [which]: font },
  );
}

/**
 * `fonts` with `heading` for the headings. An accent that is still the headings' font, as the
 * built-in themes and older sites have it until someone picks one, goes with them; one picked on
 * its own stays (#644). Otherwise a change of headings would leave the accent a font nobody chose.
 */
function withHeading(
  fonts: Readonly<Record<FontRole, FontRef>>,
  heading: FontRef,
): Record<FontRole, FontRef> {
  const follows = fonts.accent.family === fonts.heading.family;
  return { ...fonts, heading, accent: follows ? heading : fonts.accent };
}

/**
 * Sets the headings' and body text's fonts to a tested pairing's (F-DS-2), the accent with the
 * headings while it is their font: see {@link setFonts} and {@link withHeading}.
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
    ...withHeading(theme(session).fonts, fontRefOf(heading)),
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

/**
 * Adds one of the person's own colours, `name` and `color`, to the theme (TC-1b, #1218): one step.
 * Its new id, which every use of it refers to, or undefined if the theme has as many as it takes.
 */
export async function addOwnColor(
  session: ThemeSession,
  asks: ThemeAsks,
  name: string,
  color: Oklch,
): Promise<string | undefined> {
  const colors = theme(session).ownColors ?? [];
  if (colors.length >= OWN_COLORS_MAX) return undefined;
  const id = newOwnColorId(colors.map((each) => each.id));
  const added = await changeTheme(
    session,
    asks,
    t("theme.history.ownAdded", { name }),
    undefined,
    (tokens) => {
      tokens.ownColors = [...(tokens.ownColors ?? []), { id, name, color }];
    },
  );
  return added ? id : undefined;
}

/** Renames colour `id` (TC-1b): one step. A use refers to its id, so none changes. */
export function renameOwnColor(
  session: ThemeSession,
  asks: ThemeAsks,
  id: string,
  name: string,
): Promise<boolean> {
  const was = theme(session).ownColors?.find((each) => each.id === id);
  if (was === undefined || was.name === name) return Promise.resolve(false);
  return changeTheme(
    session,
    asks,
    t("theme.history.ownRenamed", { from: was.name, name }),
    undefined,
    (tokens) => {
      const colour = tokens.ownColors?.find((each) => each.id === id);
      if (colour !== undefined) colour.name = name;
    },
  );
}

/** Changes colour `id`'s colour (TC-1b): one step, and every use of it follows. */
export function setOwnColor(
  session: ThemeSession,
  asks: ThemeAsks,
  id: string,
  color: Oklch,
): Promise<boolean> {
  const was = theme(session).ownColors?.find((each) => each.id === id);
  if (was === undefined || sameJson(was.color, color)) return Promise.resolve(false);
  return changeTheme(
    session,
    asks,
    t("theme.history.ownChanged", { name: was.name }),
    undefined,
    (tokens) => {
      const colour = tokens.ownColors?.find((each) => each.id === id);
      if (colour !== undefined) colour.color = color;
    },
  );
}

/**
 * What becomes of a deleted colour's uses (TC-1b): each given to another of the person's colours,
 * its shade and opacity kept; or each kept as a one-off colour of its own, as it looks now. A
 * colour is never lost silently.
 */
export type OwnColorUses =
  | { readonly kind: "replace"; readonly to: string }
  | { readonly kind: "oneOff" };

/**
 * Deletes colour `id` (TC-1b): one step, with its uses as `uses` says, so none is left referring
 * to a colour the theme no longer has. `isColorField` tells which fields hold colours.
 */
export function deleteOwnColor(
  session: ThemeSession,
  asks: ThemeAsks,
  id: string,
  uses: OwnColorUses,
  isColorField: IsColorField,
): Promise<boolean> {
  const was = theme(session).ownColors?.find((each) => each.id === id);
  if (was === undefined) return Promise.resolve(false);
  if (uses.kind === "replace" && !theme(session).ownColors?.some((each) => each.id === uses.to)) {
    return Promise.resolve(false);
  }
  const rewrite =
    uses.kind === "replace"
      ? toOwnColor(uses.to)
      : (ref: ColorRef) =>
          formatColorRef({
            // As it looks now on the page: its shade worked out, the same everywhere from now on.
            base: {
              hex: hexOf(ref.shade === undefined ? was.color : shadeOf(was.color, ref.shade)),
            },
            ...(ref.opacity === undefined ? {} : { opacity: ref.opacity }),
          });
  return changeTheme(
    session,
    asks,
    t("theme.history.ownDeleted", { name: was.name }),
    undefined,
    (tokens) => {
      tokens.ownColors = (tokens.ownColors ?? []).filter((each) => each.id !== id);
    },
    (draft) => {
      rewriteOwnColorUses(draft, id, isColorField, rewrite);
    },
  );
}

/**
 * Makes one-off colour `hex` one of the person's colours, `name` (TC-3, #1221): added to the
 * theme's list, and every use of it across the site made a reference to it, each keeping its
 * opacity, all in one step, which one undo reverses. Its new id, or undefined if the theme has as
 * many colours as it takes. `isColorField` tells which fields hold colours.
 */
export async function addOneOffToOwnColors(
  session: ThemeSession,
  asks: ThemeAsks,
  hex: string,
  name: string,
  isColorField: IsColorField,
): Promise<string | undefined> {
  const colors = theme(session).ownColors ?? [];
  if (colors.length >= OWN_COLORS_MAX) return undefined;
  const id = newOwnColorId(colors.map((each) => each.id));
  const named = name.trim().slice(0, OWN_COLOR_NAME_MAX);
  const added = await changeTheme(
    session,
    asks,
    t("theme.history.ownFromOneOff", { name: named }),
    undefined,
    (tokens) => {
      tokens.ownColors = [...(tokens.ownColors ?? []), { id, name: named, color: hexToOklch(hex) }];
    },
    (draft) => {
      rewriteOneOffUses(draft, hex, isColorField, toOwnColor(id));
    },
  );
  return added ? id : undefined;
}

/** How many times colour `id` is used across the site: what deleting it asks about. */
export const ownColorUseCount = (
  session: ThemeSession,
  id: string,
  isColorField: IsColorField,
): number => countOwnColorUses(session.history.document.getState(), id, isColorField);

/**
 * Which fields of `library`'s components hold colours: a `color` field, or a list item's
 * (`items.iconColor`). A deleted colour's uses are found in these only (#1218).
 */
export const colorFieldsOf = (library: ComponentLibrary): IsColorField =>
  colorFieldsIn(library.components);
