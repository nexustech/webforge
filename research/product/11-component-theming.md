# Styling one component in depth, and CSS in Advanced mode

**Status:** ✅ Decided (CT-1…CT-9, product owner, 27 Oct 2026): CT-1…CT-5 and CT-7 join the MVP as three Phase 3 items, 3.12 on stream B after 3.7 and 3.13 and 3.14 on stream A after 3.11 (3.12 [#528](https://github.com/nexustech/webforge/issues/528), 3.13 [#529](https://github.com/nexustech/webforge/issues/529), 3.14 [#530](https://github.com/nexustech/webforge/issues/530); +12.5 days), CT-8 is v1.1, CT-6 is not adopted and CT-9 stays Later. The product owner's question: a way to click a component, see how it is styled, change specific parts of it (the layout of its icon and heading, its border, a gradient on its background, its padding), choose whether the change applies to this one or to every component of its kind, in a view or dialog with a preview, and understand how all of that relates to the theme's variables. And for Advanced mode: show the generated CSS and let people edit stylesheets by hand. This note sets those wishes against what [product/08](08-component-styling.md) decided (ST-1…8) and what has merged since, and proposes nine things, decided the same day (§4).

**Goal:** deeper styling of one section or element than the Appearance group gives, for the people who want it, without giving Simple mode a CSS inspector; and in Advanced mode, the CSS as a thing you can read and, in its own stylesheet, write.

## 1. Method and limits

Read against the code on `main` of 27 Oct 2026 (2.22a and 2.22b's Appearance group, 2.25's text marks, 2.27's *Apply this look*, 2.26's section backgrounds in review), ADR 0009, `docs/components.md`, the MVP spec (F-ED-4, F-ED-11, F-ED-15, F-DS-3, F-DS-7) and the competitor models in [product/08](08-component-styling.md) §2. No new competitor research: Webflow's classes and variables, Pinegrow's rules, Bootstrap Studio's style target and Elements' token inspector are described there and are not repeated. Effort is in ideal days against today's code.

## 2. Where Webforge stands

A component's look comes from three layers:

| Layer | What it is | Where it is changed | Reach |
|---|---|---|---|
| **The theme** | Design tokens: colour roles with shades, fonts, the type scale, radius (box, field, selector), border width, shadow scale, spacing scale, and from 2.13d the headings' case and tracking, the card style, photo corners and the sections' rhythm | Theme tab, Theme Studio (F-DS-7) | Every component, every page |
| **This item's Appearance** (2.22, ST-1, ST-2) | Text, Colour, Corners, Border, Shadow, Opacity and a hover row, each a token, per device, *Theme's* until changed | The Style tab's first group | This item; *Apply this look to every ‹kind›* (2.27, ST-4) copies it to the others as one undo step |
| **Advanced** | A hex colour off the theme (ADR 0009), CSS classes with a browser (2.18), attributes, an anchor id; the site's `custom.css`, `custom.js` and head and body snippets (F-ED-15) | The Advanced tab; Custom Code | This item, or whatever the stylesheet's selectors match |

What the product owner's wishes find missing:
- **No layer between an item and the theme.** "Apply to every Feature" is a copy: a later change to one Feature does not follow to the rest, and a new Feature starts from the theme. Webflow's class, Pinegrow's Style and Bootstrap Studio's linked component all give a kind a look that later edits follow; Webforge has it for one kind only, cards, as a theme token.
- **The Appearance group is the basics.** No gradient, no border per side, no padding on elements, no title styling beyond a section's title text, no per-corner radius. 2.26 adds an image with an overlay to sections.
- **Layout is a section's choice.** The Features section's layout (Cards, Centred, List: the icon beside the text) decides every feature in it; a feature cannot differ.
- **The Style tab is the only surface**, and it is narrow and long. Theme Studio has a large dialog with previews, for the theme.
- **Nothing shows the CSS.** The export writes readable, byte-stable HTML and CSS (the golden output tests, X4), and the in-app Tailwind compile makes the same stylesheet for the canvas, but neither is visible in the editor. Custom Code's stylesheet is a plain text field. Per-element CSS is Later (spec/02 §5, product owner, 24 Oct 2026).
- **Nothing says where a value came from.** A control shows *Theme's* or its value, not which theme token it reads or whether Advanced mode overrode it.

## 3. Proposals

### 3.1 Styling one component

| ID | Proposal | Effort | Target |
|---|---|---|---|
| CT-1 | **Component looks in the theme.** The theme gains a look per kind of section and element (Button, Feature, Card, Hero…): the Appearance tokens, stored once in the theme. A kind draws itself from its look, an item's own Appearance sits above it, and the theme's existing card style folds into the Card look. Theme Studio gets a *Components* page: each kind rendered live in the theme with its look's controls beside it, so a kind can be styled without selecting an instance, and a theme preset can ship its own looks. Stored in the theme rather than beside it, so *My themes* (2.23) and a theme switch carry them | 3 | MVP, 3.12 [#528](https://github.com/nexustech/webforge/issues/528) |
| CT-2 | ***Style this ‹component›…*, a dialog for deeper styling of the selected item, of any kind.** Opened from the Style tab, the selection's quick actions and the right-click menu. In Theme Studio's chrome, because the Style tab is too narrow: **a live preview of the item on its own** in the site's theme, Desktop and Mobile side by side, updating as values change (the canvas shows it in place too); **groups beyond the basics:** Background (theme colour with shade, a gradient between two roles with a direction, an image with a focal point and overlay), Border (per side: width, colour, style), Corners (per corner), Shadow (outer or inner, strength), Title (size, weight, case, colour, alignment; a section's subtitle too), Spacing (padding and margin per side, per device), When hovered (colour, lift, scale, transition); **where it applies, chosen at the bottom:** *This one only* · *Every ‹kind› on this page* · *Every ‹kind› on the site* (2.27's copies) · *Make it the theme's look for ‹kind›* (CT-1's look, which later edits follow), with the count and the D7 confirmation for anything beyond the page. Every control is a theme token in Simple mode; Advanced mode adds ADR 0009's hex colour and CT-7's CSS tab. **The deeper groups live in the dialog only; the Style tab keeps the compact Appearance basics** (product owner, 27 Oct 2026), showing the same values where they overlap. The preview reuses the components' story rendering; the groups extend 2.22's Appearance fields rather than adding a second system | 5 | MVP, 3.13 [#529](https://github.com/nexustech/webforge/issues/529) |
| CT-3 | **Provenance on every Appearance control**, in the Style tab and the dialog, in words rather than Webflow's label colours: *Theme's (Corners: Medium)*, *Theme's look for Buttons*, *Set here*, *Set on Mobile*, *Custom colour (Advanced)*, *Class (Advanced)*. Clicking a theme provenance opens that token in the Theme tab. This is the answer, inside the panel, to how an item relates to the theme's variables | 1 | MVP, 3.12 [#528](https://github.com/nexustech/webforge/issues/528) |
| CT-4 | **A gradient background token:** two theme roles with shades and a direction (to bottom, to right, two diagonals), in CT-2's Background group and, as one chip, in the Style tab's Colour control. Both ends are roles, so a theme switch and dark mode keep working. Exported as Tailwind gradient classes from the theme's colours, no inline style | 1 | MVP, 3.13 [#529](https://github.com/nexustech/webforge/issues/529) |
| CT-5 | **Padding for elements** as the spacing token (Small, Medium, Large), per device, in CT-2's Spacing group and the Style tab's Appearance group; sections have padding and margin already | 0.5 | MVP, 3.13 [#529](https://github.com/nexustech/webforge/issues/529) |
| CT-6 | **Per-item layout switches are not proposed.** The icon above or beside the title stays the Features section's layout, as in every builder reviewed; mixed rows read as a mistake. A missing row style becomes a fourth section layout instead | – | Not proposed |

### 3.2 CSS in Advanced mode

| ID | Proposal | Effort | Target |
|---|---|---|---|
| CT-7 | **A read-only *CSS* tab for the selected item**, in Advanced mode, in CT-2's dialog and the Advanced tab: the markup the item exports, the classes each Appearance control produced (grouped by control, with the token behind each), and the matching rules from the site's stylesheet as the export writes them, with a copy button on each. The in-app Tailwind compile and the readable export exist, so this is a view, not a new pipeline. It shows what the tokens do, and is the honest form of "show me the generated CSS": the stylesheet Webforge writes is not editable, since the next change would rewrite it | 2 | MVP, 3.14 [#530](https://github.com/nexustech/webforge/issues/530) |
| CT-8 | **A real stylesheet editor for the site's `custom.css`** (F-ED-15): highlighting, lint and completion of the theme's CSS variables and the site's classes (CodeMirror 6, MIT), applied live on the canvas, each pause one undo step ("Edited site CSS"). Two bridges to the selected item: ***Target this element*** inserts a selector for it (a section's anchor id, or a stable `data-wf-id` attribute Webforge writes in Advanced mode), and ***Move this look to CSS*** turns the item's Appearance tokens into a rule in the stylesheet with a class on the item, the reverse of Bootstrap Studio's inline-style fixer. Site Check warns on external URLs in the CSS (C8), on rules that match nothing, and counts items styled off-theme. The stylesheet is still loaded after Webforge's (F-ED-15), so a theme switch keeps working for everything not overridden | 3 | v1.1 (decided) |
| CT-9 | **Per-element CSS (an inline-style editor) stays Later**, as decided on 24 Oct 2026: inline styles break theme switching and dark mode, resist undo granularity and make the export unreadable. CT-8's targeted rule gives the same power in a readable stylesheet | – | Later, as now |

### 3.3 Cost and place

CT-1 to CT-5 and CT-7 come to **12.5 days**, as three Phase 3 items, in this order so each builds on the last (3.12 on stream B after 3.7, 3.13 and 3.14 on stream A after 3.11, 3.13 once 3.12 has merged):
1. **3.12 Component looks and provenance** (CT-1, CT-3): 4 days, [#528](https://github.com/nexustech/webforge/issues/528).
2. **3.13 *Style this component…*** (CT-2 with CT-4 and CT-5): 6.5 days, [#529](https://github.com/nexustech/webforge/issues/529).
3. **3.14 The CSS view** (CT-7): 2 days, [#530](https://github.com/nexustech/webforge/issues/530).

CT-8 is a v1.1 item of about 3 days; it needs CT-7's selectors and 2.18's class catalogue. Nothing here changes the exported site's rules: no CDN, no inline styles, readable CSS.

## 4. Decisions

| ID | Decision |
|---|---|
| CT-1 | ✅ **MVP, 3.12** ([#528](https://github.com/nexustech/webforge/issues/528), 3 days): component looks in the theme, with Theme Studio › Components. Stored in the theme, so presets and *My themes* carry them (product owner, 27 Oct 2026) |
| CT-2 | ✅ **MVP, 3.13** ([#529](https://github.com/nexustech/webforge/issues/529), 5 days): *Style this ‹component›…* for any kind, with the live preview, the deeper groups and the four apply choices. The deeper groups live in the dialog only; the Style tab keeps the compact Appearance basics (product owner, 27 Oct 2026) |
| CT-3 | ✅ **MVP, 3.12** (1 day): provenance on every Appearance control |
| CT-4 | ✅ **MVP, 3.13** (1 day): the gradient background token |
| CT-5 | ✅ **MVP, 3.13** (0.5 day): padding for elements |
| CT-6 | ❌ **Not adopted:** per-item layout switches; a missing row style becomes a section layout |
| CT-7 | ✅ **MVP, 3.14** ([#530](https://github.com/nexustech/webforge/issues/530), 2 days): the read-only CSS view in Advanced mode |
| CT-8 | ✅ **v1.1:** the stylesheet editor for `custom.css`, with *Target this element* and *Move this look to CSS* (spec/02 §5) |
| CT-9 | ✅ **Later**, as decided on 24 Oct 2026: no per-element CSS |

3.12 goes to stream B after 3.7 and 3.13 and 3.14 to stream A after 3.11 (product owner, 27 Oct 2026, levelling the streams): +12.5 days, Phase 3 from 37.5 to 50 days.

### 3.12 implementation notes (27 Oct 2026)
Choices within CT-1 and CT-3, agreed with the coordinator as following existing rules (ADR 0009, 2.27, ADR 0012):

1. **Kinds (CT-1):** every component with an Appearance group has a look, keyed by its type (`Button`, `Hero`, `CallToAction`…). Theme Studio › Components lists them by the Add panel's categories.
2. **A look's fields (CT-1):** the Appearance group's thirteen, and the hover row where the kind has one (hover, speed, easing): what 2.27's *Apply this look* copies, so "apply to every Button" and "the theme's look for Buttons" agree.
3. **Colours (CT-1):** a look holds the theme's colours only, never a custom hex: a custom colour belongs to the one item it's set on (ADR 0009).
4. **Precedence (CT-1):** per field, whole values. An item's own value (set once or per device) wins; a field it doesn't set takes its kind's look; else the component's default. *Reset* deletes the item's value, so it follows the look again, as 2.27 deletes the values it sets to the theme's. A look can be set per device as an item's can.
5. **Cards and buttons (CT-1):** the theme's card style and button tokens fold into the Card and Button looks in what the person sees: the Components page shows `cards.style` as the Card look, and `buttons` (shape, size, style) beside the Button look's fields. Both stay where they are in the theme, so every preset's golden CSS stays byte-identical and saved themes in *My themes* stay valid. Cards are list items without an Appearance group of their own, so their look stays the theme's card style.
6. **Format (CT-1):** `looks` is a new optional theme field. Format 9 bumps the version only (as 2.23's 7 → 8 did), so an older build opens a site with looks read-only rather than drop them; a v9 fixture with looks and the inverse step.
7. **Provenance (CT-3):** *Theme's (‹token›: ‹value›)* names a token only where one theme token decides the value: corners from `radius.box` for sections and cards and `radius.field` for Buttons and fields, shadow from `theme.shadow`, border from `border.thin`, size from the type scale's style; elsewhere plain *Theme's*. Clicking it opens the Theme tab at that token (a reveal-field request). *Class (Advanced)* shows only when the item's Advanced classes include a utility for that property (`rounded-`, `shadow-`, `border-`, `opacity-`, `text-`, `bg-`, `font-`).

## 5. Sources

- [product/08](08-component-styling.md): the competitor models (§2), the comparison table (§3), ST-1…ST-8.
- [ADR 0009](../../docs/adr/0009-colour-refs.md): theme colours and the Advanced-mode hex colour.
- [docs/components.md](../../docs/components.md): the section frame, the Appearance group, the token rule (C4, F-ED-4).
- [MVP spec](../../spec/02-mvp-spec.md): F-ED-4, F-ED-11, F-ED-15, F-DS-3, F-DS-7, §5 (per-element CSS: Later).
- Plan items 2.22 ([#494](https://github.com/nexustech/webforge/issues/494)), 2.26 ([#503](https://github.com/nexustech/webforge/issues/503)), 2.27 ([#504](https://github.com/nexustech/webforge/issues/504)), 2.18 ([#276](https://github.com/nexustech/webforge/issues/276)).
- CodeMirror 6 licence: [MIT](https://github.com/codemirror/dev/blob/main/LICENSE) (to confirm with `pnpm licence-check` before CT-8).
