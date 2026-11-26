# UX/UI review of the desktop app: dialogs, panels and consistency

**Date:** 2026-11-25 · **Build:** production build of `apps/desktop`, run unpackaged (version 0.3.0). The sweep ran at commit `289d9daa1`; Keyboard Shortcuts and Settings were re-checked at `510ae7244`, the only later commit that changes the app · **OS:** Windows 11 Pro 10.0.26300 · **Status:** findings only; no source was changed. The findings were filed as issues on 26 Nov 2026 ([Issues filed](#issues-filed)).

Commissioned by the product owner after a manual pass found usability faults that were then built as six issues (#1404, #1408, #1409, #1410, #1411, #1412). This review checks those six in the running app, then looks for **the same class of fault everywhere else**: dialogs that change size or outgrow the window, controls that sit where they can be hit by accident, content that clips or scrolls sideways, and dialogs that behave or read differently from each other.

Evidence labels: **Observed** (exercised or measured in the running app), **Source** (read in the code only), **Hypothesis** (plausible, not verified). Screenshots are in `2026-11-25-ux-ui-review-screenshots/`.

## 1. Summary

The six issues from the manual pass hold up, with one loose end (S1 below). The same faults are still present in other places, and the largest group is one the manual pass didn't name: **dialogs that throw typed work away without asking.**

**The four that matter most**

1. **The title bar overflows while the phone preview is on (H1).** "Phone preview on" wraps onto three clipped lines and pushes **Publish** 41 px under the window's own minimise, maximise and close buttons at 1366 px wide, and off the window at 960 px. This is the fault of #1411 in a new place.
2. **Esc or a click outside discards typed work with no question (H2).** Start a Site loses all four steps; Settings loses every edited field. Theme Studio's Components tab and Report a Problem do protect the work, so the app is inconsistent as well as unsafe.
3. **Style This… and Theme Studio leave about 150 to 210 px for their controls at the smallest window (H3).** The Style dialog shows four options of a 2,446 px list, inside three nested scroll areas.
4. **Dialogs still change height and jump (H4).** The web host form grows 93 px and moves up 47 px when it shows its errors; the Link dialog shrinks 84 px as the link type changes. This is the fault of #1409 in two more dialogs, with ten more at risk by their code.

**Worth keeping**

- **One dialog frame, respected.** Every dialog measured sits below the title bar (top edge 54 px against a 40 px bar) and inside the window at both sizes, with a visible edge in Dark.
- **Fixed-height dialogs where content varies:** Settings (616 px on all 13 sections), the pickers (504 px), Start a Site, and now Keyboard Shortcuts, which keeps its size while its search filters the list.
- **Confirmations that say what happens and that Undo reverses it** ("5 pages of your site will change. You can undo it afterwards.").
- **Contrast.** No text under 4.5:1 was found in the editor, Settings, Publish, Start a Site or Report a Problem, in Dark or Light, apart from disabled buttons (which WCAG exempts).
- **Site Check.** The 19 November review's three highest findings are gone: findings name elements in words, the panel opens readable, and problems are grouped apart from tips.

## 2. Method and coverage

- **Build and run.** `pnpm turbo run build --filter=@webforge/desktop`, then the built app driven by Playwright's Electron driver with its own empty `--user-data-dir`. Native file dialogs and `shell.openExternal`/`openPath` were answered by script, so nothing left the computer and no browser opened.
- **Test data.** Synthetic only: "Rosa's Bakery", made with **Start a Site…** (Food and drink, Café / Restaurant, Bistro, 4 pages), web address `https://rosas.example`. No real host, credentials or personal data.
- **Window sizes (content area, CSS px at 100%).** 1366 × 768 and 960 × 600 (the minimum). Each dialog was measured at both, opened at the larger size and then resized; Keyboard Shortcuts was also opened fresh at each size.
- **Interface text size.** Two steps of **Zoom In Interface** (125%: layout 1093 × 614 px). Measurements were taken; screenshots at that zoom came out cropped by the driver and were discarded, so nothing visual is claimed at 125%.
- **Appearances.** Dark for the sweep; Light for the editor, Settings, Theme Studio, Publish, Start a Site and Report a Problem.
- **Measured by script in the page, for each open dialog:** its box against the window and the title bar; whether the dialog panel itself scrolls and which parts inside it scroll; text clipped by `overflow` or an ellipsis; controls under 24 × 24 px or outside the window; button labels in order; text contrast against the composited background.
- **Source inventory.** A separate read of every dialog, alert dialog, popover and menu in `apps/desktop/src/renderer` and `packages/editor-ui`, used to find where to look and to explain what was observed. Findings that rest on it alone are labelled **Source**.

**Dialogs and panels opened (41):** Start a Site (4 steps), New Site, Theme Studio (5 tabs), Style This Hero, Settings (13 sections), Page Settings, Add Page, Link, Choose an Image, Choose a Font, colour picker, Publish, Publish to Your Web Host, Export Site, Site Exported, AI Apps, Preview on Your Phone, Save Version, Assistant settings, About, Open-Source Licences, Diagnostics, Report a Problem, Keyboard Shortcuts, command search, the five menus, the page actions menu, the version menu, and the confirmations for deleting a page, switching theme, restoring a version and deleting a picture. Panels: Add, Layers, Undo History, Version History, Assistant, Edit, Media, Site, Theme, Site Check, Find and Replace.

**Not tested**

| Area                                                                                                             | Why                                                                             |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| macOS; the packaged, installed app                                                                               | Windows, unpackaged build only                                                  |
| A real publish, Netlify sign-in, publish progress and outcome dialogs                                            | No safe destination. Their button order is reported from source only            |
| Assistant dialogs beyond its settings (consent, Rewrite, Draft, Words for Your Pages, Things You Can Ask)        | The assistant was off; no key was entered                                       |
| AI app dialogs (media request, While You Were Away), code trust, bundle a file, recovery and crash message boxes | Not triggered                                                                   |
| Template details, Choose a Template Yourself, icon and classes pickers, Canvas Width, Add a Device, note dialog  | Not opened                                                                      |
| Screenshots at 125% text size                                                                                    | Driver cropped them; measurements only                                          |
| Drag and drop, screen readers, Windows high contrast                                                             | Not exercised in this run                                                       |
| #1404 (Hero content inset)                                                                                       | A site-component alignment, outside this review's dialog scope; not re-measured |

Timings and counts are single measurements on one machine by a reviewer driving the app by script. They are not user-study results.

## 3. The six issues from the manual pass, re-checked

| Issue | What was found by hand                                    | Result                                                                                                                                                                                                       | Evidence                                                                       |
| ----- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| #1411 | Theme Studio's X under the window controls                | **Holds.** Theme Studio and Style This start at 54 px, below the 40 px bar, at 1366 × 768, 960 × 600 and 125%. The same fault exists in the title bar itself: **H1**                                         | `10-theme-studio-1366.png`, `12-theme-studio-960.png`                          |
| #1409 | No visible edge in Dark; Settings changes height          | **Holds, with a loose end.** Dialogs have a visible edge in Dark. Settings is 616 px on all 13 sections. On **General** only, the dialog itself also scrolls by 66 px: **S1**                                | `13-settings-*.png`, `18-settings-general-wait.png`                            |
| #1408 | Colour picker has no Done or Cancel, or the colour before | **Holds.** Before and Now swatches, Cancel and Done; 210 × 303 px, inside the window from the lowest swatch at 960 × 600                                                                                     | `50-colour-picker-1366.png`, `51-colour-picker-960.png`                        |
| #1410 | Keyboard Shortcuts scrolls sideways                       | **Holds at `510ae7244`.** No sideways scroll at 1366 or 960 px; two columns at both; search keeps the dialog's size. (At `289d9daa1`, before PR 1421, it still scrolled sideways: 699 px of content in 660.) | `14-shortcuts-1366.png`, `14-shortcuts-960.png`, `15-shortcuts-search-960.png` |
| #1412 | No collapse and expand buttons on panels                  | **Holds.** Hide buttons on each panel group (25 × 25 px); collapsed groups leave an icon rail with a Show button                                                                                             | `52-panels-open.png`, `53-panels-collapsed.png`                                |
| #1404 | Hero content 16 px inside other sections                  | Not re-measured (see Not tested)                                                                                                                                                                             | –                                                                              |

**S1 · Settings › General shows two scrollbars** · Medium · **Observed** (cause: Hypothesis)

- **Evidence.** At 1366 × 768 the Settings panel is 614 px high inside and its content measures 680 px, so the panel scrolls as well as the field list inside it: one scrollbar at the dialog's edge and one beside the fields (`18-settings-general-wait.png`). The other 12 sections measure 614 in 614. It does not happen at 960 × 600 or at 125%, where the dialog is shorter.
- **Reproduce.** 1366 × 768 › Ctrl+, › General.
- **Impact.** Scrolling the wrong bar moves the title, the side list and Save out of place. It reads as unfinished, in the dialog #1409 was about.
- **Likely cause.** The form ends at 601 px, inside the panel, so something outside the normal flow adds the 66 px. The Logo and Site icon pickers' visually hidden radio inputs are the likely source: not verified.
- **Recommendation.** Make the panel `overflow: hidden` when it has an inner scroller (it is a FormDialog, so that can be the primitive's rule), and give the hidden inputs a positioned parent.
- **Acceptance.** On every section at every window size, the Settings panel's `scrollHeight` equals its `clientHeight`. `settings-height.spec.ts` can assert it beside its height check.
- **Effort.** Small.

## 4. Findings

Effort is a rough estimate. No fix has been made.

### High

**H1 · The title bar overflows while the phone preview is on** · Title bar · **Observed** (cause: Source)

- **Evidence.** With **File › Preview on Phone…** started, the bar's cue "Phone preview on" wraps onto three lines, 54 px tall in a 40 px bar, clipped top and bottom (`40-titlebar-phone-1366.png`).
  - At 1366 px, **Publish** ends at 1270 px; the window controls begin at 1229 px. 41 px of the app's main button is under the minimise button.
  - At 960 px, the bar's content is 970 px in 960: "9 to fix" also reaches under the window controls and Publish runs off the window (`41-titlebar-phone-960.png`, and visible behind `38-new-site-960.png`).
  - With the preview stopped, everything fits at both sizes.
- **Reproduce.** File › Preview on Phone… › close the dialog › look at the title bar.
- **Cause.** `apps/desktop/src/renderer/shell/PhonePreviewCue.tsx:26`: the cue has no `whitespace-nowrap` and no `shrink-0`, and the title bar's folding rules (#1166, #1195) don't count it.
- **Impact.** A click meant for Publish can land on a window control: the fault of #1411, on the control used most. The phone preview is a feature a non-technical owner is encouraged to use and may leave on for a whole session.
- **Recommendation.** Never wrap the cue. Fold it first: an icon-only cue with the text in its tooltip once the bar is tight, and Stop inside the phone preview dialog as well. Add the cue to the title bar's fit test.
- **Acceptance.** With the phone preview on, at 960 px and 1366 px and at 125%, no title-bar control extends past the window-controls area, and the bar's `scrollWidth` equals its `clientWidth`.
- **Effort.** Small.

**H2 · Esc or a click outside discards typed work without asking** · Dialogs · **Observed** (extent: Source)

- **Evidence.**
  - **Start a Site:** with a business type, name and description entered and all four steps visited, Esc closed it with no question. Reopened, the name was empty. A click on the dimmed area outside did the same.
  - **Settings:** after editing Site name, one click outside closed it with no question.
  - **Style This Hero:** closed on Esc and on an outside click after a control was changed; whether that change had registered as unsaved was not confirmed.
  - **By the code,** every FormDialog cancels on Esc, the X and an outside click with no check for changes (`packages/editor-ui/src/components/form/form-dialog.tsx:63-67`): Page Settings, Link, the web host form (host, user name and password), Netlify destination, note, New Site. So do the assistant's Draft and Words for Your Pages text areas.
  - **Protected, for contrast:** Theme Studio's Components tab asks Keep Editing / Discard Changes / Apply Changes (`ThemeStudio.tsx:207`), and Report a Problem keeps its message for next time.
- **Impact.** The dimmed area around a dialog is the largest target on screen. One stray click costs a first-time user the whole quick start, or a page of Settings. This is the "closed by accident" problem again, in the dialogs that hold the most typing. Diagnostics already counts it: "Start a Site left before the end".
- **Recommendation.** One rule in the dialog primitives:
  - A dialog with unsaved input does not close on an outside click.
  - Esc and the X ask "Discard your changes?" (Keep Editing / Discard) only when something has changed.
  - Start a Site could instead keep its answers for the next opening, as Report a Problem does.
- **Acceptance.** For each dialog with fields: change one field, click outside, and the dialog stays open; press Esc, and a question appears; with nothing changed, both close at once.
- **Product decision.** Ask, or keep the answers for next time: either is defensible. Silent loss is not.
- **Effort.** Medium (one primitive, about 15 dialogs to check).

**H3 · Style This… and Theme Studio leave too little room for their controls** · Styling dialogs · **Observed**

- **Evidence.**

  | Dialog, window                       | Room for the controls | Length of the controls | Previews    |
  | ------------------------------------ | --------------------- | ---------------------- | ----------- |
  | Style This Hero, 960 × 600           | 152 px                | 2,446 px               | 80 px each  |
  | Style This Hero, 1366 × 768          | 267 px                | 1,229 px               | 175 px each |
  | Theme Studio › Components, 960 × 600 | 207 px                | 1,423 px               | 78 px       |
  | Theme Studio › Components, 125%      | 216 px                | 1,422 px               | –           |
  - At 960 × 600 the Style dialog shows four background options and nothing else, with three scroll areas stacked (each preview and the controls), and "Where it applies" takes more height than the controls do (`55-style-dialog-960.png`).
  - At 1366 × 768 the controls flow in two newspaper columns: the Background list runs off the bottom of the left column and "Bottom right corner" is first at the top right, with no heading (`55-style-dialog-1366.png`).
  - The previews crop the heading they are showing in both sizes.

- **Impact.** The dialogs where an owner makes the site look like theirs are the hardest to use on a small laptop. Nested scroll areas catch the wheel in the wrong place.
- **Recommendation.**
  - Put the previews beside the controls, not above them, whenever the dialog is wider than it is tall; below about 700 px of height, show one preview with a Desktop / Mobile switch.
  - Collapse "Where it applies" to one line ("Applies to: This Hero only · Change") until asked.
  - Use one column of controls with group headings that stay in view, in place of flowing columns.
- **Acceptance.** At 960 × 600 the controls get at least half the dialog's height, and at most one scroll area sits under the pointer anywhere in the dialog. **Target:** 152 px → 260 px or more.
- **Effort.** Medium to large; a layout decision for the product owner.

**H4 · Dialogs still change height and jump** · Dialogs · **Observed** (extent: Source)

- **Evidence.**
  - **Publish to Your Web Host:** 335 px tall. Select Save with the fields empty and it becomes 428 px, and its top moves from 237 to 190 px, so every field shifts under the pointer (`31-publish-host-1366.png`, `32-publish-host-invalid.png`).
  - **Link:** 274 px on Page; 190 px on another link type, top from 267 to 309 px. The row of link types moves 42 px as it is clicked (`67-link-dialog-1366.png`, `68-link-dialog-last-kind.png`).
  - **At risk by their code** (height follows content, and content changes while open): AI Apps (list, add form, key), Publish (loading, then list and test result), Assistant settings, Rewrite and Draft (writing, then text), Licences and Things You Can Ask (search shortens the list), Preview on Your Phone (starting, then the code), Diagnostics (loading), Report a Problem (adding a screenshot), Page Settings (conditional rows).
- **Impact.** The control just used moves away from the pointer; the next click can land on something else. This is #1409's fault outside Settings.
- **Recommendation.** Dialogs are centred, so any height change moves both edges. Two rules cover it:
  - Anchor dialogs by their **top** edge (a fixed distance below the title bar), so growth only extends downward.
  - Reserve room for what is known to come: a line under each field for its error, the tallest link type's rows, a loading state the size of the loaded one.
- **Acceptance.** For each dialog, the top edge and the position of the control just used stay within 1 px through every change of state. One e2e helper can assert it per dialog.
- **Effort.** Small for the anchor rule (one primitive); small per dialog for reserved room.

### Medium

**M1 · Theme Studio saves in two different ways** · Theme Studio · **Observed**

- **Evidence.** On **Styles**, changing "Heading letters" applied at once: no Apply bar, and Esc closed the Studio without a question. On **Components**, changes are held as a draft, with Theme now / With your changes and **Discard** / **Apply Changes** (`11-theme-studio-tab-4-Components.png`). The line under the title says "Each change applies to every page, and is one step you can undo", which is true of four tabs and not the fifth.
- **Impact.** Someone who learns on Colours that changes are live will leave Components expecting the same, and meet a question they don't understand; someone who learns Components first will look for Apply on the other tabs.
- **Recommendation.** One model. Applying at once with Undo is the app's habit everywhere else and fits "one step you can undo". If Components must stay a draft, say so on that tab, and keep the Apply bar's place empty but present on the other tabs so the dialog's layout doesn't change.
- **Acceptance.** The same change-then-Esc sequence gives the same result on all five tabs, or the tab that differs says so in its own words.
- **Effort.** Medium. A product decision (it revisits 4.10 and D7).

**M2 · Page Settings scrolls twice at the smallest window, and is a long form in a narrow column** · Page Settings · **Observed**

- **Evidence.** At 960 × 600 the panel scrolls (677 px in 530) and so does the field list inside it (1,470 px in 402): two scrollbars side by side (`61-page-settings-960.png`). At 1366 × 768 the dialog is 392 px wide and 700 px tall, holding 1,454 px of fields.
- **Recommendation.** The S1 rule (a panel with an inner scroller never scrolls itself). Widen it to the `lg` size and group its fields under the headings Settings uses (Search results, Sharing, Advanced), so less of it is below the fold.
- **Acceptance.** One scrollbar at every size; the search-result preview is visible without scrolling at 1366 × 768.
- **Effort.** Small for the scroll; medium for the grouping.

**M3 · Cancel and Close look different from one dialog to the next** · Dialogs · **Observed** (extent: Source)

- **Evidence.**
  - **Three styles of Cancel.** Filled grey in Settings, Link, the web host form and Start a Site (`67-link-dialog-1366.png`). Plain text in Choose an Image, Choose a Font and Style This (`65-image-picker-1366.png`, `55-style-dialog-1366.png`). Outlined in every confirmation (`62-page-delete.png`).
  - **Three words for leaving** a dialog that has nothing to cancel: **Done** (Site Exported), **Close** (Publish, Licences), **Keep** (While You Were Away, source). About, Preview on Your Phone and Keyboard Shortcuts have no button at all, only the X.
  - **Different places.** New Site puts Cancel and Create at the bottom of its left column (`38-new-site-960.png`); AI Apps puts Add first and to the left, outside a footer (source: `AiAppsDialog.tsx:509-514`); every other dialog has them bottom right.
  - **Opposite orders on twin dialogs** (source): Site Exported ends Done (outline), Open in Browser (filled); Your Site Is Live ends Open in Browser (outline), Done (filled).
  - **"Save"** is Save in Settings, Page Settings and the web host form, but Save Destination for Netlify, Save Link and Save Note.
- **Impact.** Each difference is small; together they stop the footer being something the eye can learn. The plain-text Cancel is the easiest to miss.
- **Recommendation.** A short rule in `docs/extending.md`, enforced in the primitives:
  - Footer bottom right, in the order: other actions, Cancel, primary.
  - Cancel is always the same variant (the filled grey `secondary` is the most visible).
  - A dialog with nothing to save ends with one **Close**; one that finishes a task ends with **Done** as its primary.
  - The primary names the action only when "Save" would be unclear.
- **Acceptance.** A test over every dialog story: the last footer button is the primary, the one before it is Cancel or Close in one variant.
- **Effort.** Small to medium.

**M4 · Red buttons, quotation marks and "…" follow no one rule in confirmations** · Confirmations · **Observed** (extent: Source)

- **Evidence.**
  - **Red for actions Undo reverses.** "Delete Page 'About us'?" says "You can undo it afterwards" beside a red **Delete Page** (`62-page-delete.png`). The site-wide confirmation is always red by its code (`confirm-site-wide.tsx:324`), including Switch Theme, Replace All and applying a look. Meanwhile four removals that are _not_ part of Undo have an ordinary button (source): Remove AI app, Clear diagnostics, Clear Recent, delete a colour of your own.
  - **Three quotation styles in titles:** straight in "Switch to the Theme 'Atelier'?" and "Delete Page 'About us'?"; curly in "Restore “Before theme changes”?"; none in "Delete sam.jpg?".
  - **"…" on buttons that ask first.** Pages have **Delete…**; a picture's button is **Delete**, and it opens the same kind of question (`106-media-selected.png`, `107-media-delete.png`). **Remove** (destination), **Add AI App** and **Add Destination** also open dialogs without one (source).
- **Recommendation.**
  - Red only where Undo can't bring it back; an undoable change gets the ordinary primary and the sentence about Undo.
  - Curly quotation marks around names everywhere (the glossary can state it once).
  - "…" on every button and menu item that opens a dialog before acting, as the menus already do.
- **Acceptance.** `pnpm ui-strings` can check the quotation marks; a test over the confirmation stories checks red against a list of actions outside Undo.
- **Effort.** Small.

**M5 · A page's actions are invisible until the pointer is on its row** · Site tab · **Observed**

- **Evidence.** Each page's "Actions for …" button measures 25 × 25 px at opacity 0 until its row is hovered (`56-site-tab.png` shows none). It holds eight actions: Page Settings…, Rename…, Duplicate, Move Up, Move Down, Move to Folder, Set as Home Page, Delete…. Right-clicking a page opens nothing, although field rows and the Add panel have right-click menus.
- **Impact.** Renaming or deleting a page, and reaching a page's search settings, are hidden until the pointer happens to cross the row.
- **Recommendation.** Show the button on every row at reduced strength (full strength on hover and focus), and open the same menu on right-click. The same for the version rows' "More for …" buttons if they behave alike (not measured).
- **Acceptance.** With the pointer away from the panel, each page row shows its actions button at 3:1 contrast or better; right-click opens the same eight items.
- **Effort.** Small.

**M6 · Diagnostics shows internal names, and its text touches the box's edge** · Help › Diagnostics… · **Observed**

- **Evidence.** "Sites started › quickStart: 1", "Sites started from a template › cafe: 1", "Start a Site left before the end, by its step › details: 1", "… › business: 1" (`23-diagnostics-960.png`). The labels and values sit flush against the box's left edge, with no padding, under a focus outline.
- **Impact.** This is the window that asks to be trusted ("Nothing of your sites is in it"). Code names make it harder to read what is being counted.
- **Recommendation.** Word each name as the app words it elsewhere ("Start a Site", "Café / Restaurant", "Colours and details"); keep the raw names in the saved report only. Add the dialog's usual padding inside the box.
- **Acceptance.** No value in the window matches a camelCase or lower-case identifier pattern.
- **Effort.** Small.

**M7 · New Site's layout breaks at the smallest window** · New Site · **Observed**

- **Evidence** (`38-new-site-960.png`).
  - The word "Sort" sits at the end of the category row and its list ("Name") has wrapped to the next row, alone at the left.
  - The theme list is cut mid-row ("Market") with no sign that it scrolls; Start a Site's step 2 does the same (`03-quickstart-2-960.png`).
  - "Photographer / Portfolio" is cut with an ellipsis at both window sizes (146 px of name in 120).
- **Recommendation.** Keep the label and its list together as one unwrappable item; let template names wrap to two lines; show the scrollbar or a fade on the theme list.
- **Acceptance.** At 960 × 600, no label is on a different row from its control, and no template name is cut.
- **Effort.** Small.

**M8 · Site Check lists identical rows** · Site Check · **Observed**

- **Evidence.** Under "Examples to check": "Testimonial on Home" three times. Only the first says why ("Saturday looks like an example"); the others say nothing (`70-site-check-1366.png`).
- **Impact.** The user can't tell the three apart or see what to check, at the step meant to build confidence before publishing.
- **Recommendation.** Every row says what was found, and names the element by its text where it has some ("Testimonial 'Hannah R.' on Home").
- **Acceptance.** No two rows in a group read the same; every row with **This Is Correct** says what it is asking about.
- **Effort.** Small.

**M9 · Theme Studio › Components › Section previews nothing** · Theme Studio · **Observed**

- **Evidence.** With Section chosen, the Desktop and Mobile previews are empty cream rectangles, 100 px and 80 px tall, above about 50 px of unused space (`11-theme-studio-tab-4-Components.png`). The other tabs preview a heading, text and a button.
- **Impact.** Changes to a Section's background, border and corners are exactly what a preview is for, and there is nothing in it to see them against.
- **Recommendation.** Preview the kind with sample content inside it (a heading and a line of text), as the Themes cards do.
- **Effort.** Small.

### Low

**L1 · Disabled buttons don't say why** · **Observed.** AI Apps' **Add AI App** is disabled until "Let AI apps connect" is ticked (`35-ai-apps-add.png`); Report a Problem's three buttons are disabled until something is typed (`24-report-1366.png`). Neither says so, and #1010 set the rule that each disabled command gives a reason. Add a line or a tooltip ("Turn on 'Let AI apps connect' first").

**L2 · Settings' logo picker breaks file names mid-extension** · **Observed.** "breakfast.j / pg", "riverside.j / pg", "hannah.jp / g" (`18-settings-general-wait.png`). The 42 px thumbnails were still blank 300 ms after the section opened (`13-settings-6-General.png`). Use the image picker's tile (name on one line, cut in the middle) and reserve the thumbnail's box.

**L3 · Start a Site's fields and choices** · **Observed.**

- In Light, the row of business types has no visible track or edges: seven words that don't look like choices (`94-light-quickstart.png`); in Dark it has a grey track (`02-quickstart-1-960.png`).
- "My site" as placeholder text reads as a name already entered.
- Step 4 mixes label-beside-field (Email, Phone) with label-above-field (Address, Opening hours), and "Web address" is cut by the fold with nothing to show more is below (`05-quickstart-4-960.png`).

**L4 · Controls under 24 × 24 px** · **Observed.** Copy, Paste and Reset Appearance are 18 × 18 px in Style This and Theme Studio, against #1181's 24 px. In Publish, each destination's button measures 451 × 18 px (its title line); whether the description under it is also clickable was not checked.

**L5 · AI Apps is narrower than its code intends** · **Observed** (cause: Source). It measures 392 px wide. `AiAppsDialog.tsx:446` asks for `max-w-lg`, but without the `sm:` prefix the primitive's `sm:max-w-md` still applies from 640 px. `DialogErrorBoundary.tsx:42` has the same slip.

**L6 · Two dialogs stacked** · **Observed.** Publish to Your Web Host opens on top of Publish, so two titles and two X buttons are on screen (`31-publish-host-1366.png`). Replace Publish's content with the form and a Back button instead.

**L7 · Wording** · **Observed.** Keyboard Shortcuts lists "Save now" where every other command is in title case, and writes zoom as "Ctrl++" and "Ctrl+−" (`14-shortcuts-960.png`). The Site menu has both "Theme…" and "Theme Studio…" with nothing to tell them apart.

**L8 · An empty band above the page** · **Observed; purpose unknown.** A grey strip about 28 px tall sits between the canvas toolbar and the "Home › Hero" line in every editor screenshot (`07-editor-1366.png`). If it is reserved for something, it should be empty only when that thing is showing.

## 5. Patterns

**Recurring problems**

- **Centred dialogs whose height follows their content.** The root of H4, and of #1409 before it. Anchoring by the top edge removes the jump for every dialog at once.
- **A scrolling panel around a scrolling list.** The primitive scrolls the whole panel (`packages/editor-ui/src/components/ui/dialog.tsx:18`), which is right for a short dialog and wrong once anything inside scrolls: S1, M2. By the code, the X, title and footer also scroll away in Publish, AI Apps, Rewrite, Draft and Template details at short window heights (not observed).
- **Dismissal that doesn't look at what was typed.** H2. An outside click also means opposite things: in the colour picker it keeps the colour (`colour-picker.tsx:151-155`), in every dialog it cancels.
- **Title-bar additions that skip the fit rules.** H1. Anything added to the bar needs a place in its folding order and its test.
- **Three different height caps** (source): `min(44rem, …)`, `min(85vh, …)` and command search's own `calc(100dvh - 7rem)`, which ignores the title-bar height. One token would do.

**Good patterns to reuse**

- **FormDialog and Picker:** title and footer fixed, fields scroll, fixed height where content varies.
- **Report a Problem:** keeps what was typed when closed.
- **Theme Studio's draft question:** three clear choices, the safe one first.
- **Confirmations that count** ("5 pages of your site will change") and mention Undo.
- **Keyboard Shortcuts after PR 1421:** columns by width, a search that doesn't resize the dialog.

**Accessibility**

- **Verified:** text contrast of 4.5:1 or better in the dialogs listed in section 1, both appearances; every dialog has an accessible name; no dialog control outside the window at either size.
- **Verified failures:** 18 × 18 px buttons (L4, WCAG 2.2 SC 2.5.8); page actions with no visible indicator until hover (M5, SC 1.4.11 applies once shown).
- **Needs manual testing:** focus order and focus return for each dialog, screen-reader announcement of the height changes in H4 and the errors in the web host form, and everything at Windows high contrast.

## 6. Next steps

**Quick wins (about a day or less each; estimates)**

1. H1: stop the phone preview cue wrapping, and fold it.
2. S1 and M2: a panel with an inner scroller never scrolls itself.
3. H4, first half: anchor dialogs by their top edge.
4. M4: quotation marks, "…" and red, as string and variant changes.
5. M5: show the page actions button; add the right-click menu.
6. M6, M8, L1, L2, L5, L7: wording and small layout fixes.

**Larger changes**

1. H2: unsaved-changes rule in the dialog primitives (a product decision between asking and keeping).
2. H3: the styling dialogs' layout at small sizes (a design decision).
3. M1: one way of saving in Theme Studio (a product decision).
4. M3: the footer rule, written down and tested.

**A check worth adding.** One e2e helper that opens each dialog at 960 × 600 and 1366 × 768 and asserts: inside the window, below the title bar, panel not scrolling when something inside it scrolls, no sideways scroll, top edge fixed through each state change. It would have caught S1, M2, H4 and, for the title bar, H1, and it turns the manual pass into a regression test.

**Open questions**

- Is the web host form meant to open over Publish (L6), or was that the quickest way to build it?
- What is the band in L8 for?
- Should Start a Site keep its answers between openings, as Report a Problem keeps its message?

## 7. Human validation plan

A plan, not a result.

- **Who:** five small-business owners who have not used Webforge, on their own laptops (at least two at 1366 × 768 or smaller).
- **Tasks:** start a site with the quick start; change the brand colour and one section's look with Style This…; rename a page and change its description; turn on the phone preview and then publish to a test host; open Site Check and deal with one finding.
- **Measures per task:** completed without help or not; wrong turns; time; any dialog closed by accident (count them, and what was lost).
- **Proposed targets:** no accidental loss of typed work in any session; four of five complete Style This… without help at 1366 × 768; four of five find a page's actions within 30 seconds.

## Issues filed

Each finding was filed on 26 Nov 2026 in Phase 5's milestone, out of plan, with its cause, acceptance criteria and tests: 22 issues, 15.25 days. With them goes #1433 (1.5 days), the check §6 proposes: an E2E that opens each dialog and panel at 960 × 600 and 1366 × 768 and checks it fits the window, below the title bar, without jumping. The product owner queued all 23 (16.75 days) after each stream's hero and header items, high severity first ([the plan's §3](../../spec/04-implementation-plan.md#3-timeline), MVP §7 item 66), so the dates are unchanged (PH5-2).

| Finding | Severity | Issue | What                                                                            | Stream    | Days |
| ------- | -------- | ----- | ------------------------------------------------------------------------------- | --------- | ---- |
| S1      | Medium   | #1437 | Settings › General scrolls as well as its field list                            | A, 2 of 7 | 0.5  |
| H1      | High     | #1438 | The phone preview's cue wraps and pushes Publish under the window controls      | A, 1 of 7 | 0.5  |
| H2      | High     | #1439 | Esc or a click outside throws typed work away without asking                    | A, 5 of 7 | 1    |
| H3      | High     | #1440 | Style This… and Theme Studio leave 150 to 210 px for the controls               | C, 1 of 8 | 2    |
| H4      | High     | #1441 | The web host form and the Link dialog change height under the pointer           | A, 3 of 7 | 1    |
| M1      | Medium   | #1442 | Theme Studio's Components waits for Apply Changes; the other tabs apply at once | C, 2 of 8 | 1    |
| M2      | Medium   | #1443 | Page Settings: two scrollbars, and a long form in a narrow column               | A, 4 of 7 | 1    |
| M3      | Medium   | #1444 | Cancel and Close differ from one dialog to the next                             | A, 6 of 7 | 1    |
| M4      | Medium   | #1445 | Confirmations: red buttons, quotation marks and "…" follow no one rule          | A, 7 of 7 | 0.5  |
| M5      | Medium   | #1446 | A page's actions button is invisible until the pointer is on its row            | C, 4 of 8 | 0.5  |
| M6      | Medium   | #1447 | Diagnostics: internal names, and text against the box's edge                    | B, 8 of 8 | 0.5  |
| M7      | Medium   | #1448 | New Site: Sort parts, a list that hides that it scrolls, a cut template name    | B, 7 of 8 | 0.5  |
| M8      | Medium   | #1449 | Site Check: identical rows under Examples to check                              | B, 3 of 8 | 0.5  |
| M9      | Medium   | #1450 | Theme Studio › Components: the Section preview is empty                         | C, 3 of 8 | 0.5  |
| L1      | Low      | #1451 | Disabled buttons don't say why                                                  | C, 6 of 8 | 0.5  |
| L2      | Low      | #1452 | The logo picker breaks file names, and its thumbnails come late                 | B, 4 of 8 | 0.5  |
| L3      | Low      | #1453 | Start a Site: business types, a placeholder, mixed label layouts                | B, 6 of 8 | 0.5  |
| L4      | Low      | #1454 | Controls under 24 × 24 px                                                       | C, 8 of 8 | 0.5  |
| L5      | Low      | #1455 | AI Apps is narrower than its code asks                                          | B, 5 of 8 | 0.25 |
| L6      | Low      | #1456 | The web host form opens on top of Publish                                       | B, 2 of 8 | 1    |
| L7      | Low      | #1457 | Wording: "Save now", "Ctrl++", and Theme… beside Theme Studio…                  | C, 7 of 8 | 0.5  |
| L8      | Low      | #1458 | An empty grey band above the page                                               | C, 5 of 8 | 0.5  |

The product owner's decisions on the four that needed one (26 Nov 2026):

- **H2 (#1439): ask first.** A dialog with unsaved changes doesn't close on a click outside; Esc and the X ask "Discard your changes?" (Keep Editing / Discard) only when something changed.
- **H3 (#1440): previews beside.** Style This… and Theme Studio put their previews beside the settings where the window is wide enough, so the settings get the full height.
- **M1 (#1442): apply at once.** Every Theme Studio tab applies at once, and Undo reverses it; Components stops being a draft.
- **L6 (#1456): one dialog with Back.** Publish to Your Web Host replaces Publish's content, with a Back button, instead of opening on top.
