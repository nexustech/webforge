# UI/UX audit of the desktop app

**Date:** 2026-11-14 · **Build audited:** production build of `apps/desktop` at commit `2cae4929` (version 0.2.0), Windows 11 · **Status:** findings only; no source was changed.

The brief: the UI should be obvious, consistent and easy for a non-technical owner to understand; common tasks should be easy to find; tooltips where they help; and the app should look polished and professional.

Each finding is tagged **[Live]** (seen or measured in the running app) or **[Source]** (read in the code, not exercised).

## 1. Method

- **Build and run.** `pnpm turbo run build --filter=@webforge/desktop`, then the built app launched with Playwright's Electron driver, as `e2e/app/launch.ts` does, with its own `--user-data-dir` and site folder in a temporary folder. First-run preferences were left alone, so the tour and tips showed as they do for a new user.
- **Seeded data.** A site made through **Start a site…** (Food and drink, Café / Restaurant template, Bistro theme, 4 pages, 8 images), then edited: text changed, a section added and deleted, a page added, exported to a folder.
- **Sizes.** 1440 × 900, 1024 × 700 and 960 × 600. The window's minimum is 960 × 600 (`apps/desktop/src/main/window-options.ts:76`), so a 390 px window does not exist; asking for one left it at 960. Phone width was covered where it applies: the canvas's Mobile view (375 px) and the generated site in a browser at 390 px.
- **Themes.** Dark (the default) and Light, the only two the app offers.
- **Measured in the page**, by script: text contrast against its composited background (WCAG AA: 4.5:1, or 3:1 for large text), placeholder contrast, font sizes, control sizes, horizontal overflow, truncated text, headings, window titles, native `title` attributes, Tab order and F6 order, and each icon-only button's tooltip by hovering it.
- **Source read** of `apps/desktop/src/renderer`, `packages/editor-ui/src`, `packages/engine/src` and `packages/i18n/src/en` for inconsistencies a walk misses. A sample of 14 references was re-checked by hand; all matched.

## 2. Verdict

Webforge is closer to a professional tool than most products at 0.2. The foundations are sound: one token-driven theme, one icon set, one dialog family, no raw error text reaching users, friendly validation, undo on everything, a help button on most dialogs, and wording that is unusually plain. Text contrast passes AA on every screen measured in both themes. The generated site is clean at every width.

What holds it back for a shop owner is not a lack of features but **density and discoverability**:

1. It is laid out like a developer's IDE: 12 px text, 23 px buttons, 13 px icons, and the three things a site owner most wants (Preview, Export, Publish) are unlabelled 23 px icons in a corner.
2. The default layout does not fit its own content. The Edit panel scrolls sideways and its colour choices read "The…", "Bra…", "Acc…"; at 1024 px wide the Desktop/Tablet/Mobile buttons fall off the canvas toolbar.
3. Disabled controls do not say why, and a disabled primary button is unreadable.
4. Tooltips are split between a good custom tooltip (title bar) and the browser's slow native one (everything else).

None of these needs a redesign. Section 3 lists the ten changes that would move the app furthest.

## 3. Top ten fixes, in priority order

| #   | Fix                                                                                                                                                                                                                                                      | Why it matters                                                                                                                                                                       | Evidence           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| 1   | **Make the Edit panel fit its content.** Widen the default right column (240 px now) to about 300 px, let the colour options wrap to one per row or show swatch + full name, and stop the Link row overflowing.                                          | The Style tab's colour choices are unreadable ("The…", "Bra…", "Sur…", "Sur…") and the Content tab scrolls sideways (278 px of content in 240 px). This is the main editing surface. | §6.5 [Live]        |
| 2   | **Keep the device buttons visible.** The canvas toolbar needs 625 px; at 1024 px wide it has 542 px and at 960 px, 478 px, so Desktop/Tablet/Mobile are cut off and the zoom box shrinks to a bare arrow.                                                | Seeing the site on a phone is a core task, and 1024–1280 px laptops are common.                                                                                                      | §6.4 [Live]        |
| 3   | **Label Preview, Export and Publish.** Text buttons at the right of the title bar, Publish as the filled primary. There is room: the title bar is mostly empty at 1280 px and up.                                                                        | The three goals of the product are 23 px icons distinguished only by colour.                                                                                                         | §5, §6.3 [Live]    |
| 4   | **Fix disabled states.** A disabled primary button keeps its blue fill with grey text (1.17:1). Disabled menu items, title-bar buttons and Layers buttons give no reason.                                                                                | "Why can't I click this?" is the most common dead end for a new user.                                                                                                                | §9.3, §8.3 [Live]  |
| 5   | **One tooltip everywhere.** Replace the 33 native `title` attributes with the existing `Tooltip`, including shortcuts, on the canvas toolbar, Layers, panel search, Pages, Media and Recent sites.                                                       | Two toolbars a few pixels apart behave differently; native tooltips are slow, unstyled and never show on keyboard focus.                                                             | §8 [Live + Source] |
| 6   | **Fix the two misleading empty states.** Elements says "Add a section first" while a section is selected; a new blank page shows nothing on the canvas and Layers says "Add one from the canvas".                                                        | Both send the user the wrong way at the moment they need a next step.                                                                                                                | §6.6, §6.8 [Live]  |
| 7   | **Show a loading state while a site opens.** The page appears as unstyled HTML (blue links, bullet lists, a full-size photo) for about 2 s before its styles arrive.                                                                                     | It looks broken, and it is the first thing a new user sees after creating a site.                                                                                                    | §6.3 [Live]        |
| 8   | **Simplify Publish for a first-timer.** "Add Destination" opens a menu reading "FTP, FTPS or SFTP…" / "Netlify…"; Test Connection on an empty form says only "The connection didn't work."; the web address typed in the quick start is asked for again. | Publishing is the hardest step for this audience and the least guided.                                                                                                               | §6.11 [Live]       |
| 9   | **Raise the base size, or offer a comfortable density.** 12 px is the working text size, controls are 23 px tall, row buttons 13–16 px. Interface zoom exists but is hidden in the View menu.                                                            | Readability and hit targets for an audience that is not used to dense tools.                                                                                                         | §9.1, §10 [Live]   |
| 10  | **Tidy the menus.** The Edit menu has 28 items with no separators, mixing Title Case and sentence case; Settings cannot be opened from the start screen; there is no Close Site.                                                                         | Menus are where non-technical users look when they are lost.                                                                                                                         | §6.2, §7.3 [Live]  |

