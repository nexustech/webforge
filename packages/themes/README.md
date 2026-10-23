# @webforge/themes

A site's theme (2.1) as CSS, its colours and contrast checks, and the starter presets. The tokens themselves (`ThemeTokens`) and colour refs live in `@webforge/model`.

## Public API
- **`themeCss(tokens)`:** the theme as Tailwind and daisyUI source. The pipeline puts it after Tailwind's imports in the site's stylesheet. It contains:
  - daisyUI with none of its built-in themes, plus the site's own theme (every colour role, corners, border, depth and noise), named after the preset and the page's default;
  - a second theme, `inverseThemeName(tokens)` (`<preset>-inverse`), for sections that invert the page: the theme's `inverse` colours, or `inverseColors`' fallback (`neutral` as the surface, `neutral-content` as the text);
  - an `@theme` block: `font-sans` (body), `font-heading`, the spacing unit, the type scale as `text-h1` … `text-small`;
  - shades 50–950 of the colour roles (`primary-300`). Each theme sets them as `--wf-color-<role>-<step>` and the utilities read them where they're used, so they follow inverse sections. They're fixed values, not relative colours, which Safari 16.4–17 can't compute;
  - `--wf-*` variables for links, buttons and the shadow.
- **Colours:**
  - `contrastRatio(foreground, background, opacity?)`: WCAG 2, with a see-through foreground laid over the background first;
  - `oklchToSrgb(color)`: gamma-encoded and clipped, for swatches;
  - `shadeOf(color, step)`;
  - `hexToOklch(hex)`: a colour field's own `#rrggbb` colour, for contrast and swatches;
  - `resolveColorRef(tokens, ref, palette?)`: what a colour style field's value shows, for swatches and contrast;
  - `inverseColors(tokens)`.
- **`contrastIssues(tokens)`:** the pairs below AA in the page's colours and the inverse sections'. Text needs `AA_TEXT` (4.5); brand colours on every surface need `AA_LARGE` (3).
- **`oklchCss(color)`:** a colour as daisyUI writes it.
- **`THEME_PRESETS`** and **`themePreset(name)`:** light (a new site's), dark and high-contrast-rounded.
- **Fonts (2.2):**
  - `FONT_CATALOGUE`: the ~50 families the installer bundles, from `src/fonts/catalogue.json`, which `pnpm font-catalogue` writes from Fontsource. Each has its CSS family, fallback, licence (OFL-1.1, Apache-2.0 or UFL-1.0 only, checked when it loads), npm package and version, and the files bundled (Latin and Latin Extended) with their sizes and SHA-256;
  - `FONT_PAIRINGS`: the 15 tested pairings, a heading and a body font each; their names are `t("fonts.pairing.<id>")`;
  - `catalogueFont(id)`, `fontRefOf(font)` (the font as a theme stores it), `bundledFontBytes(fonts)` and `FONT_BUDGET_BYTES` (15 MB).

Every value written into CSS comes from a token the model's schema checked, so nothing a site contains reaches the stylesheet as written.

## Boundaries
- Framework-free; depends on `@webforge/model` and zod only (its tests also read `@webforge/i18n`, to check every pairing and category has a name).
