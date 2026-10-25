import {
  EditPanel,
  type EditPanelField,
  FieldRenderersProvider,
  type OptionGroup,
} from "@webforge/editor-ui";
import { type MessageKey, t } from "@webforge/i18n";
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
import type { EditorSession } from "../editor/editor-session.js";
import { useDocument } from "../editor/use-document.js";
import { shownRatio, TEXT_PX, themeFieldRenderers } from "../fields/index.js";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";
import { TOKEN_CONTROLS, tokenKey, tokenValue } from "./theme-controls.js";
import {
  COLOR_WORDS,
  presetName,
  QUICK_COLORS,
  setColor,
  setFont,
  setPairing,
  setTextSize,
  setToken,
  switchPreset,
} from "./theme-edits.js";

/** A message whose key is made at run time, if it has one: a test checks every key the tab makes. */
export const named = (key: string): string | undefined =>
  t(key as MessageKey) as string | undefined;

/** The pairing value of fonts that are no pairing: the person's own choice. */
const OWN_PAIRING = "own";

/**
 * The names of the colours a quick colour is checked against (2.1's pairs), for its contrast
 * warning: the surfaces, the text, and each brand colour and the text on it.
 */
const OTHER_NAMES: Partial<Record<ColorRole, MessageKey>> = {
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
};

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
    const other = OTHER_NAMES[issue.background === role ? issue.foreground : issue.background];
    if (other === undefined) return [];
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

/** The Theme tab's fields for `theme`, in its groups. */
function themeFields(theme: ThemeTokens): EditPanelField[] {
  const field = (spec: EditPanelField) => spec;
  const pairing = pairingOf(theme);
  const issues = contrastIssues(theme);
  // A preset this app doesn't list (from a newer version's file) is still shown as the theme's.
  const listed = THEME_PRESETS.some((preset) => preset.preset === theme.preset);
  return [
    field({
      kind: "select",
      name: "preset",
      group: "content",
      optionGroup: GROUPS.preset,
      label: t("theme.preset.label"),
      options: [
        ...(listed ? [] : [{ label: theme.preset, value: theme.preset }]),
        ...THEME_PRESETS.map((preset) => ({
          label: presetName(preset.preset),
          value: preset.preset,
        })),
      ],
      value: theme.preset,
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
};

/**
 * The Theme tab (2.3a, F-DS-2): the site's theme as the Edit panel's rows. Its preset; its colours
 * by the glossary's names, each with what its contrast lacks; its fonts, as a pairing or one by one
 * in the font picker; its text sizes; then each token the theme has, by group. A preset, a colour or
 * the fonts change every page, so they're asked first (D7); each change is one labelled step.
 */
export function ThemePanel({ session, siteWide }: ThemePanelProps) {
  const theme = useDocument(session, (site) => site.theme);
  const onChange = (name: string, value: unknown) => {
    const [kind, rest = ""] = name.split(/\.(.*)/s);
    if (kind === "preset") {
      const preset = themePreset(String(value));
      if (preset !== undefined) void switchPreset(session, siteWide, preset);
    } else if (kind === "color") {
      const role = QUICK_COLORS.find((each) => each === rest);
      const color = oklchSchema.safeParse(value);
      if (role !== undefined && color.success) void setColor(session, siteWide, role, color.data);
    } else if (name === "fonts.pairing") {
      const pairing = FONT_PAIRINGS.find((each) => each.id === value);
      if (pairing !== undefined) void setPairing(session, siteWide, pairing);
    } else if (name === "fonts.heading" || name === "fonts.body") {
      const font = fontRefSchema.safeParse(value);
      if (font.success)
        void setFont(session, siteWide, rest === "heading" ? "heading" : "body", font.data);
    } else if (kind === "textSize") {
      const style = TEXT_STYLES.find((each) => each === rest);
      const size = TEXT_SIZES.find((each) => each === value);
      if (style !== undefined && size !== undefined) setTextSize(session, style, size);
    } else if (kind === "token") {
      const control = TOKEN_CONTROLS.find((each) => tokenKey(each) === rest);
      const allowed =
        control?.values === "toggle"
          ? typeof value === "boolean"
          : control?.values.includes(String(value)) === true;
      if (control !== undefined && allowed) setToken(session, control, value);
    }
  };
  return (
    <FieldRenderersProvider renderers={RENDERERS}>
      <EditPanel
        heading={t("theme.heading", {
          name: named(`theme.preset.${theme.preset}`) ?? theme.preset,
        })}
        itemKey="theme"
        single
        fields={themeFields(theme)}
        onChange={onChange}
        // Each change is its own step as it's made: nothing waits for the field to be left.
        onCommit={() => undefined}
      />
    </FieldRenderersProvider>
  );
}
