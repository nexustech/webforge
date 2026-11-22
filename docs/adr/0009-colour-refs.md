# 0009. Colour references: theme roles and shades, or a field's own hex colour

- Status: Accepted; amended 21 Nov 2026 (TC-1a, #1217): see the amendment below
- Date: 2026-10-23
- Related: [spec/04 items 1.37](../../spec/04-implementation-plan.md) (#185) and 2.1 (#43), UX-25 in [product/06](../../research/product/06-editor-ui-ux-parity.md), F-DS-1, F-DS-3, glossary colour roles in [product/01](../../research/product/01-terminology.md)

## Context

2.1 replaces the site's theme name with theme tokens (site format 5), and 1.37 adds a colour field to the Edit panel. Both need one way to say which colour a style field uses.

UX-25 says the colour field offers theme colours first, with shades and opacity, and allows a custom colour "only in Advanced or the Theme Studio, to keep sites on-brand". Two designs were considered:

- **A theme-level list of named custom colours** that fields refer to by id, so style fields would only ever hold theme tokens.
- **A field-level hex colour** in Advanced mode, outside the theme.

The product owner chose the second on 2026-10-23.

## Decision

1. **Style fields hold a colour reference,** validated by `colorRefSchema` in `@webforge/model` (`color-ref.ts`):
   - `<role>[-<shade>][/<opacity>]` for a theme colour. The role is one of daisyUI's 20 colour roles (for example `primary`, `base-content`). Shades (50, 100, 200 … 900, 950) exist only for the 8 colour roles `primary`, `secondary`, `accent`, `neutral`, `info`, `success`, `warning` and `error`, not for `base-*` or `*-content`. The opacity is one of the steps 5, 10, 20, 30 … 90 (so `/85` is refused).
   - `[#rrggbb][/<opacity>]` for a custom colour: exactly six hex digits, stored in lower case, with no shade. Nothing else is allowed inside the brackets (no CSS variables, functions or other arbitrary values), so a reference can't inject CSS.
   - `parseColorRef` and `formatColorRef` convert between the string and its parts.
2. **A custom colour belongs to the field, not the theme.** **Amended (TC-1a, #1217):** the theme now has the person's own colours too, which a reference names by id (`own-<id>`), so a colour the business owns is the theme's. A one-off hex colour still belongs to the field, as below.
   - Only Advanced mode's colour field can set one, through a _Custom_ choice. Theme Studio's "custom colour" means editing a role's own colour, which the theme tokens already allow.
   - It's exported as a Tailwind arbitrary class (for example `bg-[#1f6feb]`). The in-memory Tailwind compile picks it up from the document for both the canvas and the export, so no safelist is needed.
   - Theme changes don't restyle it, and the field marks it as off-theme. It's still contrast-checked.
   - Simple mode offers theme colours only. A custom colour set in Advanced mode stays when the person switches to Simple mode, shown read-only, with a way to switch it to a theme colour.
3. **The UI names the roles** with the glossary's words: **Brand** (`primary`), **Accent** (`secondary`), **Second accent** (`accent`), **Surface** (`base-100/200/300`) and **Text** (`base-content`). The model keeps daisyUI's names.
4. **The contrast warning uses WCAG 2.x AA by text size:** 3:1 for large text (at least 24 px, or 18.66 px at weight 700 or more, at the theme's type scale; the smallest size if it differs by device), and 4.5:1 for everything else.

## Consequences

- Sites stay on-brand by default: everyone picks from the theme, and an off-theme colour needs Advanced mode and is visibly marked.
- A custom colour doesn't follow theme changes, which is the point for one-off colours but means a site-wide recolour misses it. Theme Studio or Site Check could later list off-theme colours.
- The theme model has no list of custom colours. If people want reusable named colours later, that would be a new theme field and a format migration. **Resolved by the amendment below:** this is the way taken.
- Values stored before colour references (for example a Heading colour of `default`) need mapping when 1.37's colour field switches to references: read as `base-content`, or migrated.

## Amendment, 21 Nov 2026 (TC-1a, #1217)

The product owner's first request (option B of [product/18](../../research/product/18-theme-colours-and-code-editing.md) §6, PH5-4): a colour the business owns behaves like Brand everywhere. It is added to the theme and named, and one change to it reaches every place it's used. This resolves the cost the Consequences accepted. The way back they described is the way taken: a new theme field and a format migration.

1. **The theme has the person's own colours** (`ownColors` in `themeTokensSchema`, site format 17): each with an id, a name and a colour in OKLCH. They travel with the theme, so _My themes_ carry them. A theme switch keeps the site's (they're the business's, not the preset's), and one of the person's own themes brings its own.
2. **A colour reference has a third base:** `own-<id>[-<shade>][/<opacity>]`, with the 11 shades and the opacity steps as the colour roles have them.
   - The id is lower-case letters and digits, a letter first, at most 24 characters. So it goes into a class name and a CSS variable as it is (`bg-own-sky-300`, `--color-own-sky`), holds nothing CSS reads as syntax, and has no dash for a shade to be mistaken for.
   - A colour's name is never written into CSS.
   - A one-off is still exactly six hex digits between the brackets and nothing else (§1): that is what stops CSS being injected through a colour.
3. **The theme's CSS** declares each colour's variable and its shades' (`--wf-color-own-<id>…`), and Tailwind utilities that read them (`@theme inline`).
   - Adding or removing a colour changes the stylesheet's shape: one compile.
   - Changing its value doesn't (`themeShape` keeps the ids with placeholder values).
   - In reversed sections each colour has a value worked out from it: as it is where it stands apart from their surface by 3:1, else the nearest lightness in its hue and chroma that does.
4. **Everything that reads a reference reads the new base,** through `resolveColorRef`: the canvas, Preview, the export, the contrast warnings and Site Check. A reference to a colour the theme no longer has draws nothing and is measured as nothing.
   - The command API refuses one an AI app sets.
   - Site Check measures a colour where text or an icon uses it, as it measures any colour field's. Not on its own: a pale colour kept for backgrounds isn't hard to read until it's text. `ownColorIssues` measures each colour as the brand colours other than the main one are (3:1 on every surface, in both palettes), for Theme Studio's warnings in 5.28.
5. **Theme Studio's list and the picker's (5.28, TC-1b, #1218).** Theme Studio › Colours lists the colours: add, rename, change and delete, each one undo step, and a search from six. Up to 200 (`OWN_COLORS_MAX`), which a theme's stylesheet keeps small. Each says under it where `ownColorIssues` finds it hard to read as text.
   - A new colour's id is random letters (`newOwnColorId`), so a rename changes no reference.
   - Deleting a colour in use asks: its uses go to another of the colours, shade and opacity kept, or each becomes a one-off hex colour as it looks now (`rewriteOwnColorUses`, in the same step). Nothing is left pointing at a colour that's gone.
   - Every colour field's picker lists them under _Your colours_, with their shades and opacity, either end of a gradient included.
   - A colour value's JSON Schema describes `own-<id>` for AI apps, which read the colours from the `theme` query and add them with `setThemeTokens`.
