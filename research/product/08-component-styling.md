# Styling One Section or Element: What Competitors Offer

**Status:** ⏳ Proposed 2026-10-26, awaiting the product owner's decision ([§6](#6-decisions))
**Date:** 2026-10-26
**Goal (product owner, 2026-10-26):** "Theming and styling of components is a key requirement; we should be able to style an individual component, e.g. select a section and allow it to be underlined." This note looks at how Pinegrow, Webflow, RapidWeaver Elements and Bootstrap Studio let a user style one component, how much freedom each gives, and what Webforge should take from them.
**Builds on:** the theme model (F-DS-1…7, [03-starting-content](03-starting-content.md)), the Edit panel's token rule (F-ED-4, `docs/components.md`), the parity note ([06](06-editor-ui-ux-parity.md)) and the competitor reviews ([Webflow](../competitors/01-webflow.md), [Pinegrow](../competitors/02-pinegrow.md), [Bootstrap Studio 9.0](../bootstrap-studio/06-bootstrap-studio-9.md), Elements in the [gap analysis §3.7](05-feature-gap-analysis.md#37-rapidweaver-elements-30-update-2026-10-22)).

## 1. Method and limits
- **Official docs** for all four: Webflow's Style panel, classes, states, style labels, variables and components pages (read through search summaries, since Webflow blocks fetches); Pinegrow's Style panel, Tailwind visual controls, Class Tree, Styles, Content Workspace and editable-areas pages; Elements' Inspector common-controls pages (typography, backgrounds, spacing, borders, effects, filters, transforms, transitions, advanced), Theme Studio and the Elements API property types; Bootstrap Studio's Options panel, CSS, themes, animations and text-editing pages, plus the [screenshot pass](../bootstrap-studio/07-editor-screenshot-pass.md) of the running 9.0.1 app (screenshots 08, 11, 12, 24, 44, 65).
- **Forums and third-party tutorials** where the docs stop (Webflow spans, Elements' Text limits, Bootstrap Studio's hover advice).
- **Not done:** none of the four was driven for this note; no new screenshots. Items marked *unverified* could not be confirmed on an official page.
- **IP rule (unchanged):** we copy patterns and conventions, never code, CSS, icons, images or wording.

## 2. The four models
### 2.1 Webflow: everything is a class
- Every element gets a class, auto-named; **styles live on classes, never on the element**. Changing "this card" changes every card with the class, and the only warning is an *Affected elements* count. Isolating one element means a new class or a combo class.
- The Style panel is a full CSS inspector in nine groups: Layout, Spacing, Size, Position, Typography (incl. decoration: none, underline, strikethrough; text shadow), Backgrounds (stacked images, gradients, overlays), Borders (per side, per corner), Effects (blend, opacity, box shadows, 2D/3D transforms, transitions, filters, backdrop filters, cursor) and Custom properties (free CSS pairs).
- **States** per class: hover, pressed, focused, visited, placeholder, current. **Breakpoints** cascade from desktop. Style labels: blue set here, orange inherited, pink grid-only, purple bound to a **variable** (design token: colour, size, font, number, with modes such as dark).
- **Text inside a paragraph:** the toolbar has bold, italic, superscript, subscript and link. To underline or colour a word you wrap it in a span, give the span a class and style that class.
- Components get content, image, link and visibility properties plus **style variants** chosen per instance; per-instance style properties were announced for late 2026 (*unverified*).
- Flexibility: everything CSS can do, through forms. Cost: the user must understand classes, the cascade and the label colours before "why won't this change" makes sense.

### 2.2 Pinegrow: CSS rules in real stylesheets, or Tailwind classes
- **Plain CSS:** the Style panel lists the rules that hit the element (inline `style` first); the user types or composes a selector, picks the stylesheet, and edits the rule in a visual editor (sections with draggable numbers, shadow and transition lists, media-query picker, CSS variables tab). "This element only" is the inline style, which the docs discourage and offer to move into a rule.
- **Tailwind:** a visual-controls panel adds or swaps utility classes by section (Text with Decoration, Margin & Padding, Dimension, Display, Position, Background, Border, Shadow/Ring/Blend, Flex, Grid, Transform, Transition, Filter…), with breakpoint tabs and a pseudo-class picker (hover, focus, dark…). A **Class Tree** shows every class on the element and its ancestors. **Styles** are named class groups applied to many elements, with an *Inline* pill that confines an edit to one element. Floating on-canvas tools set text colour, family, size, weight, decoration and background.
- **Inline text:** bold, italic and link in the page editor; the v10 Content Workspace adds underline, strikethrough and lists, but no colour.
- **Components:** an instance may change only what the definition exposes (content, named attributes, declared optional classes, a background image); styles come from the definition.
- Flexibility: total, and every label is a CSS or Tailwind concept. Its own forum calls it a tool for people who already know HTML and CSS.

