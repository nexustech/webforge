import {
  Button,
  EditPanel,
  type EditPanelField,
  FieldRenderersProvider,
  type OptionGroup,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  type ColorRole,
  fontRefSchema,
  oklchSchema,
  TEXT_SIZES,
  TEXT_STYLES,
  type ThemeTokens,
} from "@webforge/model";
import {
  type ContrastIssue,
  catalogueFont,
  contrastIssues,
  FONT_PAIRINGS,
  THEME_PRESETS,
  themePreset,
} from "@webforge/themes";
import { PaletteIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { OwnTheme } from "../../shared/ipc/themes.js";
import type { EditorSession } from "../editor/editor-session.js";
import { useDocument } from "../editor/use-document.js";
import { shownRatio, TEXT_PX, themeFieldRenderers } from "../fields/index.js";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";
import type { OwnThemes } from "./own-themes.js";
import { useOwnThemeList } from "./own-themes-list.js";
import type { StudioState } from "./studio/studio-state.js";
import { TOKEN_CONTROLS, tokenKey, tokenValue } from "./theme-controls.js";
import {
  COLOR_WORDS,
  presetName,
  QUICK_COLORS,
  ROLE_NAMES,
  setColor,
  setFont,
  setPairing,
  setTextSize,
  setToken,
  switchPreset,
  type ThemeAsks,
  themeName,
} from "./theme-edits.js";
import { named } from "./theme-words.js";

/** The pairing value of fonts that are no pairing: the person's own choice. */
const OWN_PAIRING = "own";

const RENDERERS = themeFieldRenderers();

/** The Theme tab's option groups before the tokens': the theme, its colours, fonts, text sizes. */
const GROUPS = {
  preset: { id: "preset", label: t("theme.group.preset") },
  colors: { id: "colors", label: t("theme.group.colors") },
  fonts: { id: "fonts", label: t("theme.group.fonts") },
  textSizes: { id: "textSizes", label: t("theme.group.textSizes") },
} as const satisfies Record<string, OptionGroup>;

/**
 * What `role`'s contrast lacks in the page colours (below WCAG AA), from the theme's `issues`, as
 * its field says it.
 * Reversed sections' colours are Theme Studio's to check and change (2.3b): the tab changes only
 * their brand colours' hue (#200), and many presets have a pair there below AA already (#312).
 */
function contrastWarnings(issues: readonly ContrastIssue[], role: ColorRole): string[] {
  return issues.flatMap((issue) => {
    if (issue.palette !== "colors") return [];
    if (issue.background !== role && issue.foreground !== role) return [];
    const other = ROLE_NAMES[issue.background === role ? issue.foreground : issue.background];
    return [
      t("theme.contrast.low", {
        other: t(other),
        ratio: shownRatio(issue.ratio),
        needed: issue.required,
      }),
    ];
  });
}

/** The pairing `theme`'s fonts are, if they are one. */
const pairingOf = (theme: ThemeTokens) =>
  FONT_PAIRINGS.find(
    (pairing) =>
      catalogueFont(pairing.heading)?.family === theme.fonts.heading.family &&
      catalogueFont(pairing.body)?.family === theme.fonts.body.family,
  );

/** The theme list's value of one of the person's own themes (2.23): `own:<id>`. */
const ownValue = (theme: Pick<OwnTheme, "own">) => `own:${theme.own.id}`;

/**
 * The Theme tab's fields for `theme`, in its groups. Its theme list has the person's own themes
 * first (`own`, 2.23), then the built-in ones.
 */
function themeFields(theme: ThemeTokens, own: readonly OwnTheme[]): EditPanelField[] {
  const field = (spec: EditPanelField) => spec;
  const pairing = pairingOf(theme);
  const issues = contrastIssues(theme);
  // A preset this app doesn't list (from a newer version's file) is still shown as the theme's.
  const listed =
    theme.own !== undefined || THEME_PRESETS.some((preset) => preset.preset === theme.preset);
  return [
    field({
      kind: "select",
      name: "preset",
      group: "content",
      optionGroup: GROUPS.preset,
      label: t("theme.preset.label"),
      options: [
        ...own.map((each) => ({ label: each.own.name, value: ownValue(each) })),
        ...(listed ? [] : [{ label: theme.preset, value: theme.preset }]),
        ...THEME_PRESETS.map((preset) => ({
          label: presetName(preset.preset),
          value: preset.preset,
        })),
      ],
      value: theme.own === undefined ? theme.preset : ownValue({ own: theme.own }),
    }),
    ...QUICK_COLORS.map((role) =>
      field({
        kind: "themeColor",
        name: `color.${role}`,
        group: "content",
        optionGroup: GROUPS.colors,
        label: t(COLOR_WORDS[role].name),
        warnings: contrastWarnings(issues, role),
        value: theme.colors[role],
      }),
    ),
    field({
      kind: "select",
      name: "fonts.pairing",
      group: "content",
      optionGroup: GROUPS.fonts,
      label: t("theme.fonts.pairing"),
      options: [
        ...FONT_PAIRINGS.map((each) => ({
          label: named(`fonts.pairing.${each.id}`) ?? each.id,
          value: each.id,
        })),
        ...(pairing === undefined ? [{ label: t("theme.fonts.own"), value: OWN_PAIRING }] : []),
      ],
      value: pairing?.id ?? OWN_PAIRING,
    }),
    ...(["heading", "body"] as const).map((which) =>
      field({
        kind: "font",
        name: `fonts.${which}`,
        group: "content",
        optionGroup: GROUPS.fonts,
        label: t(which === "heading" ? "theme.fonts.heading" : "theme.fonts.body"),
        value: theme.fonts[which],
      }),
    ),
    ...TEXT_STYLES.map((style) =>
      field({
        kind: "select",
        name: `textSize.${style}`,
        group: "content",
        optionGroup: GROUPS.textSizes,
        label: t(`theme.textStyle.${style}`),
        options: TEXT_SIZES.map((size) => ({
          label: t("theme.textSize.option", { px: TEXT_PX[size] }),
          value: size,
        })),
        value: theme.typeScale[style].size,
      }),
    ),
    ...TOKEN_CONTROLS.map((control) => {
      const key = tokenKey(control);
      const common = {
        name: `token.${key}`,
        group: "content" as const,
        optionGroup: {
          id: control.group,
          label: named(`theme.group.${control.group}`) ?? control.group,
        },
        label: named(`theme.token.${key}`) ?? key,
        value: tokenValue(theme, control),
      };
      return control.values === "toggle"
        ? field({ kind: "toggle", ...common })
        : field({
            kind: "select",
            ...common,
            options: control.values.map((value) => ({
              label: named(`theme.token.${key}.${value}`) ?? value,
              value,
            })),
          });
    }),
  ];
}

/** Props of {@link ThemePanel}. */
export type ThemePanelProps = {
  readonly session: EditorSession;
  /** Asks before a change to every page (D7): a preset, a colour, the fonts. */
  readonly siteWide?: Pick<SiteWideConfirm, "confirmSiteWide"> | undefined;
  /** Theme Studio's state (2.3b): the tab's button opens it; the window draws it. */
  readonly studio?: StoreApi<StudioState> | undefined;
  /**
   * My themes (2.23): listed first, and asked for a name before the first change to a built-in
   * theme, which is read-only. Without them, a built-in theme changes in place.
   */
  readonly ownThemes?: OwnThemes | undefined;
  /**
   * A field to reveal (CT-3): scrolled to and focused once drawn, then cleared. The Edit panel's
   * *Theme's (Corners: Medium)* asks for its token's.
   */
  readonly reveal?: StoreApi<{ readonly field?: string | undefined }> | undefined;
};

/** No field to reveal: the tab drawn without a registration's requests. */
const NO_REVEAL = createStore<{ readonly field?: string | undefined }>()(() => ({}));

/**
 * The Theme tab (2.3a, F-DS-2): the site's theme as the Edit panel's rows. Its preset; its colours
 * by the glossary's names, each with what its contrast lacks; its fonts, as a pairing or one by one
 * in the font picker; its text sizes; then each token the theme has, by group. A preset, a colour or
 * the fonts change every page, so they're asked first (D7); each change is one labelled step. The
 * person's own themes are listed first; the first change to a built-in one saves their own version
 * of it, by a name they choose (2.23, PH2-17).
 */
export function ThemePanel({ session, siteWide, studio, ownThemes, reveal }: ThemePanelProps) {
  const theme = useDocument(session, (site) => site.theme);
  const root = useRef<HTMLDivElement>(null);
  const field = useStore(reveal ?? NO_REVEAL, (state) => state.field);
  useEffect(() => {
    if (field === undefined) return;
    const row = root.current?.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`);
    row?.scrollIntoView({ block: "center" });
    row?.querySelector<HTMLElement>("input, select, button, [tabindex]")?.focus();
    reveal?.setState({ field: undefined });
  }, [field, reveal]);
  const own = useOwnThemeList(ownThemes, theme);
  useEffect(() => {
    void ownThemes?.refresh();
  }, [ownThemes]);
  const asks: ThemeAsks = { siteWide, names: ownThemes };
  const onChange = (name: string, value: unknown) => {
    const [kind, rest = ""] = name.split(/\.(.*)/s);
    if (kind === "preset") {
      const chosen = own.find((each) => ownValue(each) === value) ?? themePreset(String(value));
      if (chosen !== undefined) void switchPreset(session, asks, chosen);
    } else if (kind === "color") {
      const role = QUICK_COLORS.find((each) => each === rest);
      const color = oklchSchema.safeParse(value);
      if (role !== undefined && color.success) void setColor(session, asks, role, color.data);
    } else if (name === "fonts.pairing") {
      const pairing = FONT_PAIRINGS.find((each) => each.id === value);
      if (pairing !== undefined) void setPairing(session, asks, pairing);
    } else if (name === "fonts.heading" || name === "fonts.body") {
      const font = fontRefSchema.safeParse(value);
      if (font.success)
        void setFont(session, asks, rest === "heading" ? "heading" : "body", font.data);
    } else if (kind === "textSize") {
      const style = TEXT_STYLES.find((each) => each === rest);
      const size = TEXT_SIZES.find((each) => each === value);
      if (style !== undefined && size !== undefined) void setTextSize(session, asks, style, size);
    } else if (kind === "token") {
      const control = TOKEN_CONTROLS.find((each) => tokenKey(each) === rest);
      const allowed =
        control?.values === "toggle"
          ? typeof value === "boolean"
          : control?.values.includes(String(value)) === true;
      if (control !== undefined && allowed) void setToken(session, asks, control, value);
    }
  };
  return (
    <FieldRenderersProvider renderers={RENDERERS}>
      <div ref={root} className="flex h-full flex-col">
        {studio === undefined ? null : (
          <div className="px-3 pt-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full"
              aria-haspopup="dialog"
              onClick={() => studio.setState({ open: true })}
            >
              <PaletteIcon aria-hidden className="size-3.5" />
              {t("theme.studio.open")}
            </Button>
          </div>
        )}
        <div className="min-h-0 flex-1">
          <EditPanel
            heading={t("theme.heading", {
              name: themeName(theme),
            })}
            itemKey="theme"
            single
            fields={themeFields(theme, own)}
            onChange={onChange}
            // Each change is its own step as it's made: nothing waits for the field to be left.
            onCommit={() => undefined}
          />
        </div>
      </div>
    </FieldRenderersProvider>
  );
}
