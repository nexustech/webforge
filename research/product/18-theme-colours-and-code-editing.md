# Theme Studio next: your own colours, any colour, and code editing

**Status:** 🟡 Proposals for decision (TC-1a, TC-1b and TC-2…TC-6, [§5](#5-proposals-for-decision)), with a draft plan for them and for OL-18…OL-20 ([§6](#6-draft-plan)). Nothing here changes the spec or the plan until the product owner decides.

**Date:** 2026-11-20

**The question:** after the [Onlook comparison](../competitors/04-onlook.md#8-addendum-colour-picker-theming-and-styling), where should Theme Studio go next? The product owner asked for two things by name: colours of the business's own, added in Theme Studio and shared across the site, and CodeMirror for refining custom styles and Custom HTML.

## 1. Direction from the product owner

From a working session on 2026-11-20:

- **A colour the business owns behaves like Brand everywhere.** It is added to the theme, named, and one change to it reaches every place it is used.
- **One-off colours as well.** A person can still choose any colour for one place. **Colour is not artificially restricted.**
- **The principle stops at colour.** Spacing, sizes and corners stay design tokens ([standards §4](../../spec/03-engineering-standards.md#4-code-style--conventions)): colour is the business's identity, and the spacing steps are what keep a page working on a phone.
- **OL-18, OL-19 and OL-20 are to be planned** with this work.

## 2. Where Webforge stands

| Area                                   | Today                                                                                                                                                                                                                  | Source                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Theme colours                          | Fixed roles: Brand, Accent, Second accent, Surface, Text and Neutral to the person; daisyUI's 20 underneath, held as OKLCH, with a second set for reversed sections                                                    | `packages/model/src/theme.ts`                                                     |
| A colour on an item                    | A reference, `<role>[-shade][/opacity]`, or in Advanced mode `[#rrggbb][/opacity]`, written out as a class (`bg-primary-300/80`, `bg-[#1f6feb]`)                                                                       | `packages/model/src/color-ref.ts`, [ADR 0009](../../docs/adr/0009-colour-refs.md) |
| A colour of your own                   | **Belongs to the field, not the theme,** and only in Advanced mode. A theme change leaves it alone                                                                                                                     | ADR 0009 §2, UX-25, F-ED-4                                                        |
| Named colours in the theme             | Considered and left out. ADR 0009 records the cost (a site-wide recolour misses custom colours) and the way back: a new theme field, a format migration, and a list of off-theme colours in Theme Studio or Site Check | ADR 0009, Consequences                                                            |
| The picker                             | Theme swatches, 11 shades and fixed opacity steps of our own; any other colour through the operating system's colour input                                                                                             | `renderer/fields/color/`, `renderer/fields/theme-color/`                          |
| A theme colour on the canvas           | Applies when the system picker closes, then asks twice; LF-15 ([#1168](https://github.com/nexustech/webforge/issues/1168), open) removes the dialogs                                                                   | `ThemeColorField.tsx`, `theme-edits.ts`                                           |
| How a theme's colours reach the page   | As CSS custom properties, sent apart from the compiled stylesheet, "so a change of colour or scale needs no new compile"                                                                                               | `themeValuesCss` in `packages/themes/src/theme-css.ts`                            |
| The stylesheet                         | CodeMirror 6: highlighting, completion of the theme's variables, classes and anchors, lint, live on the canvas, each pause one undo step (CT-8, 6.8)                                                                   | `renderer/stylesheet/`                                                            |
| Custom HTML and the site's code fields | A plain text box                                                                                                                                                                                                       | `renderer/fields/code/CodeField.tsx`                                              |
| Advanced classes                       | Suggestions as you type and Browse Classes; a class is previewed as its CSS text                                                                                                                                       | `renderer/fields/classes/ClassesField.tsx`                                        |

## 3. What others do

- **Webflow** has variables: design tokens for colours, sizes and fonts, with modes such as light and dark, shared across sites. They are a tool for a designer who thinks in variables ([competitors/01](../competitors/01-webflow.md)).
- **Onlook v1** has brand colour groups stored in the app's Tailwind configuration, each with a light and a dark value, beside Tailwind's whole palette and any hex. Deleting one strips its classes from the pages ([competitors/04 §8](../competitors/04-onlook.md#83-side-by-side)).
- **Bootstrap Studio** has one picker of its own for every colour: a saturation square, hue and alpha sliders, an eyedropper, and tabs for favourites and a library of colours ([bootstrap-studio/07](../bootstrap-studio/07-editor-screenshot-pass.md)).

None of them gives a non-technical owner both halves at once: free choice of colour, with the theme still in charge of everything it can be. That is the opening.

## 4. The design

### 4.1 One picker, two kinds of colour

- **Your colours:** the theme's roles and any colours the business has added. Each added colour has a name, the 11 shades, opacity, a contrast check where it is used, and a value for reversed sections worked out from it. There is no limit on how many; a long list scrolls and can be searched by name.
- **Another colour…:** any colour, for this one place, in Simple mode too.

### 4.2 What replaces the restriction

Today's rule keeps custom colours in Advanced mode "to keep sites on-brand" (UX-25). In its place, the person is shown what a choice costs:

1. **The contrast warning stays beside the colour,** with a suggestion, as for theme colours.
2. **Colours already used on this site** are offered in the picker, read from the site itself, so reusing a one-off needs no code retyped and no new stored state.
3. **"Add to your colours"** is offered the second time the same one-off is used. Saying yes turns every use of it into a reference, as one undo step.
4. **"Colours outside your theme"** in Theme Studio lists every one-off, where it is used, and offers to add it to your colours or switch to the nearest one.
5. **Consequences are said, not enforced:** when dark mode for visitors arrives (6.11), that list says how many colours won't change with it.

### 4.3 The life of a colour

- **Renaming** is safe: a use refers to the colour's id, not its name.
- **Deleting a colour in use** asks: replace it with another of your colours, or keep each use as a one-off. A colour is never lost silently.
- **Shades** belong to your colours. A one-off is one colour; wanting its lighter and darker steps is the reason to add it.
- **Gradients:** an added colour is a role, so it can be either end. A one-off end is allowed too; the contrast check already measures both ends (CT-13).

### 4.4 The model

- The theme gains a list of the person's colours: an id, a name and a colour in OKLCH. It travels with the theme, so _My themes_ carry it.
- A colour reference gains a third base beside a role and a hex: one of the theme's own colours by id, with shades and opacity as for the shaded roles.
- The theme's CSS gains each colour's variable and its shades' variables. Adding or removing a colour changes the stylesheet's shape (one compile); changing its value does not.
- A site format migration (existing sites gain an empty list), and an amendment to ADR 0009.
- **What doesn't change:** a one-off is still exactly six hex digits between the brackets and nothing else, which is what stops CSS being injected through a colour.

### 4.5 Code editing

CodeMirror is already the stylesheet's editor. Two extensions of it, both Advanced mode:

- **Custom HTML and the site's code fields in the same editor:** highlighting for HTML, CSS and JavaScript, completion of the site's classes and anchors, and lint for an unclosed tag and for a file loaded from another website, which the export rule forbids.
- **Colours in code stay on the theme:** a swatch beside each colour in the stylesheet that opens _Your colours_ and writes the theme's variable, not a hex.

Per-element CSS stays out (CT-9): it breaks theme switching and dark mode.

## 5. Proposals for decision

Estimates are ideal days, from the code as it stands. TC-1 is two items: at first it was one of 3 days, which the coordinator's review found low for a format change, since recent items ran at 1.0 to 1.4 of their estimates and format changes ran over.

| #         | Proposal                                                                                                                                                                                                                                                                                                                                         | Why                                                            | Days |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ---- |
| **TC-1a** | **Your colours, in the theme.** The model of §4.4: the theme's list of the person's colours, a third base for a colour reference wherever references are read, each colour's variables and shades in the theme's CSS with its value for reversed sections, contrast and Site Check for them, the site format migration, and ADR 0009's amendment | The owner's first request. Resolves the cost ADR 0009 accepted | 2.5  |
| **TC-1b** | **Your colours, in the editor.** Theme Studio › Colours gains the list: add, name, rename, and delete with "replace or keep as one-offs". The colours appear in the picker for every colour field and as gradient ends, and in the catalogue data for AI apps and the Assistant's tools                                                          | Where the owner adds and uses them                             | 2    |
| **TC-2**  | **Any colour in Simple mode.** _Another colour…_ in every colour field, with the contrast warning beside it and the colours already used on the site offered. Amends UX-25, F-ED-4 and ADR 0009 §2                                                                                                                                               | Colour is not artificially restricted                          | 1    |
| **TC-3**  | **"Add to your colours",** offered on a one-off's second use and from the picker: every use becomes a reference, as one undo step                                                                                                                                                                                                                | The path from a one-off to a colour the business owns          | 1    |
| **TC-4**  | **"Colours outside your theme"** in Theme Studio: every one-off, where it is used, with _Add to your colours_ and _Use the nearest of your colours_                                                                                                                                                                                              | Makes one-offs visible; how existing sites move over           | 1.5  |
| **TC-5**  | **Custom HTML and the site's code fields in the code editor,** as §4.5                                                                                                                                                                                                                                                                           | The owner's second request; today it is a plain text box       | 1.5  |
| **TC-6**  | **Theme colours in the stylesheet editor:** a swatch beside each colour that writes the theme's variable                                                                                                                                                                                                                                         | Keeps hand-written CSS following the theme                     | 1    |

From the Onlook addendum, to be planned with them (re-estimated here):

| #         | Proposal                                                                                                                                                                                                                                                                                                                           | Days |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **OL-18** | A theme colour changes on the canvas while it is dragged, as one undo step. The theme's colours are already custom properties sent apart from the compiled stylesheet, so no compile is needed                                                                                                                                     | 1.5  |
| **OL-19** | Webforge's own colour picker (a saturation area, a hue slider, a hex box, an eyedropper), the same on Windows and macOS. It is where _Your colours_ and _Another colour…_ live, so it comes first. Whether Chromium's `EyeDropper` works in the sandboxed window is its first task; without it the picker ships with no eyedropper | 2.5  |
| **OL-20** | A class shows on the canvas while it is highlighted in the Advanced classes suggestions and Browse Classes                                                                                                                                                                                                                         | 1    |

**15.5 days in all:** 10.5 for TC-1a…TC-6 and 5 for OL-18…OL-20.

Parked, not proposed: a brand sheet as a PDF (colours, fonts and logo on one page); "show me three variations" of the current theme; a theme check in one place; hovering a CSS rule to highlight what it matches on the canvas.

## 6. Draft plan

For the product owner's approval; the coordinator assigns the streams.

**Order and dependencies:**

1. **OL-19** (the picker) first: TC-1b and TC-2 put their lists in it, so it is built once.
2. **TC-1a** (the model), which can start beside OL-19 and touches no screen. **TC-1b** (Theme Studio's list and the picker's) follows both.
3. **TC-2**, after OL-19. **TC-3** and **TC-4**, after TC-1b and TC-2.
4. **OL-18**, after LF-15 ([#1168](https://github.com/nexustech/webforge/issues/1168)) has merged, since both change how a theme colour is applied. It also follows OL-19, which replaces the input it listens to.
5. **TC-5**, **TC-6** and **OL-20** depend on nothing above and on each other only through the stylesheet editor's files (TC-5 before TC-6).

LF-16 ([#1174](https://github.com/nexustech/webforge/issues/1174), open) takes hex codes off Simple mode's Theme tab rows and keeps "a swatch and the picker". The picker's own hex box stays in both modes: a business that has its brand colour as a code needs somewhere to type it.

**When.** Three choices:

|                                                             | Before v1.0 (Phase 5)              | v1.1 (Phase 6)              |
| ----------------------------------------------------------- | ---------------------------------- | --------------------------- |
| **A. All before v1.0**                                      | all ten, +15.5 days                | –                           |
| **B. Colour before v1.0, code editing after** (recommended) | OL-18, OL-19, TC-1a…TC-4, +12 days | TC-5, TC-6, OL-20, 3.5 days |
| **C. All in v1.1**                                          | –                                  | all ten, 15.5 days          |

B is recommended: the colour work reaches every owner and changes the site format, which is cheaper to do before v1.0's files exist in numbers; the code editing is Advanced mode only. Under PH5-2 the dates don't move in any of the three.

**Riskiest assumption:** that free colour in Simple mode doesn't produce sites that are hard to read. The warnings are the mitigation, and the beta (5.8) is the test; its checklist would gain a line for it.

## 7. Sources

- [ADR 0009](../../docs/adr/0009-colour-refs.md) · [product/06](06-editor-ui-ux-parity.md) (UX-25) · [product/11](11-component-theming.md) (CT-1…CT-14) · [competitors/04 §8](../competitors/04-onlook.md#8-addendum-colour-picker-theming-and-styling) (OL-18…OL-20) · [competitors/01](../competitors/01-webflow.md)
- Code read on 2026-11-20: `packages/model/src/color-ref.ts`, `packages/model/src/theme.ts`, `packages/themes/src/theme-css.ts`, `apps/desktop/src/renderer/fields/color/`, `fields/theme-color/`, `fields/code/`, `fields/classes/`, `apps/desktop/src/renderer/stylesheet/`, `apps/desktop/src/renderer/theme/studio/`