Each has an issue in the Phase 5 milestone, not yet queued in a stream: 1 is #1007, 2 is #1008, 3 is #1009, 4 is #1010, 5 is #1011, 6 is #1012, 7 is #1013, 8 is #1014, 9 is #1015 and 10 is #1016. The smaller findings in sections 6 to 10 have no issues yet.

## 4. What already works well

Worth keeping as the standard for the rest:

- **Start a site** (the four-step quick start): plain questions, every one optional, good inline validation ("Use an email address such as hello@example.com."). [Live]
- **Theme Studio › Themes**: real miniature previews of every theme. The most polished screen in the app. [Live]
- **Site Check**: plain-language rules, a help button on every row, Fix and Ignore actions. [Live]
- **Undo**: every change labelled ("Edited Hero title"), a steps menu, "Deleted FAQ · Undo" toast instead of a confirmation. [Live]
- **Help**: F1 window with search, a help button in most dialogs, first-time tips that explain consequences ("Your website is a folder"). [Live]
- **Keyboard**: logical Tab order through the title bar and panels; F6 cycles canvas, bottom panel, right panel, title bar, left panel. [Live]
- **Errors**: no `error.message`, stack, status code or path-only message is rendered anywhere; failures arrive as reason codes mapped to strings. [Source]
- **Consistency of parts**: one Radix dialog family, one icon set (lucide), one tabs component, tokens for every colour in both themes, "…" used consistently (101 strings, no "..."). [Source]
- **Export**: clear progress, a report that says what was written and what is worth a look. [Live]

## 5. Common tasks and how discoverable each is

Rated for a first-time, non-technical user. **Obvious** = visible and labelled; **Findable** = one hover or menu away; **Hidden** = needs help, luck or prior knowledge.

| Task                             | How it is done now                                                  | Rating              | Note                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Start a new site                 | Start screen › **Start a site…** (primary button and card)          | Obvious             | The same four actions appear twice on one screen (sidebar and cards).                                                  |
| Open an existing site            | Start screen › Recent sites card, or **Open a site…**               | Obvious             |                                                                                                                        |
| Change text                      | Click the text on the page and type                                 | Obvious             | The tour teaches it. Works on the first click.                                                                         |
| Change a picture                 | Select the section › Edit panel › **Change image…**                 | Findable            | Nothing on the picture itself offers it.                                                                               |
| Add a section                    | Left panel › Sections › click a name; or the **+** between sections | Findable            | Names only, same icon for all; preview only on hover (not exercised). The **+** on the canvas is small and unlabelled. |
| Add an element (heading, button) | Left panel › **Elements**                                           | Hidden              | Greyed out with a misleading message unless the right kind of section is selected (§6.6).                              |
| Move or delete a section         | Blue bar above the selected section; Layers; right-click            | Findable            | Seven unlabelled icons on the bar; tooltips not verified (canvas frame).                                               |
| Undo                             | Ctrl+Z, title-bar arrow, Edit menu                                  | Obvious             |                                                                                                                        |
| Add a page                       | Right panel › **Site** tab › small **+**                            | Hidden              | "Site" does not say "pages"; the **+** is a 20 px icon with a native tooltip.                                          |
| Change the menu                  | Right panel › Site tab › Menu list                                  | Findable            | Once the Site tab is found.                                                                                            |
| Change colours and fonts         | Right panel › **Theme** tab; **Open Theme Studio**                  | Findable            | Theme tab shows hex codes and px sizes in Simple mode.                                                                 |
| Style one section                | Edit panel › **Style** tab                                          | Findable            | Options truncated at the default width (§6.5).                                                                         |
| See it on a phone                | Device buttons at the top right of the canvas; Ctrl+3               | Hidden at ≤ 1024 px | Buttons are off-screen at 1024 and 960 px wide (§6.4).                                                                 |
| Preview in a browser             | Eye icon in the title bar; File › Preview; Ctrl+I                   | Findable            | Icon only. Opens the default browser with no message in the app.                                                       |
| Check the site for problems      | Bottom panel (title-bar icon or Ctrl+J)                             | Hidden              | No count or badge is visible while the panel is closed; it opens two lines tall.                                       |
| Export                           | Download icon in the title bar; File › Export Site…                 | Findable            | Icon only.                                                                                                             |
| Publish                          | Cloud icon in the title bar; File › Publish…                        | Findable            | Icon only; then needs FTP details (§6.11).                                                                             |
| Save                             | Automatic; "Saved" in the title bar                                 | Obvious             | No Save item in the File menu; Ctrl+S ("Save now") is listed only in the shortcut sheet.                               |
| Go back to an earlier version    | Left panel › third icon tab (Version History)                       | Hidden              | Icon-only tab.                                                                                                         |
| Find and replace                 | Ctrl+F; Edit › Find and Replace…                                    | Findable            |                                                                                                                        |
| Change app settings              | File › Settings…; Ctrl+,                                            | Findable            | Not available at all on the start screen (§6.1).                                                                       |
| Switch light and dark            | View › Use Light Appearance; Settings › Interface                   | Findable            | No "match my computer" option.                                                                                         |
| Get help                         | F1; Help menu; **?** buttons                                        | Obvious             |                                                                                                                        |
| Close the site, back to start    | None found                                                          | Hidden              | No Close Site in the File menu.                                                                                        |

## 6. Screen by screen

### 6.1 Start screen