### 2.3 RapidWeaver Elements: a token inspector that hides Tailwind
- Every built-in component shares one set of **common controls** groups in the Inspector: Typography (family, size, weight, italic, **decoration** with style, offset and colour, spacing, line height, alignment, case, text shadow), Backgrounds (colour, gradient incl. conic, image, overlay), Spacing (theme tokens or manual values, drag to adjust), Borders (per side, per corner), Effects (shadow, opacity), Filters, Transforms, Transitions.
- **Every value is a theme token:** colours are a role and shade (Brand 500) plus opacity, sizes come from the theme scale, spacing, radius, shadow and border width from theme scales. A one-off colour needs a new palette in Theme Studio or a Tailwind class in the Advanced group. Spacing alone has a Theme/Manual switch.
- **Hover** is a first-class concept: any colour, background, border, effect, filter or transform group can be *Static* or *Hover*, with start and end states and a trigger (self, parent, container). **Breakpoints:** a dot per control, grey inherited, blue overridden. **Dark mode:** every colour has a light and a dark value, set by flipping the editor's Light/Dark toggle.
- **Globals** (linked instances) let a single property be unlinked and overridden on one instance while the rest stays linked.
- **Text:** the Text element formats the whole block; there is **no inline bold, italic, underline or link** inside a paragraph. Prose needs the Markdown component.
- Flexibility: deep per-element control with no CSS in sight; the cost is that the Static/Hover/start/end pattern repeats in five groups and every colour is a role plus shade.

### 2.4 Bootstrap Studio: a CSS editor with a style target
- The **Appearance** tab writes CSS declarations: box-model diagram, then Layout, Font, Background, Border, Box Shadow, Text Shadow, Positioning, Transform groups, each with copy, paste and reset (screenshots 11, 12). The **style target** (ancestor chips and a dropdown, screenshot 65) decides where a change is written: the element's inline style by default, an existing rule that matches, or a new rule in the user's stylesheet; Bootstrap's own CSS is locked. Media queries and `:hover` can be set on the target block (*unverified* wording).
- The **Options** tab is per-component Bootstrap settings (variant, size, outline…) plus generic groups (Text, Display & Sizing, Flexbox, Borders, Margin & Padding) that write Bootstrap utility classes per breakpoint. The docs recommend Options over Appearance, and 8.0 added a fixer that extracts inline styles into classes, which says how often the default misfires.
- **Theme** panel: Bootstrap's variables (colours, text, borders, focus) for light and dark (screenshot 44). **Animations** tab: scroll, hover and load presets.
- **Inline text:** bold, italic, underline, strikethrough, link, colour, highlight, sub, sup, clear (screenshot 24).
- **Linked components** share content and styling across copies; a child can be unlinked to vary.
- Flexibility: any CSS property on any element without typing CSS, but reuse, hover on Bootstrap components and coloured text runs need the Styles editor or a span with a class.

### 2.5 Webforge today (merged and planned)
- **Theme** (site-wide): colours as daisyUI roles named Brand, Accent, Surface, Text; fonts; type scale; button styles; roundness; spacing, shadow scales; light and dark values; Theme Studio (F-DS-1…7, PH2-5…7).
- **Section:** light or dark variant of the theme (F-DS-3); padding and margin tokens from the section frame; a layout variant; per-section options such as a Hero's image side.
- **Element:** the Style tab shows what each component declares: tokens only (`select`, `toggle`, `slider`, `color` from theme roles, `spacing`, `box`), any of them per device (F-ED-4, the rule in `docs/components.md`). A Button has *Theme's style, Filled, Second colour, Outline* (PH2-14). There is no shared set of text, colour, border or shadow controls across components: each declares its own few.
- **Text inside a paragraph:** bold, italic, link, lists, alignment (F-ED-3). **Underline, strikethrough, colour and highlight are deliberately off** so links stay the only underlined text and pasted Word formatting is dropped (`RICH_TEXT_OPTIONS`).
- **Advanced mode:** a CSS classes field with autocomplete and a class browser (2.18), attributes, anchor ID; Custom Code with a site stylesheet (F-ED-15). **Per-element CSS editing is Later** (spec/02 §5, product owner 2026-10-24).
- **Per-device dots and a changed cue** on every control (UX-19, 1.36), *Copy style* and *Paste style* between elements (1.37).

