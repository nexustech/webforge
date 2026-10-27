# Start screen comparison (2.14b)

**Status:** ✅ Decided (SC-1…SC-4, product owner, 26 Oct 2026), after reviewing 2.14b's screenshots (#456); within LF-10 ([07](07-look-and-feel-pass.md)) and the product owner's feedback of 25 Oct 2026 on #430: compare the start screen with other builders', not only Bootstrap Studio's; give it larger type than the editor's compact density (UI1); put the logo, name and version block on the left. No days change.

The start screen is the first thing a person sees. It isn't an editing surface, so it should read at a comfortable size and say plainly what to do next.

## What others do

| Product | First screen | What it says about the next step |
|---|---|---|
| **Bootstrap Studio 9** (screenshot 00, [07](../bootstrap-studio/07-editor-screenshot-pass.md)) | Logo, name and version on the left with *New Design* and *Open*; *Recent Designs* and *Tutorials* tabs on the right, a search field and a card grid with pin and remove | Two large buttons; an empty grid on the first start |
| **Pinegrow** ([docs](https://pinegrow.com/docs/getting-started/quick-intro-to-the-pinegrow-web-editor/)) | Large start icons (new page, open a project), thumbnails of the person's projects, a separate list of recent files, and links to the documentation | The first icon opens a window of frameworks and starter templates; the blank one is the suggested choice |
| **Mobirise** ([review](https://www.techradar.com/reviews/mobirise)) | Asks how to start: with its AI, from a pre-designed template, or a blank page | One question, three answers, before anything else |
| **RapidWeaver Elements** ([2.1 notes](https://forums.realmacsoftware.com/t/rapidweaver-elements-2-1-now-available/54875)) | A *New Projects* window with the installed and the store's projects (templates) | Starting points first, as pictures |
| **Webflow** ([01](../competitors/01-webflow.md)) | A dashboard of the person's sites as thumbnail cards, with *New site* at the top | The sites, and one primary action |

**Patterns:**
- every one leads with **one primary action** to start something new, larger than the rest;
- the person's own work comes back as **thumbnail cards**;
- the first start, with nothing made yet, says how to begin rather than showing an empty list: Mobirise asks, Pinegrow points at a template, Elements shows the starting points;
- help is one click from the first screen.

## Decisions

| ID | Decision |
|---|---|
| SC-1 | **Larger type.** The start screen uses a reading density, not the editor's compact one. The name block, the section headings and the actions are a size or two up from the panels, with full-height buttons (40 px) and larger card text. The title bar keeps the editor's size, as it is the same window chrome. |
| SC-2 | **The logo, name and version block** at the top of the left column, as LF-10 describes. Webforge has no logo yet, so a placeholder mark (`AppMark`: a Lucide icon in the brand colour, in a rounded tile) stands in until one is designed: [#454](https://github.com/nexustech/webforge/issues/454), with the app icon and the installer art, needs the product owner's design decision. |
| SC-3 | **Say what to do next on the first start.** With no recent sites, the right-hand side shows a short welcome with the three ways in, each with a line on what it does: start a site (Blank or a template), try an example, or open a site. Afterwards the recent sites take that place. |
| SC-4 | **Templates stay in New Site.** Elements and Pinegrow show starting points on their first screen. Webforge's New Site dialog already shows the templates as pictures, with *Try an example* one click from the start screen, so the start screen doesn't repeat the gallery. |

**Amended 27 Oct 2026 (QS-4, [09](09-quick-start-wizard.md)):** SC-3's *Start a site* opens the quick start (item 3.11), and New Site stays one link away as *Choose a template yourself*; SC-4 still holds, since the quick start shows the templates as pictures on its second step.