- **[Live]** Clean and calm. No contrast failures in either theme.
- **[Live]** The four starting actions appear twice: as sidebar buttons and as cards ("Start a site…", "Try an example", "Open a site…", plus a "Choose a template yourself…" link). One set is enough; the cards explain themselves better.
- **[Live]** "Choose a template yourself…" fills its sidebar button edge to edge with no padding left (207 px button, 205 px of content). `apps/desktop/src/renderer/start/StartScreen.tsx`.
- **[Live]** Preview, Export, Publish, Undo and Redo sit disabled in the title bar. Their tooltips repeat the name ("Publish") and give no reason. Disabled icon contrast is 2.26:1 in dark and 1.83:1 in light. Consider hiding them until a site is open.
- **[Live]** The search box in the title bar shows the word "Webforge" as if it were a typed value; with a site open it shows the site's name. It reads as a title, not a search box, until hovered.
- **[Live]** **Settings cannot be opened here.** Ctrl+, does nothing, the File menu has no Settings…, and the command search finds only help pages. A user who wants the light appearance before starting cannot have it.
- **[Live]** The Recent sites thumbnail is a crop of the editor's canvas at whatever zoom and scroll it had on closing, including the blue selection line and grip. The card read "fee and" over half a photo. Capture the top of the home page without editor chrome instead (`apps/desktop/src/main/canvas-capture.ts`).
- **[Live]** Pin and remove on a recent card use native tooltips. Remove acts at once with no confirmation and no undo, while File › Open Recent › Clear asks first. [Source: `start/RecentSites.tsx:99`, `:113`, `:114`]
- **[Live]** At 960 × 600 the screen fits with no overflow.

### 6.2 Menus

- **[Live]** **Edit has 28 items and no separators.** Undo to Find and Replace run in one unbroken column, 555 px tall in a 600 px window. Group them: undo; clipboard; style; arrange; select; shared section; notes; find.
- **[Live]** Capitalisation is mixed inside one menu: "Paste as Linked Copy", "Copy Style", "Style This Hero…", "Add Note…" beside "Move up", "Edit text", "Select parent", "Save as shared section…", "Select similar".
- **[Live]** "Don't publish, or show" (Edit menu, Ctrl+/) is hard to parse. It is a toggle; name it by what it will do: "Leave off the website" / "Put back on the website".
- **[Live]** "Apply Look to Every Hero on This Page" and "…on the Site" are powerful, site-wide commands sitting between Paste Style and Duplicate.
- **[Live]** View › "Stylesheet" is disabled in Simple mode with no explanation; better hidden there. View also holds "Theme…" and "Theme Studio…", which are not views.
- **[Live]** File has Preview, Export, Publish, Save Version, Site Settings, AI apps… but no Close Site and no Exit.
- **[Live]** "AI apps…" is sentence case among Title Case neighbours.
- **[Source]** Disabled menu items never give a reason: a command has only `enabled?: boolean` (`shell/commands.ts:47`, `shell/AppMenu.tsx:38`).

### 6.3 Editor window and title bar

- **[Live]** **Opening a site shows unstyled HTML first.** The page's markup appears before its compiled styles: a blue underlined site name, a bulleted menu, a photo at full size. Measured on a clean reopen: heading at 4.1 s, styles at 6.0 s, so about 2 s unstyled; on first creation it was still unstyled 3 s after the heading appeared. Hold the canvas behind a "Opening your site…" state until `style[data-webforge-site-css]` is present.
- **[Live]** **Preview, Export Site… and Publish… are 23 × 23 px icon buttons** with 13 px icons, told apart by colour (blue eye, green arrow, pink cloud). Their tooltips are good ("Publish… (Ctrl+U)") but a first-time user has to hover to learn what they are. See fix 3. [Source: `shell/TitleBar.tsx:110-120`]
- **[Live]** The three left-panel tabs (Add, Undo History, Version History) are icon-only. Their tooltips are the best in the app (name plus a sentence), but the names would fit as text.
- **[Live]** The right-panel tabs are **Edit · Media · Site · Theme**. "Site" holds Pages and the Menu; "Pages" would be found faster.
- **[Live]** The window title is always "Webforge", even with a site open; the taskbar cannot tell two sites apart. The Help window's title is empty (`apps/desktop/src/renderer/help.html:9`).
- **[Live]** No `h1` or `h2` exists in the editor window until something is selected; screen-reader users have landmarks (F6 regions) but no headings to jump by.
- **[Live]** Preview opens the default browser and gives no sign in the app that it did. If the browser opens behind the window, nothing appears to have happened. A short toast ("Opened in your browser") would close the loop.
- **[Live]** Panel dividers are 1 px lines with a grab area about 4 px wide. They resize by keyboard (arrow keys on the focused divider), which is good, but are hard to find with a mouse.
- **[Source]** "Not saved" looks identical to "Saved": one class for all three states (`storage/SaveStatus.tsx:24`). A failed save should be the loudest thing in the title bar. The `--save-status` token exists but only the stories use it.

### 6.4 Canvas and its toolbar

- **[Live]** **The toolbar overflows below about 1100 px.** Measured content width 625 px; available 542 px at 1024 and 478 px at 960. The Desktop/Tablet/Mobile group is pushed out of view and the zoom box collapses to an arrow. With both side panels open at 960 px the page is shown at 43%, far too small to read.
- **[Live]** The toolbar reads "1024 px · 1024 × 852 @ 89%". That is three ways of stating a size, none of which a shop owner needs. Desktop/Tablet/Mobile and a zoom control are enough in Simple mode. [Source: `shell.ts:260`, `:301`]
- **[Live]** Every toolbar button here uses a native tooltip with no shortcut, though the shortcuts exist (Ctrl+1/2/3, Ctrl+=). "Zoom In" is Title Case beside "Move up" in Layers. [Source: `shell/CanvasToolbar.tsx:188`, `:223`, `:256`]
- **[Live]** The selected section's blue bar (name plus seven icons) sits on top of the page above it. In Mobile view, and at small zoom, it covers the site's own header and name.
- **[Live]** Outlines are on by default: every section and column has a dashed pink border. It makes a finished template look like a wireframe on first open. Consider outlines on hover and selection only in Simple mode.
- **[Live]** Mobile view (375 px) works and the page reflows properly.
- **[Source]** Canvas chrome colours are fixed in both themes: note outline `#f59e0b`, spacing grips `#e8913a` / `#5f9e45`, readout `#1f1f1f` (`packages/engine/src/puck/chrome.tsx:95`, `spacing-handles.tsx:65`, `:109`).

### 6.5 Edit panel