## 3. Comparison
| Capability on one section or element | Webflow | Pinegrow | Elements | Bootstrap Studio | **Webforge MVP (today)** |
|---|---|---|---|---|---|
| Where a style lives | A class (shared by default) | A CSS rule or inline style; Tailwind classes | The element's own token choices (classes generated) | Inline style by default, or a chosen rule | The element's own token choices |
| Text: size, weight, italic, alignment | ✅ | ✅ | ✅ tokens | ✅ | Partly: per component (Heading size, alignment on some) |
| Text: **underline / decoration** | ✅ (class) | ✅ | ✅ with style, offset, colour | ✅ | ❌ (links only, from the theme) |
| Text colour | ✅ any | ✅ any | ✅ role + shade | ✅ any | Partly: some components offer theme colours |
| Background colour / gradient / image | ✅ layers | ✅ | ✅ incl. conic gradients | ✅ | Section light/dark variant; Hero image |
| Spacing | ✅ any value | ✅ | ✅ tokens or manual | ✅ | ✅ tokens (section frame) |
| Border and corners | ✅ per side/corner | ✅ | ✅ tokens per side/corner | ✅ | ❌ (theme roundness only) |
| Shadow, opacity | ✅ | ✅ | ✅ tokens | ✅ | ❌ |
| Filters, transforms, transitions | ✅ | ✅ | ✅ | ✅ (transform) | ❌ |
| **Hover** state | ✅ per class | ✅ pseudo-class | ✅ Static/Hover groups | Via CSS rule | Theme-level only (buttons, links) |
| Per breakpoint | ✅ cascade | ✅ tabs | ✅ dots | ✅ media query on the rule | ✅ per-device dots on tokens |
| Dark values | Variable modes | `dark:` variant | ✅ light/dark per colour | Theme variables | ✅ from the theme roles |
| One element vs all like it | Class vs combo class | Inline pill vs Style | Global unlink per property | Inline vs rule (style target) | This element only; *Copy/Paste style* |
| Bold a word; **underline or colour a word** | Bold ✅; underline/colour via span + class | Bold ✅; underline (Content mode); no colour | ❌ none in Text | ✅ all, in the toolbar | Bold, italic, link ✅; underline, colour ❌ |
| Site-wide tokens | Variables | Design panel (CSS vars / `@theme`) | Theme Studio | Theme panel (Bootstrap vars) | Theme panel + Theme Studio |
| Escape hatch | Custom properties, Embed | The stylesheet | Classes, ID, page CSS | Styles editor, SCSS | Classes field (Advanced), site CSS |
| Needs CSS or class literacy | Yes, from the start | Yes | No | For reuse and hover | No |

**Reading the table.** Three of the four give every element a full appearance inspector. Two of those (Webflow, Pinegrow) make the user pay in CSS concepts; Bootstrap Studio hides CSS behind forms but leaks it through the style target. **Elements is the one that reaches Webforge's audience:** the same groups on every component, every value a theme token, hover and dark mode built in, no class in sight. Its gap is prose: no inline formatting at all. Webforge is the mirror image today: good inline text and a strong theme, but the thinnest per-element styling of the five, and no underline anywhere.

## 4. What "select a section and underline it" needs
The request is a per-item **appearance** layer between the theme and the Advanced tab. For a section, "underline" most often means underlining its title, or a word inside its text; for a heading or a button it means the element itself. Both must be reachable without classes. The layers Webforge should have:

