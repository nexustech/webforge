# Theme Studio, if we built it again

**Status:** 🟡 For decision (TS-1…TS-22). Nothing here is in the plan, and the product owner asked that nothing be planned yet. [§5](#5-one-way-of-styling-and-no-modes) is a second pass that would replace TS-1, TS-2 and TS-8. [§6](#6-theme-panel-v2-and-theme-studio-v2) is a third: Theme panel v2 and Theme Studio v2, with a value of your own for any setting and fonts of your own.

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
- **No free values as the main path.** Per-element spacing and raw values are why sites made in designer tools drift and can't be given a new theme. [§6](#6-theme-panel-v2-and-theme-studio-v2) changes this for the theme's own settings only: a value of your own, within limits, that still reaches every page.

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

## 5. One way of styling, and no modes

A second pass, the same day, after the product owner read §4:

> "There should be one consistent way of styling, if it means that the Theme Panel only has basic settings and Theme Studio is the more comprehensive design surface then this should be consistent. We also have Simple and Advanced mode and this potentially adds more friction to the user. It should be obvious in the UI whether we are in Simple, Design or Content mode"

and, on whether one panel could hold everything: "Panels should be collapsible, then the width of the panel doesn't matter".

### 5.1 What is inconsistent today

Read from the help pages ([Themes](../../docs/help/themes.md), [Styling](../../docs/help/styling.md), [The Edit panel](../../docs/help/edit-panel.md), [The editor](../../docs/help/the-editor.md)), not from using the app.

|                    | Quick, in the right column | A window that fills the editor |
| ------------------ | -------------------------- | ------------------------------ |
| **The whole site** | Theme panel                | Theme Studio                   |
| **One item**       | The Edit panel's Style tab | Style This…                    |

- **The Theme panel isn't the basic one.** It lists nearly every setting of the theme (a text size for each level, shadows, border width, card style), so Theme Studio mostly repeats it and adds shades, reversed colours and Components.
- **Three ways of applying.** The Theme panel and the Style tab apply at once; Components keeps a draft until **Apply Changes**; Style This has **Cancel** and **Apply**.
- **Two windows do one job.** Style This's _Make it the theme's look for Button_ and Theme Studio's Components both set the look of every Button.
- **A person chooses where a change belongs before making it:** the theme, or the item.
- **Two switches, one of them out of sight.** **Design | Content** is in the title bar and kept with the site (F-ED-10); Simple and Advanced is in the View menu and Settings and kept with the person (F-ED-11). That makes four states, one of which means nothing (Content with Advanced).

### 5.2 Proposals

Sizes are rough ideal days, and rougher than §4's: none of this was tried in the app.

| #         | Proposal                                                                                                                                                                                                                                                                                                                                                                                   | Changes or builds on                                                                                           | Size |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ---- |
| **TS-10** | **One Design panel, at three scopes.** The Edit panel's Style tab becomes **Design**, with the scope at its top: _Whole site › Every Button › This Button_. Clicking the page itself shows _Whole site_, which holds what the Theme panel holds today. The same controls, with the same names in the same order, at every scope                                                            | The Theme panel, the Style tab, Components (CT-1), the "where a value comes from" line. Replaces TS-2 and TS-8 | 5    |
| **TS-11** | **Change it first, say how far afterwards.** A change lands on the selected item. The message that follows offers **Make Every Button Like This**, beside **Undo**. Widening a look to other pages still asks first, as now                                                                                                                                                                | LF-15's message; Style This's **Where it applies**                                                             | 1.5  |
| **TS-12** | **Every setting in a group that folds.** The panel keeps one width. An **Essentials** group is open at the top of each scope (for the whole site: the colours, the font pairing and TS-3's feel); the rest are folded under it. Theme Studio's tabs and Style This's sections become groups. A control that needs room (a gradient, each corner, a colour's shades) opens from its own row | The Edit panel's groups, their highlighted titles and **Search options**, which exist                          | 3    |
| **TS-13** | **The page is the preview.** With everything in the panel, the canvas shows each change on the site's own pages and devices, and the Theme Studio and Style This windows go. A window stays for one job, choosing a theme, where fifteen need comparing side by side                                                                                                                       | Replaces TS-1. Changes CT's _Style this_ dialog and Theme Studio                                               | 1.5  |
| **TS-14** | **One way of applying.** Every change applies at once and is one undo step, at every scope. The draft bar and **Cancel** and **Apply** go; **Before** and **After** stay as a way to compare                                                                                                                                                                                               | LF-15                                                                                                          | 1    |
| **TS-15** | **A lock, in place of Content mode.** **Site › Lock the Design** shows a padlock and tints the title bar, with **Unlock** beside it; while it is on, only words, pictures and links can change. The **Design \| Content** switch goes. Kept with the site, as now                                                                                                                          | F-ED-10 (M3)                                                                                                   | 1    |
| **TS-16** | **Code tools, in place of Advanced mode.** **Show code tools** in Settings adds a **Code** tab and Custom Code; the tab being there is the sign. It only ever adds, and never changes what is already shown. An option that needs it says so, with a link that turns it on. Kept with the person, as now                                                                                   | F-ED-11 (T2); LF-16                                                                                            | 1    |

About 14 days. Taking TS-10 to TS-14 drops TS-1, TS-2 and TS-8 (6 days), which leaves about 24.5 days for everything in this note without TS-5. TS-3, TS-4, TS-6, TS-7 and TS-9 stand as they are.

**The cautious version,** if one panel is too far: keep the four surfaces and make them consistent. Each panel is a short list drawn from its window's list, so it never holds a setting the window lacks; the two windows become one with a scope at its top; and one switch of three steps (_Content_, _Design_, _Code_) sits in the title bar. It costs less and leaves the modes in place.

### 5.3 What isn't known

- **A long panel.** A Button has few groups; a Hero has many. One panel leans on search and the highlighted titles to stay findable, and that hasn't been tried with anyone.
- **What Style This gives up.** Its settings sit in columns under two previews. In a column 300 px wide they become one long list.
- **Decisions this would change:** the Design and Content switch (F-ED-10), Simple and Advanced mode (F-ED-11), the _Style this_ dialog (CT-1…CT-9), what Simple mode's Theme tab shows (LF-16) and the Site menu's Theme… and Theme Studio… ([#1016](https://github.com/nexustech/webforge/issues/1016)). Each needs reading again before any of this is planned.
- **Two sketches** were drawn in the conversation and aren't kept in the repository: a café page with two buttons, the panel at its three scopes, the groups folding, and the lock.

## 6. Theme panel v2 and Theme Studio v2

A third pass, the same day. The product owner:

> "Lets think about how the Theme panel and Theme Studio work together, we should be consistent so if we make UX/UI changes to the Theme Panel then the Theme Studio should not look out of place"

and, to tell the new from what ships: "Call the new concepts Theme Studio v2 and Theme Panel v2 so we can distinguish it easily from what we offer now which is v1".

|                  | v1, what ships today                                                      | v2, proposed here                                                                            |
| ---------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Theme panel**  | A list in the right column, built as Edit panel fields (`ThemePanel.tsx`) | The same panel with every theme setting in a group that folds (TS-12), the same for everyone |
| **Theme Studio** | A window of five tabs with its own rows (`studio/`), over a sample page   | Theme panel v2 itself, beside a large preview of the site's own pages                        |

Theme panel v2 is the _Whole site_ scope of TS-10's Design panel if that is taken, and the Theme panel with TS-12's folding groups if it isn't.

### 6.1 Why v1's two can drift

- **The list is only half shared.** `theme-controls.ts` builds one list (`TOKEN_CONTROLS`) that both read, but it leaves out the colours, the fonts and the text sizes (`DRAWN_OWN_WAY`). Each surface builds those itself, and they are the settings people use most.
- **The two belong to different families.** The Theme panel is drawn with the Edit panel's fields, so it matches the Edit panel. Theme Studio shares its frame with Style This (`StylingFrame.tsx`), so the two windows match each other. A change to the panels doesn't reach the windows.

### 6.2 What v1 offers beyond its presets

Read from the help pages ([Themes](../../docs/help/themes.md), [Styling](../../docs/help/styling.md), [The Stylesheet panel](../../docs/help/stylesheet.md), [Custom Code](../../docs/help/custom-code.md)), not from using each one.

| What                                                    | Where                                              | Limits                                                                                |
| ------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Any colour for the theme's five colours                 | Both                                               | Typing a colour's code needs Advanced mode in the panel; Theme Studio always shows it |
| Colours from an image                                   | Theme Studio › Colours                             |                                                                                       |
| A size for each heading level, body text and small text | Theme Studio › Text; the panel in Advanced mode    | From a list of sizes; Simple mode's panel has _Smaller_, _Standard_ and _Larger_      |
| Weight and line spacing for each kind of text           | Theme Studio only                                  |                                                                                       |
| Any font for Headings, Body text and Accent             | Both                                               | Only the fonts Webforge offers: "You can't add font files of your own yet"            |
| The look of every item of a kind, with gradients        | Theme Studio › Components                          | A draft until **Apply Changes**                                                       |
| Your own named themes                                   | Saved on the first change; managed in Theme Studio | Kept on this computer                                                                 |
| A Custom colour on one item                             | The Style tab's colour fields                      | Advanced mode only, until 5.29                                                        |
| CSS of your own (`custom.css`)                          | The Stylesheet panel, and Custom Code in Settings  | Advanced mode only. Theme Studio has no CSS and doesn't point to it                   |

Corners, shadows, spacing, border width, button shape and card style are each a short list. No value of your own can be given.

**Already decided, so not proposed again:** colours of your own in the theme (TC-1a, TC-1b; 5.27, 5.28), any colour in Simple mode (TC-2, 5.29), and "Add to your colours" (TC-3, 5.31). TC-2's decision says "Spacing, sizes and corners stay tokens in Simple mode"; TS-19 would change that.

### 6.3 Proposals

Sizes are rough ideal days. The product owner's answer on values and code, which TS-19 to TS-21 follow: "Custom values for everyone, CSS only with code tools". And on fonts: "Not being able to use your own fonts looks like an obvious gap in our current offering".

| #         | Proposal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Changes or builds on                                                                                                      | Size |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---- |
| **TS-17** | **One description of every theme setting.** The list both surfaces read gains the colours, the fonts and the text sizes, and says for each setting its group, its kind and whether it is an essential. The panel, Theme Studio, the help page and the words an AI app is given are all made from it, so a setting is never in one and not another                                                                                                                                                                                                           | `TOKEN_CONTROLS` (`theme-controls.ts`); AS-2 and AS-7 ([product/24](24-styling-with-ai.md))                               | 2    |
| **TS-18** | **Theme Studio v2 is Theme panel v2, beside a large preview.** Opening it keeps the panel, with the same rows and folds, and gives the rest of the window to the site's own pages on Desktop and Mobile, **Before** and **After**, the themes to choose from, and examples for the open group. The Components tab becomes the scope at the top of the panel (_Whole site › Every Button_). Style This follows the same pattern for one item. A change to the panel shows in Theme Studio because it is the same panel                                       | Takes in TS-1. In place of TS-13, which removes the window. `StylingFrame.tsx`                                            | 3.5  |
| **TS-19** | **A value of your own on every setting with presets.** Each such row ends in **Custom…**, which turns it into a slider with a number, starting from the preset it had; **Back to Rounded** returns to the preset. Each slider has limits, so a value can't break a layout, and nobody types a unit. An AI app can give the same values, which reaches what the trial couldn't (log row 12)                                                                                                                                                                  | The theme's tokens, which hold a preset's name today. Changes TC-2's "stay tokens in Simple mode" and [§2](#2-what-stays) | 4    |
| **TS-20** | **Every theme setting, for everyone.** A colour's code and a size for each kind of text are in the panel whatever the mode, in groups that start folded; the colour rows themselves stay without codes, as LF-16 decided. With TC-2, nothing in the theme differs between Simple and Advanced mode                                                                                                                                                                                                                                                          | Changes LF-16 (Simple mode's Theme tab shows no codes) to "none on the rows"; TS-16                                       | 1    |
| **TS-21** | **CSS only with code tools.** With **Show code tools** on, the panel adds **Open Stylesheet** at its foot, each setting's variable (`var(--color-primary)`) with a button to copy it, and **Move This Look to CSS** where it is today. With it off, the panel never mentions CSS                                                                                                                                                                                                                                                                            | The Stylesheet panel; TS-16                                                                                               | 1    |
| **TS-22** | **Fonts of your own.** **Add Your Own Font…** in **Choose a Font** takes WOFF2, WOFF, TTF or OTF files, reads each one's family, weight and style, and lists the family under **Your fonts**, drawn in itself. The files are kept with the site, as its pictures are, and the exported site carries them like any other font. The panel and Site Check say which weights the theme uses and the font lacks, and when a file is heavy. The person is told once that the licence is theirs to check. An AI app can choose one of your fonts and can't add one | `faces.ts` and the font catalogue, which know only Fontsource's packages; the export's `assets/fonts/`                    | 5    |

About 16.5 days. TS-18 is in place of TS-13 (1.5 days), which leaves about 39.5 days for everything in this note without TS-5.

**What I'd take first:** TS-17 and TS-18. They are what stops the two drifting, and they are the least reversible to do later, since every setting added to v1 is added twice. TS-22 stands alone and needs none of the others.

### 6.4 What isn't known

- **What a theme switch does to a value of your own.** A view, not a decision: colours of your own stay, since they are the business's; a value of your own on a preset row is replaced by the new theme's, and the question that switching already asks says so.
- **How much code assumes a preset's name.** TS-19's size is the least certain here: the theme's CSS, the font plan and the tests were not read for it.
- **What Theme Studio v2 gives up.** v1 spreads its settings in columns across the window. Beside a preview they are one column. Not tried with anyone.
- **Which side the panel sits on** in Theme Studio v2, and whether its changes apply at once (TS-14).
- **Converting a font to WOFF2** on the way in would make sites lighter and needs a library with a permissive licence. None was looked for.
- **Where a font of your own is kept for other sites.** A downloaded font is kept on the computer for all of them; whether your own are offered there too is open.
- **A sketch** of Theme Studio v2 was drawn in the conversation and isn't kept in the repository: the same panel in the editor and in Theme Studio, with Desktop and Mobile, **Before** and **After** and the themes to choose from.

## 7. What this note does not propose

- Free values or spacing for one element, or raw CSS as a main path ([§2](#2-what-stays)). TS-19's value of your own is for a setting of the theme, so it still reaches every page.
- Fonts loaded from another website, such as a font service's.
- Animated or generated themes, or a marketplace of themes.
- Anything already decided: your colours and any colour in Simple mode (TC-1a…TC-4), the colour picker and live theme colours (OL-18, OL-19), dark mode for visitors (6.11), the code editors (TC-5, TC-6).

## 8. Decisions

None yet. Product owner, 2026-11-21: "Theme Studio write note but do not plan anything yet"; and, the same day, of §5: "Write it into the Theme Studio note as proposals"; and of §6: "Add it to the Theme Studio note with v2". The owner's answer in §6 ("Custom values for everyone, CSS only with code tools") is the direction TS-19 to TS-21 are written to; it has no decision ID, and none of them is planned.