- **[Live]** **Content tab scrolls sideways at the default width.** The panel is 240 px; its content is 278 px. "Change Link…" and "Remove Link" do not fit on one row, so "Remove" is cut off and a horizontal scrollbar appears. Still true at 1024 and 960 px. [Source: default `sideWidth: "240px"`, `shell/ShellLayout.tsx:57`]
- **[Live]** **Style tab colour options are unreadable.** Text colour and Background show two columns of 59 px chips whose labels have 31 px: "The…", "Bra…", "Acc…", "Sec…", "Sur…", "Sur…", "Sur…", "Ne…". Three different surfaces read the same. The chips have no tooltip or `aria-label` carrying the full name. [Source: `packages/editor-ui/src/components/edit/swatch-field.tsx:67`]
- **[Live]** Labels truncate too: "Text align…", "Heading lette…" (Theme tab).
- **[Live]** Long values are clipped in their boxes ("Good coffee and pr"). The Title of a Hero deserves a box as wide as the panel, under its label.
- **[Live]** The Italic and Underline switches are very small next to the 23 px selects beside them.
- **[Live]** "Theme's" as a value, and "Theme's (Corners: Large)" as a link beneath it, are accurate but odd English. "Same as theme (Large)" says it in one place.
- **[Live]** The field label "Alt text here" should read "Description of the picture" with the alt-text explanation in its help line.
- **[Source]** The same field kind, a toggle, is a switch in the Edit panel and a checkbox in dialogs (`edit/toggle-field.tsx:21`, `form/form-fields.tsx:198`).
- **[Source]** The range slider has no focus indicator (`edit/slider-field.tsx:75`).

### 6.6 Add panel

- **[Live]** **Elements tab: wrong message.** With the Hero section selected, all 18 elements are greyed and the hint says "Add a section first: elements go inside sections." A section is selected; the real reason is that a Hero cannot hold loose elements. Say that, and say what can: "Elements go inside a Section or Columns. Add one, or select one." (`packages/i18n/src/en/panels.ts:86`)
- **[Live]** Sections are a list of names with the same icon for every one. Nothing shows what "Features" or "Stats" looks like until hovered. A hover preview exists in source (`add/AddPanel.tsx:183`) but was not exercised; a small thumbnail per row would not depend on hovering.
- **[Live]** The list is cut mid-row where the Layers panel starts below it (half of "Text" shows).
- **[Live]** A new FAQ section arrives with a title and an empty grey box ("Nothing in this list yet"). Sections should arrive with two or three sample items so the user edits rather than builds.
- **[Live]** Clicking a section adds it after the selected one, with a clear hint saying so. Good.

### 6.7 Layers

