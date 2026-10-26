import { t } from "@webforge/i18n";
import {
  type ColorRole,
  type Oklch,
  SHADE_STEPS,
  SHADED_ROLES,
  type ThemeTokens,
} from "@webforge/model";
import {
  type ContrastIssue,
  contrastIssues,
  inverseColors,
  oklchCss,
  shadeOf,
} from "@webforge/themes";
import { type CSSProperties, useId } from "react";
import { shownRatio, ThemeColorField } from "../../fields/index.js";
import { ROLE_NAMES } from "../theme-edits.js";

/** The palettes side by side (F-DS-7): the page's colours, and reversed sections'. */
const PALETTES = ["colors", "inverse"] as const;

/** One of {@link PALETTES}. */
type Palette = (typeof PALETTES)[number];

/**
 * The colour roles in the rows' order: the glossary's Brand, Accent and Second accent, each with
 * its text, the surfaces and their text, then the other colours with theirs.
 */
const ROLES: readonly ColorRole[] = [
  "primary",
  "primary-content",
  "secondary",
  "secondary-content",
  "accent",
  "accent-content",
  "base-100",
  "base-200",
  "base-300",
  "base-content",
  "neutral",
  "neutral-content",
  "info",
  "info-content",
  "success",
  "success-content",
  "warning",
  "warning-content",
  "error",
  "error-content",
];

const isShaded = (role: ColorRole) => (SHADED_ROLES as readonly string[]).includes(role);

/** What `role`'s contrast lacks in `palette`, from the theme's `issues`, as its cell says it. */
function warningsOf(issues: readonly ContrastIssue[], palette: Palette, role: ColorRole) {
  return issues.flatMap((issue) => {
    if (issue.palette !== palette) return [];
    if (issue.background !== role && issue.foreground !== role) return [];
    const other = issue.background === role ? issue.foreground : issue.background;
    return [
      t("theme.contrast.low", {
        other: t(ROLE_NAMES[other]),
        ratio: shownRatio(issue.ratio),
        needed: issue.required,
      }),
    ];
  });
}

/** A colour's shades (2.1), lightest first, as small swatches named by their step. */
function Shades({ name, color }: { readonly name: string; readonly color: Oklch }) {
  return (
    <ul className="m-0 flex list-none gap-px p-0" aria-label={t("theme.studio.shades", { name })}>
      {SHADE_STEPS.map((step) => (
        <li
          key={step}
          title={t("theme.studio.shade", { name, step })}
          aria-label={t("theme.studio.shade", { name, step })}
          className="h-3 min-w-0 flex-1 bg-(--shade) first:rounded-l-sm last:rounded-r-sm"
          style={{ "--shade": oklchCss(shadeOf(color, step)) } as CSSProperties}
        />
      ))}
    </ul>
  );
}

/** One role's row: its name, then its colour in each palette, with shades and warnings. */
function ColourRow({
  role,
  theme,
  issues,
  headers,
  onChange,
}: {
  readonly role: ColorRole;
  readonly theme: ThemeTokens;
  readonly issues: readonly ContrastIssue[];
  readonly headers: Readonly<Record<Palette, string>>;
  readonly onChange: (palette: Palette, role: ColorRole, color: Oklch) => void;
}) {
  const nameId = useId();
  const name = t(ROLE_NAMES[role]);
  const colours = { colors: theme.colors, inverse: inverseColors(theme) };
  return (
    <tr className="border-t border-border align-top">
      <th id={nameId} scope="row" className="py-2 pr-3 text-left text-xs font-normal">
        {name}
      </th>
      {PALETTES.map((palette) => {
        const color = colours[palette][role];
        return (
          <td key={palette} className="py-2 pr-3">
            <div className="flex w-56 flex-col gap-1">
              <ThemeColorField
                id={`${nameId}-${palette}`}
                // "Brand Reversed sections": the row's name, then the column's.
                labelId={`${nameId} ${headers[palette]}`}
                field={{
                  kind: "themeColor",
                  label: name,
                  warnings: warningsOf(issues, palette, role),
                }}
                value={color}
                onChange={(next) => {
                  // The field reports a colour in OKLCH (its own check).
                  onChange(palette, role, next as Oklch);
                }}
                onCommit={() => undefined}
              />
              {isShaded(role) ? <Shades name={name} color={color} /> : null}
            </div>
          </td>
        );
      })}
    </tr>
  );
}

/**
 * Theme Studio's colours (F-DS-7): every colour role, the page's and reversed sections' side by side,
 * each with its shades and what its contrast lacks below AA, in both. A change asks first (D7).
 */
export function StudioColours({
  theme,
  onChange,
}: {
  readonly theme: ThemeTokens;
  readonly onChange: (palette: Palette, role: ColorRole, color: Oklch) => void;
}) {
  const pageId = useId();
  const reversedId = useId();
  const headers = { colors: pageId, inverse: reversedId };
  const issues = contrastIssues(theme);
  return (
    <table className="w-full border-collapse text-xs">
      <caption className="sr-only">{t("theme.studio.section.colors")}</caption>
      <thead>
        <tr>
          <td />
          <th id={pageId} scope="col" className="pb-1 text-left font-medium">
            {t("theme.studio.page")}
          </th>
          <th id={reversedId} scope="col" className="pb-1 text-left font-medium">
            {t("theme.studio.reversed")}
          </th>
        </tr>
      </thead>
      <tbody>
        {ROLES.map((role) => (
          <ColourRow
            key={role}
            role={role}
            theme={theme}
            issues={issues}
            headers={headers}
            onChange={onChange}
          />
        ))}
      </tbody>
    </table>
  );
}
