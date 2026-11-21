# Theme Studio, if we built it again

**Status:** 🟡 For decision (TS-1…TS-9). Nothing here is in the plan, and the product owner asked that nothing be planned yet.

**Date:** 2026-11-21

**The question,** from the product owner: imagine Theme Studio had to be built from scratch. What would change?

**The short answer:** keep the model underneath, and rebuild how a person meets it. Colours as roles, contrast checked where a colour is chosen, themes to start from and one undo step per change are the strongest part of Webforge's styling ([Onlook comparison §8](../competitors/04-onlook.md#8-addendum-colour-picker-theming-and-styling)). What a person sees is a window of settings, shown on a page that isn't theirs.

## 1. How this was reached

From the help page [Themes](../../docs/help/themes.md), the code (`apps/desktop/src/renderer/theme/studio/`, `packages/model/src/theme.ts`), the notes on [component theming](11-component-theming.md) and [theme colours](18-theme-colours-and-code-editing.md), and the [trial of Webforge's own website](../../docs/testing/own-website-with-claude-code.md), whose log is on [#1230](https://github.com/nexustech/webforge/issues/1230). Theme Studio was not sat down with and used end to end for this note, so the proposals are a view to test, not findings.

## 2. What stays

- **Colours are roles** (ADR 0009), so a change reaches every page and a contrast check can reach every colour.
- **Fifteen themes to start from,** and "your own version" saved unasked on the first change.
- **Contrast checked where the colour is chosen,** with a colour suggested.
- **Every change is one undo step,** and a site carries its own copy of its theme.
- **No free values as the main path.** Per-element spacing and raw values are why sites made in designer tools drift and can't be given a new theme.

## 3. What is in the way today

| #   | Today                                                                                                                                                                      | Why it gets in the way                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Colours, Text and Styles are previewed on a **sample page** (`samplePageOf`, `ThemeStudio.tsx`)                                                                            | The only question a person has is "does my Home page look right", and the window doesn't show it                                    |
| 2   | **Two places, two ways of applying:** the Theme panel and Theme Studio hold overlapping settings; most apply at once, but Components keeps a draft until **Apply Changes** | The person has to learn which is which                                                                                              |
| 3   | **The list is of settings:** corners, shadows, border width, room around things                                                                                            | An owner thinks "more modern" or "warmer", not "border width"                                                                       |
| 4   | **Colours from an Image…** is one button in the Colours tab                                                                                                                | The logo is where most businesses' colours start; it should be the way in                                                           |
| 5   | **A theme is light or dark** (`scheme`), with a second set of colours for reversed sections                                                                                | The trial's dark look took hand work: a black Surface forced the third surface nearly as dark, and white on the brand colour failed |
| 6   | **Contrast warns after the choice**                                                                                                                                        | The person picks, is told no, and picks again                                                                                       |
| 7   | **A size for each heading level,** from a list that ends at `6xl`, and three steps of letter spacing                                                                       | A scale goes out of proportion by hand, and the trial's large headline wasn't reachable                                             |
| 8   | **Components are chosen from a list** of kinds                                                                                                                             | The person has to know what the thing is called                                                                                     |
| 9   | **Your own themes stay on the computer**                                                                                                                                   | A theme can't be handed to someone else or carried to another computer, except inside a site                                        |

## 4. Proposals

Sizes are rough ideal days. Each says what it builds on, so nothing already planned is proposed twice.

| #        | Proposal                                                                                                                                                                                                                                                                                                           | Builds on                                                        | Size   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ------ |
| **TS-1** | **The preview is your own site.** Theme Studio shows the site's pages, with a page to choose and Desktop and Mobile, as the theme changes. The sample page stays for a site with nothing on it                                                                                                                     | CT-11's preview; a theme colour live on the canvas (OL-18, 5.30) | 2      |
| **TS-2** | **One way of applying, everywhere.** Components changes show live as the other tabs' do, with **Before** and **After** to compare and Undo to take back; the draft bar goes. The Theme panel and Theme Studio draw the same controls from one list, so a setting is never in one and not the other                 | LF-15 (a change applies at once with Undo)                       | 2.5    |
| **TS-3** | **Start with the feel.** A first tab of four choices that each move several settings together: _plain to bold_, _tight to airy_, _sharp to soft_, _quiet to colourful_. Each shows its effect on the preview; the settings they move stay one level down, as now                                                   | The theme's tokens; nothing new in the model                     | 3      |
| **TS-4** | **Start from your logo.** Choose the logo; Webforge suggests the Brand colour, three whole sets of colours that pass the contrast checks, and a font pairing for each. One click takes a set. The logo goes to Site Settings for the Header (HF-1)                                                                 | Colours from an Image (PG-2); your colours (TC-1a, 5.27)         | 2      |
| **TS-5** | **Every theme has a light and a dark side,** made from the same roles and each checked, with one switch in Theme Studio to see either. This is a note for 6.11's design, not an item: dark mode for visitors (CC-5, [#1036](https://github.com/nexustech/webforge/issues/1036)) already needs both sets of colours | 6.11, v1.1                                                       | a note |
| **TS-6** | **Contrast is a limit, not a warning.** The colour picker marks the part of its area that passes for the colour's use, and the colours Webforge derives (text on a button, borders, the third surface) are kept passing by themselves. A person can still insist, and is told                                      | Webforge's own colour picker (OL-19, 5.26)                       | 2      |
| **TS-7** | **A scale for text.** A base size and a ratio (_Compact_, _Balanced_, _Dramatic_) set every level together; a level can still be set by hand. One more size above the largest, for a display headline, and finer steps of letter spacing                                                                           | The Text tab; trial log row 12                                   | 2      |
| **TS-8** | **Click it to change every one like it.** In Theme Studio's preview, clicking a button, a card or a heading opens that kind's look, in place of choosing the kind from a list. The list stays as the other way in                                                                                                  | **Style This…** and CT-1's look for each kind                    | 1.5    |
| **TS-9** | **A theme is a file you can share.** **Export Theme…** and **Import Theme…** in Themes, checked on the way in like any file Webforge reads                                                                                                                                                                         | Your own themes                                                  | 1.5    |

About 16.5 days for all of it, without TS-5.

**If only three:** TS-1, TS-3 and TS-5's note. Your own site in the preview, the feel before the settings, and two sides to every theme change what Theme Studio is; the rest tidies what is there. **Cheapest for what they give:** TS-8 and TS-7.

**Order matters for some.** TS-6 needs the colour picker of 5.26. TS-4 is better after your colours (5.27, 5.28). TS-1 and TS-2 are best done together, since both rebuild how the preview and the applying work.

## 5. What this note does not propose

- Free values, raw CSS or spacing for one element as a main path ([§2](#2-what-stays)); Advanced mode keeps what it has.
- Animated or generated themes, or a marketplace of themes.
- Anything already decided: your colours and any colour in Simple mode (TC-1a…TC-4), the colour picker and live theme colours (OL-18, OL-19), dark mode for visitors (6.11), the code editors (TC-5, TC-6).

## 6. Decisions

None yet. Product owner, 2026-11-21: "Theme Studio write note but do not plan anything yet".