- **[Live]** Every control uses a native tooltip. Eye buttons read "Show or hide Header (now: Show)". Use the state as the label: "Hide Header while editing".
- **[Live]** With nothing selected, one toolbar button's label is "Don't publish " with a trailing space where the name should be (`panels.ts:114`, `layers.hide`).
- **[Live]** Row controls are 16 × 16 px (eye) and 13 × 13 px (expand arrow); toolbar buttons are 20 × 20 px.
- **[Live]** Two meanings of hiding share one eye icon: "Hide while editing" (the row's eye) and "Don't publish" (the toolbar's eye). Use a different icon for "Don't publish".

### 6.8 Site tab (Pages and Menu)

- **[Live]** **A new blank page gives no next step on the canvas.** The page shows the header with the footer straight under it. Layers says "This page has no sections yet. Add one from the canvas." but the canvas offers nothing; sections are added from the Add panel. Put a large "Add your first section" button on the empty page and fix the sentence (`panels.ts:112`).
- **[Live]** Add Page is a 20 px **+** with a native tooltip. Its menu is good: Blank Page…, Privacy Page, Terms Page, Blog, Suggested Pages.
- **[Live]** Page actions say "Hide from Navigation" while the panel below is called "Menu". Use "Hide from Menu".
- **[Live]** Deleting a page asks first, with a specific red "Delete Page" button. The text adds "This changes 5 pages.", which is unclear; say what changes ("Links to it on 5 pages will be removed").
- **[Live]** The Add Page dialog shows "File name: new-page.html" before anything is typed. Useful later, noise at this moment.

### 6.9 Theme tab and Theme Studio

- **[Live]** The Theme tab in Simple mode shows hex codes (`#405f39`), eight "px" size selects and Heading 1 to Heading 6. Font pairing and the theme picker are the right level; put colours-as-codes and per-heading sizes behind "More options" or leave them to Theme Studio.
- **[Live]** Theme Studio › Themes is excellent. Sample text in every card is truncated ("Fresh bread every m…"); shorten the sample. Its smallest text is 11 px.
- **[Live]** Theme names include "Light", "Dark" and "High contrast", the same words as the app's own Appearance setting. In the quick start they sit in one list with Bistro and Atelier; a user may think they are choosing the app's look.
- **[Live]** Theme Studio › Components: "Apply Changes" is a disabled blue button with grey text (1.17:1) until something changes.
- **[Source]** The section name "Components" is on the glossary's avoid list for Element (`theme.ts:161`, `research/product/01-terminology.md`).

### 6.10 Site Check

- **[Live]** Nothing shows its result while the panel is closed. "5 should fix · 13 tips" exists only inside the panel. Put that count in the title bar or a status strip, as a button that opens the panel.
- **[Live]** The panel opens about 85 px tall: the summary and the "MUST FIX" heading, no rows. Open it at a third of the window.
- **[Live]** Passed rules outnumber problems about 10 to 1 and are listed in full, so the two or three things to do are scattered among green rows. Show problems first and fold "Passed (27)" away.
- **[Live]** "Worth a look" rows sit under the "SHOULD FIX" heading, and the summary counts "should fix" and "tips": three words for two levels.
- **[Live]** "Every page has a name Windows can save" will puzzle most people (`siteCheck.ts:26`). "Stylesheet rules" appears in Simple mode.
- **[Live, low confidence]** Once, while the Find tab was in front, the Site Check list held a new page under its internal ID ("82EelgEPlARBQCBZ") instead of "Catering". It was correct when the tab was next shown. Worth a regression test for a page added while the panel is hidden.

### 6.11 Preview, Export, Publish

- **[Live]** **Export dialog**: clear. "A folder / A ZIP file" and "Make the files smaller" are well put.
- **[Live]** The export progress toast makes **Cancel** the filled blue button; during a long task the only button should be quiet.
- **[Live]** The export report's primary button is "Open Site", the same words as File › Open Site… (open a `.wforge`). Call it "Open the website" or "Show the folder" (`export.ts:60`, also `publish.ts:220`).
- **[Live]** **Publish, first time.** The dialog says "No destinations yet. Add your web host: its address, your user name and the folder it serves." "Add Destination" is a ghost button, weaker than "Close" beside it, and it opens a menu with no arrow to say so: "FTP, FTPS or SFTP…" and "Netlify…". For this audience, lead with a question ("Where is your website hosted?") and put the protocol inside the form, where it already defaults sensibly.
- **[Live]** The host form is well explained field by field ("Where your host serves your site from, such as /public_html"). But:
  - **Test Connection** on an empty form answers "The connection didn't work." with no field marked. **Save** on the same form marks each field ("Fill this in."). Test should validate first.
  - Both Test Connection and Save are filled blue; one primary per dialog.
  - **Web address** is empty although it was entered in the quick start and is in Site Settings.
  - Input widths vary without reason (Name and Host short, Password and Folder long).
- **[Live]** The Publish dialog has a "Close" button and a corner ×; the FTP form has Cancel, Save and a ×.
- **[Source]** Any thrown error while publishing ends in "Publishing didn't work. Publish again." with no cause (`publish/publish-flow.ts:187`, `:201`, `:228`).
- **[Live]** **Preview on Phone**: clear dialog and a "Phone preview on · Stop Phone Preview" cue in the title bar. The dialog has no Done button, only the ×.

### 6.12 Settings

- **[Live]** One dialog for the app and the open site ("App" and "This site" groups) with a help button per section. Good.
- **[Live]** One Save for twelve sections: it is not clear whether changing section loses edits. Say "Save all" or save per section.
- **[Live]** Jargon in fields a shop owner will meet: "A language code such as en, en-GB or de"; "Latitude" / "Longitude"; "Google Analytics measurement ID"; "with its HTML tag method". Each has a sensible help line, but Language should be a list of languages.
- **[Live]** No "match my computer" appearance option. [Source: `settings/app-settings.ts:29`; no `prefers-color-scheme` or `forced-colors` anywhere]
- **[Source]** The Assistant's strings say "Preferences › Assistant" five times; the dialog is called Settings (`assistant.ts:30`, `:31`, `:32`, `:37`, `:78`).

### 6.13 Help window

- **[Live]** Well organised, searchable, fits at its 520 px minimum with no overflow.
- **[Live]** **A literal `{appName}` shows** in the Glossary's summary on the contents page: "The words {appName} uses…". The page bodies fill it in; front-matter summaries do not (`docs/help/glossary.md:5`, drawn at `help/HelpWindow.tsx:94`).
- **[Live]** The window has no title.
- **[Source]** Its error text uses the fill colour `text-destructive` (2.5:1 as text) where everything else uses `text-destructive-text` (`help/HelpWindow.tsx:244`).

### 6.14 Tour and tips

- **[Live]** Four cards, optional, skippable, never blocking. The offer card and the last card sit in the middle of the page over the hero heading; anchor the last one to the Help menu it describes.
- **[Live]** Tips are short and say what happens next. Keep them.

### 6.15 The generated site

- **[Live]** At 1440, 1024 and 390 px: no horizontal overflow, no contrast failures, page titles set ("Menu | Rosa's Bakery"), smallest text 14 px.
- **[Live]** The Menu page of the Café / Restaurant template has no `h1`. Site Check reports this as a tip for three template pages; a template should not ship with its own warnings.
- **[Live]** The quick start keeps the template's sample text ("A small café by the river in Kendal") although "What you do" was answered. That is documented behaviour, but a first-time user sees someone else's business on their home page; at least the hero line could take their answer.

## 7. Language and naming

### 7.1 What is right

- No IPC, JSON, SQLite, DOM, slug, breakpoint, viewport, deploy, URL ("web address" throughout), "Something went wrong" only on real crashes. [Source, 3,274 strings]
- Destructive confirmations are specific: "Delete Page", "Delete Version", "Delete Theme", "Replace It". No Yes/No buttons anywhere. [Source]

### 7.2 Jargon a shop owner meets in Simple mode

| Where                  | Text                                                            | Suggest                                               | Tag      |
| ---------------------- | --------------------------------------------------------------- | ----------------------------------------------------- | -------- |
| Canvas toolbar         | "1024 px", "1024 × 852 @ 89%"                                   | Device name and zoom only                             | [Live]   |
| Theme tab              | "hex code", "#405f39", "60 px"                                  | Swatch and a named size (Small … Huge)                | [Live]   |
| Publish                | "Add Destination", "FTP, FTPS or SFTP…", "the folder it serves" | "Add your web host", protocol inside the form         | [Live]   |
| Site Check             | "Every page has a name Windows can save", "Stylesheet rules"    | "Every page's file name is valid"; hide in Simple     | [Live]   |
| Layers / Edit menu     | "Don't publish, or show", "(now: Show)"                         | "Leave off the website" / "Put back"                  | [Live]   |
| Edit menu, command box | "Select parent", "Select previous sibling"                      | "Select what this is inside", "Select the one before" | [Live]   |
| Layers empty state     | "Add one from the canvas"                                       | "Add one from the Add panel"                          | [Live]   |
| Settings               | "language code", "measurement ID", "HTML tag method"            | A language list; keep the others with their help      | [Live]   |
| Export progress        | "Building page 2 of 8", "Building the styles"                   | "Preparing page 2 of 8" (glossary avoids "build")     | [Source] |
| Edit panel             | "Theme's ({token}: {value})", "Uses {tokens}"                   | Glossary avoids "tokens"                              | [Source] |
| AI apps                | "MCP server", "Authorization: Bearer", "run it in a terminal"   | Glossary avoids "MCP server"; keep behind "Advanced"  | [Source] |

### 7.3 Capitalisation

Two conventions run side by side. Menu-bar commands are Title Case ("Save a Copy as ZIP…", "Use Advanced Mode"); canvas and element commands in the same menus are sentence case ("Select parent", "Save as shared section…"). Buttons split the same way: "Add Destination", "Add Device", "Save Version" against "Add AI app", "Add a device", "Keep the code". The same words appear both ways: "Not Now" (`ai.ts:63`) and "Not now" (`onboarding.ts:10`). [Live + Source]

Pick one rule and write it in the glossary. Suggested: Title Case for menu items and dialog titles, sentence case for everything else, including buttons.

### 7.4 One thing, several names [Source unless noted]

- **Settings / Preferences**: see §6.12.
- **Image / Picture / Photo**: 94, 28 and 14 strings. "Photos" and "Photo corners" in the theme, "Pictures from the template" in Site Check, "Image" in the Edit panel.
- **File / Document**: the glossary avoids "document", yet "Images and documents", "Drop images or documents here.", "PDF document", link type "Document" (`site.ts:8`, `:11`, `:59`, `:134`). **[Live]** in the Media panel.
- **Menu / Navigation**: "Hide from Navigation" in a panel called Menu. **[Live]**
- **Remove / Delete**: mostly principled, but "Remove this device" against "Delete {name}" for a saved theme.
- **Sign in / log in**: eight to one (`publish.ts:139`).
- **"item"** is used 126 times as a fourth level beside Section and Element.
- **Names in messages are quoted four ways**: `'About us'`, `“name”`, `"name"` and bare.

### 7.5 Error and validation text

- **[Live]** Field errors are friendly and specific in the quick start. "Fill this in." is curt beside them; name the field ("Enter your host's address").
- **[Live]** "Some values need fixing before they can be saved." appears at the foot of the FTP form while the errors are further up; scroll to and focus the first one.
- **[Source]** Generic endings with no next step: "{appName} couldn't open the site.", "{appName} couldn't add the files.", "Publishing didn't work. Publish again."
- **[Source]** A raw key or ID can reach the screen when a string is missing: `site-check/SiteCheckPanel.tsx:46`, `ai/app-tools.ts:29`, and "This element can’t be shown ({type})" (`puck.ts:30`), which also holds the catalogue's only curly apostrophe.
- **[Source]** Inline error text comes in three sizes (11, 12 and 13 px) depending on the component.

## 8. Tooltips

### 8.1 What exists

- A real component: `packages/editor-ui/src/components/ui/tooltip.tsx` (Radix, 400 ms delay, shows on keyboard focus). Used at only six places: title-bar buttons, help buttons, the panel tab strip, the undo steps menu and the Columns toolbar. [Source]
- **[Live]** Where used, it is good: name plus shortcut ("Export Site… (Ctrl+E)"), and name plus a sentence on the left-panel tabs.
- **[Source]** 33 interactive controls use the native `title` attribute instead, and 13 non-interactive elements carry a `title` that a keyboard user can never reach (Layers status icons, `layers/LayersPanel.tsx:549-591`).

### 8.2 Measured by hovering every icon-only control in the editor [Live]

| Area                                   | Controls | Real tooltip | Native `title` only |
| -------------------------------------- | -------- | ------------ | ------------------- |
| Title bar                              | 11       | 11           | 0                   |
| Left-panel tabs                        | 3        | 3            | 0                   |
| Panel search buttons                   | 2        | 0            | 2                   |
| Canvas toolbar (zoom, rotate, devices) | 6        | 0            | 6                   |
| Layers rows (eye, expand)              | 20       | 0            | 20                  |
| Layers toolbar                         | 8        | 0            | 8                   |

The same window therefore has 36 controls whose tooltip is the browser's: slow to appear, unstyled, no shortcut, absent on keyboard focus, and usually absent on a disabled button.

### 8.3 Where to add or change

1. **Convert all 33 native titles** to `Tooltip`. Lists: `shell/CanvasToolbar.tsx:188`, `:223`, `:256`; `layers/LayersPanel.tsx:513`, `:746`, `:826`; `shell/ShellLayout.tsx:229`, `:279`; `site/PagesPanel.tsx:257`, `:324`; `menu/MenuPanel.tsx:239`; `start/RecentSites.tsx:99`, `:113`; `media/MediaPanel.tsx:380`; `versions/VersionHistoryPanel.tsx:142`, `:191`; `theme/studio/StudioThemes.tsx:180`, `:193`; `packages/editor-ui/src/components/edit/edit-panel.tsx:233`, `:353`, `:674`, `:761`; `edit/list-field.tsx:78`.
2. **Add shortcuts** where they exist: Desktop (Ctrl+1), Tablet (Ctrl+2), Mobile (Ctrl+3), Zoom In (Ctrl+=), Zoom Out (Ctrl+−).
3. **Give disabled controls a reason.** Add an optional `disabledReason` to `Command` (`shell/commands.ts:47`) and show it in the tooltip and beside the menu item: "Undo: nothing to undo yet", "Publish: open a site first", "Paste Style: copy a style first", "Stylesheet: turn on Advanced mode". The Edit panel already does this for fields (`editor/edit-panel-fields.ts:307`); copy that pattern.
4. **Add tooltips where there are none**: the "…" row menus in Pages, Menu and Add (`site/PagesPanel.tsx:331`, `:550`; `menu/MenuPanel.tsx:356`; `add/AddPanel.tsx:232`); the colour chips in the Style tab (full name); truncated labels (full label).
5. **Make Undo say what it will undo**: "Undo Edited Hero title (Ctrl+Z)". The label already exists in the steps menu.
6. **Not verified:** the seven icons on the selected section's bar and the **+** between sections are drawn inside the canvas frame and were not hovered. In source the **+** uses a native `title` (`packages/engine/src/puck/chrome.tsx:270`).

## 9. Look and feel

### 9.1 Typography [Live]

- Scale in use: 11, 12, 13, 15, 19.5 and 24 px (`theme.css:163-172`). The editor window's text is almost all 12 px: 56 of 62 visible text runs on first open, 90 of 100 with the Style tab open. Dialogs use 13 px with 12 px help text.
- Smallest text measured: 11 px (Style tab, Theme Studio). Smallest in source: 10 px, the Draft badge (`site/PagesPanel.tsx:219`), below the 11 px floor the theme's own comment sets (`theme.css:160`).
- `--text-sm` and `--text-base` are both 13 px, and `rounded-sm` and `rounded-md` are both 3 px: two names for one value invite drift. [Source]
- Hierarchy is flat. Panel titles, group headings, labels and values are all 12 px, told apart only by weight and a blue tint. A 13 px semibold group heading and 12 px labels would give the panels a visible structure.
- The system font (Segoe UI) is the right choice for a desktop tool.

**Recommendation:** make 13 px the working size and 12 px the secondary size, or ship a "Comfortable" density as the default with "Compact" as the option. Interface zoom (View › Zoom In Interface, Ctrl+Alt+=) exists but nobody will find it; surface it in Settings › Interface as "Text size".

### 9.2 Colour [Live unless noted]

- Dark theme: slate greys, one blue accent (`#0a6fb7`), restrained. Light theme: equally consistent. Neither has stray colours in the editor chrome.
- The title-bar action icons use status colours as decoration: amber for Open (`text-warning`), blue Preview, green Export, pink Publish (`shell/TitleBar.tsx:85-120`). Amber and green carry meaning elsewhere (warnings, passed checks).
- Site-wide confirmations ("Switch Theme", "Change Fonts", "Allow") always use the red destructive button, while "Remove" for an AI app, which cannot be undone, is blue. [Source: `shell/confirm-site-wide.tsx:212`, `ai-apps/AiAppsDialog.tsx:474-491`]
- 30 hard-coded colours remain outside the token file, mostly canvas chrome; three in `main/window-options.ts:20-31` copy token values by hand and will drift. [Source]

### 9.3 Contrast, measured [Live]

Text was measured on the start screen, the quick start (4 steps), the editor with each panel and tab, eight dialogs, Theme Studio (5 tabs), the Help window and the shortcut sheet.

| What                                            | Dark                                | Light                               | AA needs       | Result                                        |
| ----------------------------------------------- | ----------------------------------- | ----------------------------------- | -------------- | --------------------------------------------- |
| Body, label and help text, all screens          | no failures                         | no failures                         | 4.5:1          | Pass                                          |
| Error text                                      | 5.29:1 (`#ff7a7c`)                  | no failures                         | 4.5:1          | Pass                                          |
| Primary button text, resting                    | 5.29:1                              | 4.96:1                              | 4.5:1          | Pass                                          |
| Primary button text, hovered                    | not measured                        | **4.17:1** (white on `#337dd5`)     | 4.5:1          | Fail on hover                                 |
| Destructive button text                         | 5.06:1                              | not measured                        | 4.5:1          | Pass                                          |
| Placeholder text                                | **3.73:1** (`#a0a3a6` on `#41474c`) | **3.04:1** (`#929495` on `#ffffff`) | 4.5:1          | Fail                                          |
| Disabled text in panels                         | 2.79:1                              | 2.40:1                              | exempt         | Dim; hard to tell from enabled in light       |
| Disabled title-bar icons                        | 2.26:1                              | 1.83:1                              | exempt         | Close to invisible in light                   |
| **Disabled primary button** (grey text on blue) | **1.17:1**                          | not measured                        | exempt         | Unreadable; looks like a broken active button |
| Title-bar action icons                          | not measured                        | 3.51–4.21:1                         | 3:1 (non-text) | Pass                                          |
| Unselected device icons                         | 4.79:1                              | not measured                        | 3:1            | Pass                                          |

The disabled primary button was seen twice: "Apply Changes" in Theme Studio › Components and "Add AI app" in AI apps. Cause: `disabled:text-disabled` changes only the text and leaves `bg-primary` (`packages/editor-ui/src/components/ui/button.tsx:8`). Give disabled buttons a muted fill.

Placeholders matter here because several fields rely on them for an example ("https://www.example.com", "ftp.example.com").

### 9.4 Spacing and layout [Live]

- Consistent 3 px radius and tight spacing throughout; nothing looks misaligned.
- The default layout is too tight for its own content (§6.5, §6.4). At 1440 × 900 the two side columns are 240 px each while the canvas has 958 px; 20–25% for the right column would cost the canvas little.
- Nothing reflows between 960 and 1440 px: there are no width queries in the renderer and every `sm:` class is always true in the main window. [Source] The panels can be collapsed by hand, but the app does not help at small sizes. At under about 1100 px, collapse the left column to its icon strip by default.
- Dialogs fit at 960 × 600 with no clipping (Settings 624 × 430, quick start 832 × 572, Theme Studio 934 × 574). In the quick start the theme list and the contact form are cut mid-row at the dialog's fold with no fade or hint that they scroll.
- Dialog widths are chosen per dialog (xs, sm, md, lg, xl, 2xl, 3xl, 5xl). [Source] `ai-apps/AiAppsDialog.tsx:284` passes `max-w-lg` without `sm:`, so the default width probably wins; not verified.

### 9.5 Component consistency [Source unless noted]

| Component       | Canonical                              | Outliers                                                                                                                                                                          |
| --------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button          | `ui/button.tsx` (143 uses)             | 31 raw `<button>`s; the list-row button is written out twice with the same classes (`menu/MenuPanel.tsx:207`, `site/PagesPanel.tsx:205`); the start card three ways               |
| Cancel button   | none                                   | Three styles: secondary (forms), outline (alerts, export), ghost (assistant, style dialog). **[Live]** Cancel is filled in the quick start and outline in the delete confirmation |
| Dismiss wording | none                                   | "Close" or "Done" with no rule, plus a corner × on every dialog                                                                                                                   |
| Dialog          | `ui/dialog.tsx`, `ui/alert-dialog.tsx` | Native OS boxes for crash and recovery, with an "OK" button                                                                                                                       |
| Select          | native `<select>` via `SelectField`    | An unstyled select in the text-format toolbar (`packages/engine/src/puck/rich-text.tsx:88`)                                                                                       |
| Search box      | `fieldControlClass`, 28 px             | Four heights (24, 28, 32, 40 px); some with a leading icon, some without                                                                                                          |
| Toggle          | switch (Edit panel)                    | Checkbox for the same field kind in dialogs                                                                                                                                       |
| Empty state     | none                                   | Nine hand-written `<p>`s: centred or left, 12 or 13 px, four paddings, never an icon or a button                                                                                  |
| Loading         | none                                   | A sentence, a toast or nothing; no spinner or progress component                                                                                                                  |
| Warning callout | none                                   | Copied three times with different spacing; the warning-triangle note copied four times                                                                                            |
| Focus style     | none                                   | Three conventions: ring (21 uses), outline (12 uses), browser default                                                                                                             |
| File size text  | none                                   | Three formatters: ÷1024 with "en", ÷1000 with the system locale, ÷1,000,000. The same file can show two sizes in Media and Site Check                                             |
| Primary action  | last, right-aligned                    | **[Live]** Two primaries in the FTP form and in the quick start ("Create site" and "Next"); AI apps puts Add first                                                                |

Building `EmptyState`, `Callout`, `Spinner` and a `formatFileSize` helper would remove most of this table.

## 10. Accessibility

`docs/reviews/2026-11-07-accessibility-pass.md` covers this in depth and was not re-run. From this walk:

- **Contrast**: see §9.3. Placeholders fail AA in both themes.
- **Target size [Live]**: standard buttons are 23 × 23 px, just under WCAG 2.2's 24 px minimum (2.5.8); Layers buttons are 20, 16 and 13 px; the dialog × is 16 px. 61 controls under 24 px were counted in the editor on first open. At 14 px base (or 110% interface zoom) the standard button clears 24 px.
- **Keyboard [Live]**: Tab order follows the screen. F6 moves between regions. Three scrolling containers and one tab list take focus with no visible indicator. Panel dividers resize with arrow keys.
- **Focus visibility [Source]**: no global focus style; the slider has none; the Find panel's result rows look the same focused as hovered (`find/FindReplacePanel.tsx:151`).
- **Names [Live]**: every icon-only control has an accessible name. No positive `tabIndex`. [Source] Only two click handlers on non-buttons, both with role and keys.
- **Headings and titles [Live]**: see §6.3. Dialogs have proper `h2` titles.
- **Themes [Source]**: no high-contrast or forced-colours support and no "follow the system" option.
- **Motion [Source]**: `prefers-reduced-motion` is respected in both CSS files.
- **Screen reader**: not tested.

## 11. Suggested order of work

### Quick wins (hours each)

1. Widen the default side columns to about 300 px (`shell/ShellLayout.tsx:57`); stack "Change Link…" and "Remove Link".
2. Give disabled buttons a muted fill (`ui/button.tsx:8`).
3. Darken or lighten the placeholder token to reach 4.5:1 in both themes; fix the light primary hover.
4. Reword `add.noSection`, `layers.empty`, `layers.shownMenu`, `canvas.toggleHidden`, `export.report.openFolder`, `pages.hideFromNavigation`, `siteCheck.rule.deviceNames.pass`.
5. Fix the "Don't publish " label with no name; fill `{appName}` in help summaries; give both windows titles (site name in the main one).
6. Add separators to the Edit menu; hide Stylesheet in Simple mode.
7. Make Settings reachable from the start screen.
8. Make the export toast's Cancel a quiet button; one primary in the FTP form; validate before Test Connection; prefill Web address.
9. Replace "Preferences" with "Settings" in the Assistant's strings.
10. Open the bottom panel at a useful height.
11. Use `text-destructive-text` in `help/HelpWindow.tsx:244`; replace `text-[10px]` in `site/PagesPanel.tsx:219`.

### Medium (a day or a few)

1. Convert the 33 native titles to `Tooltip`, with shortcuts.
2. `disabledReason` on commands, shown in tooltips and menus.
3. Labelled Preview, Export and Publish buttons; a Site Check count in the title bar.
4. Canvas toolbar that fits at 960 px: device buttons first, size readout dropped or moved into the View menu.
5. Colour chips that show their names (one per row, or swatch grid with tooltips).
6. Loading state for the canvas until its styles arrive.
7. "Add your first section" on an empty page; sample items in new sections.
8. Site Check: problems first, passed rules folded.
9. Recent-site thumbnails without editor chrome.
10. One capitalisation rule, applied to the catalogue; one word each for image, file and menu; add both to the glossary.
11. `EmptyState`, `Callout`, `Spinner`, `formatFileSize`; one Cancel style; one focus style in `theme.css`.

### Larger

1. A comfortable default density (13–14 px base, 28–32 px controls) with Compact as an option.
2. Layout that adapts under about 1100 px (left column collapsed to icons by default).
3. A guided first publish ("Where is your website hosted?") in place of the destinations list.
4. Thumbnails for sections in the Add panel.
5. A simpler Theme tab in Simple mode, with codes and per-heading sizes in Theme Studio only.
6. "Match my computer" appearance and Windows high-contrast support.
7. Outlines on hover and selection only, in Simple mode.

## 12. Not covered

- **macOS and Linux.** Windows 11 only. Mac menu placement, traffic lights and Cmd shortcuts were not seen.
- **The packaged, installed app** (`pnpm e2e:packaged`): the production build was run unpackaged, so the installer, file associations and auto-update prompts were not seen. Native window controls do not appear in the screenshots.
- **Native dialogs** (file open and save, crash and recovery boxes) were stubbed or not triggered.
- **A real publish.** No connection was made to any host; Netlify's form was not opened. Only the empty and invalid states of the FTP form were seen.
- **The Assistant panel, AI apps connections, Version History restore, Blog, shared sections, notes, Custom Code, the Stylesheet panel and Advanced mode** were opened at most to their first screen, or not at all.
- **Inside the canvas frame**: the selected section's bar, the text-format toolbar, spacing and width handles and drag-and-drop were seen in screenshots but not hovered or measured. Drag-and-drop of sections and panel dividers was not exercised with a real pointer.
- **The Add panel's hover preview** was not triggered.
- **Media**: adding, cropping and deleting files (needs the file dialog).
- **Templates other than Café / Restaurant**, and **Choose a template yourself…**.
- **Screen readers, Windows high-contrast mode and interface zoom above 100%.**
- **Light theme** was measured on the start screen, quick start, editor, Style tab and Elements tab; dialogs and Theme Studio were measured in dark only.
- **Timing figures** (styles arriving about 2 s after the page) are from one machine with other work running; the first reopen measured 20 s and was discarded as contention.
- **Storybook stories** were not opened.