1. **Theme** (site-wide tokens and defaults): exists.
2. **Section theme**: light or dark variant: exists; add background colour from the theme roles and a background image (sections other than Hero).
3. **Appearance of the selected item**: a shared group of token controls on every section and element (ST-1), with a hover state where it matters (ST-2).
4. **Formatting inside text**: underline, highlight and colour on a word (ST-3).
5. **This one or all like it**: apply the change to this element only (default) or to every element of its kind (ST-4).
6. **Advanced**: classes, attributes, site CSS: exists; per-element CSS stays Later.

The token rule stays: no raw hex, no px (ST-6). It is what keeps a theme switch, dark mode and the contrast guideline working, and it is the exact difference between Elements and the tools that lose small-business owners.

## 5. Proposals
Effort: **S** ≈ days · **M** ≈ 1–2 weeks.

### 5.1 Proposed for the MVP
| # | Proposal | What the user sees | Effort | Where |
|---|---|---|---|---|
| ST-1 | **A common Appearance group on every section and element**, as Elements' common controls: **Text** (size from the type scale, weight, italic, underline, case, alignment), **Colour** (text and background from the theme roles with shade), **Corners** (theme radius scale), **Border** (none, thin, thick; theme colour), **Shadow** (theme scale), **Opacity** (steps). All tokens, all per device. Components keep their own fields; the group is added by `defineSection` and `defineComponent` and rendered as one collapsible group at the top of the Style tab, with the changed cue and per-device dots. A section's Text controls apply to its title | A section selected: Style tab shows *Appearance* ▸ Text · Colour · Corners · Border · Shadow, then the section's own options. Underline is one toggle | M (3 days framework + mapping in the primitives; sections get it through the frame, elements through a shared field set) | 2.5/2.19 primitives, 1.14 renderers; new item 2.22 |
| ST-2 | **Hover on buttons, links, cards and images:** a *When hovered* row under Colour and Shadow for the elements where it matters (Button, Card, Image, Icon), with token values | *Hovered: lift · darken · underline* | S (1 day, after ST-1) | 2.22 |
| ST-3 | **Underline, highlight and colour inside text:** three buttons in the text toolbar; colour and highlight pick from the theme roles (Brand, Accent, Text) so dark mode and a theme switch still work; strikethrough stays off. Pasted formatting is still reduced to the allowed marks. Site Check tip: *underlined text that isn't a link* | Select a word, press U, or choose a colour chip | S (1 day) | 1.23 follow-up, Phase 2 chore |
| ST-6 | **The token rule stays** (F-ED-4, `docs/components.md`): no free values in the Style tab. A one-off colour is added to the theme's palette in Theme Studio, as in Elements | — | — | Rule, no scope |

### 5.2 Proposed for v1.1
| # | Proposal | Effort | Note |
|---|---|---|---|
| ST-4 | **Apply to all of this kind:** a menu action on a styled element, *Apply this look to every Button on the site* (or on this page), which copies its Appearance tokens to the others as one undo step; the reverse, *Reset to theme's look*, already exists per control | M | The small-business version of Webflow's class and Pinegrow's Styles, without a class. Builds on 1.37's Copy/Paste style |
| ST-5 | **Section backgrounds beyond light/dark:** theme colour with shade, image with overlay, for every section | S–M | Hero has an image today; the Section frame gains the background field for all |
| ST-7 | **Transitions and transforms presets** (scale, rotate, lift on hover; a few easings) | S | After the hover row; respects reduced motion like F-DS-5 |

### 5.3 Not proposed
- **A CSS inspector, classes or a style target** in Simple mode (Webflow, Pinegrow, Bootstrap Studio): the learning curve in all three reviews. Per-element CSS stays Later (spec/02 §5).
- **Free values** (hex, px): see ST-6.
- **Filters, blend modes, backdrop filters, 3D transforms, masks** (Webflow, Elements 3.0): designer features; Custom Code covers the rare case.
- **Elements' Static/Hover/start/end pattern on every group:** too much repetition. One hover row on the elements that need it (ST-2) is enough.

## 6. Decisions
Awaiting the product owner.

