# 0009. Colour references: theme roles and shades, or a field's own hex colour

- Status: Accepted
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
2. **A custom colour belongs to the field, not the theme.**
   - Only Advanced mode's colour field can set one, through a *Custom* choice. Theme Studio's "custom colour" means editing a role's own colour, which the theme tokens already allow.
   - It's exported as a Tailwind arbitrary class (for example `bg-[#1f6feb]`). The in-memory Tailwind compile picks it up from the document for both the canvas and the export, so no safelist is needed.
   - Theme changes don't restyle it, and the field marks it as off-theme. It's still contrast-checked.
   - Simple mode offers theme colours only. A custom colour set in Advanced mode stays when the person switches to Simple mode, shown read-only, with a way to switch it to a theme colour.
3. **The UI names the roles** with the glossary's words: **Brand** (`primary`), **Accent** (`secondary`), **Second accent** (`accent`), **Surface** (`base-100/200/300`) and **Text** (`base-content`). The model keeps daisyUI's names.
4. **The contrast warning uses WCAG 2.x AA by text size:** 3:1 for large text (at least 24 px, or 18.66 px at weight 700 or more, at the theme's type scale; the smallest size if it differs by device), and 4.5:1 for everything else.

## Consequences
- Sites stay on-brand by default: everyone picks from the theme, and an off-theme colour needs Advanced mode and is visibly marked.
- A custom colour doesn't follow theme changes, which is the point for one-off colours but means a site-wide recolour misses it. Theme Studio or Site Check could later list off-theme colours.
- The theme model has no list of custom colours. If people want reusable named colours later, that would be a new theme field and a format migration.
- Values stored before colour references (for example a Heading colour of `default`) need mapping when 1.37's colour field switches to references: read as `base-content`, or migrated.