| # | Proposed decision |
|---|---|
| ST-1 | **MVP:** a common Appearance group (Text, Colour, Corners, Border, Shadow, Opacity) on every section and element, tokens only, per device; new plan item 2.22 (3 days) |
| ST-2 | **MVP:** a hover row on Button, Card, Image and Icon (+1 day on 2.22) |
| ST-3 | **MVP:** underline, highlight and theme-colour marks in the text toolbar, with a Site Check tip (1 day, a chore on 1.23's code) |
| ST-6 | **Rule:** the Style tab stays tokens only; one-off colours go into the theme's palette |
| ST-4, ST-5, ST-7 | **v1.1:** apply to all of this kind; section backgrounds for every section; transition and transform presets |

## Sources
- Webflow: [Style panel overview](https://help.webflow.com/hc/en-us/articles/33961362040723-Style-panel-overview) · [Classes](https://help.webflow.com/hc/en-us/articles/33961311094419-Classes) · [States](https://help.webflow.com/hc/en-us/articles/33961301727251-States) · [Style labels](https://help.webflow.com/hc/en-us/articles/33961332425875-Style-labels-in-the-Designer) · [Variables](https://help.webflow.com/hc/en-us/articles/33961268146323) · [Component style variants](https://webflow.com/updates/component-style-variants-now-available) · [Text styling (tenten)](https://webflow.tenten.co/en/text-styling/) · [Text spans (Digidop)](https://digidop.com/blog/text-span-weflow)
- Pinegrow: [Style panel](https://pinegrow.com/docs/master-pinegrow/style/) · [Tailwind visual controls](https://pinegrow.com/docs/tailwind/visual-controls/) · [Class Tree](https://pinegrow.com/docs/tailwind/class-tree-inspector/) · [Styles](https://pinegrow.com/docs/tailwind/class-styles/) · [Floating tools](https://pinegrow.com/docs/tailwind/tailwind-css-floating-tools/) · [Content Workspace](https://pinegrow.com/docs/master-pinegrow/content-workspace/) · [Editable areas](https://pinegrow.com/docs/pinegrow-pro/editable-areas/)
- RapidWeaver Elements: [Component Inspector](https://docs.realmacsoftware.com/elements-docs/using-elements/editor/component-inspector.md) · common controls: [typography](https://docs.realmacsoftware.com/elements-docs/using-elements/components/common-controls/typography-and-text-styles.md), [backgrounds](https://docs.realmacsoftware.com/elements-docs/using-elements/components/common-controls/backgrounds.md), [spacing](https://docs.realmacsoftware.com/elements-docs/using-elements/components/common-controls/spacing.md), [borders](https://docs.realmacsoftware.com/elements-docs/using-elements/components/common-controls/borders.md), [effects](https://docs.realmacsoftware.com/elements-docs/using-elements/components/common-controls/effects.md), [advanced](https://docs.realmacsoftware.com/elements-docs/using-elements/components/common-controls/advanced.md) · [Theme Studio](https://docs.realmacsoftware.com/elements-docs/using-elements/design-and-theming/theme-studio.md) · [Responsive breakpoints](https://docs.realmacsoftware.com/elements-docs/using-elements/design-and-theming/responsive-breakpoints.md) · [Dark mode](https://docs.realmacsoftware.com/elements-docs/using-elements/design-and-theming/dark-mode.md) · [Text](https://docs.realmacsoftware.com/elements-docs/using-elements/components/content-and-media/text.md) · [Globals](https://docs.realmacsoftware.com/elements-docs/using-elements/reusable-content/global-templates.md) · [API UI controls](https://docs.realmacsoftware.com/elements-docs/elements-language/component/properties-json/ui-controls.md) · [forum: text formatting](https://forums.realmacsoftware.com/t/text-formatting-layout-and-styles/43893)
- Bootstrap Studio: [Options panel](https://bootstrapstudio.io/docs/options-panel.html) · [CSS](https://bootstrapstudio.io/docs/css.html) · [Themes](https://bootstrapstudio.io/docs/themes.html) · [Dark mode](https://bootstrapstudio.io/docs/dark-mode.html) · [Animations](https://bootstrapstudio.io/docs/animations.html) · [Editing components](https://bootstrapstudio.io/docs/editing-components.html) · [Linked components](https://bootstrapstudio.io/docs/linked-components.html) · [forum: hover colour](https://forum.bootstrapstudio.io/t/how-to-change-hover-color/9444) · the [screenshot pass](../bootstrap-studio/07-editor-screenshot-pass.md)
