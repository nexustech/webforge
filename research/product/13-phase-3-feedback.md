# Phase 3 feedback: the product owner's review

**Status:** ✅ Decided (PF-1…PF-4, product owner, 29 Oct 2026): four items, 3.18–3.21 ([#632](https://github.com/nexustech/webforge/issues/632)–[#635](https://github.com/nexustech/webforge/issues/635), 7 days), in Phase 3 before Phase 4 starts.

**Goal:** record what the product owner's hands-on review of the app at the end of Phase 3 found, what the code did at the time, and what was decided, so the plan items can be built without asking again.

## 1. The feedback and what the code did

Each point was checked against `main` at [`fd5edabf`](https://github.com/nexustech/webforge/commit/fd5edabf) (29 Oct 2026). All four were genuine.

| # | Feedback | What the app did | Finding |
|---|---|---|---|
| 1 | *File* should have *Open Recent* with up to the 5 most recently opened sites | The File menu had New Site, Quick Start and Open Site (`renderer/start/SiteCommands.tsx`). The recent sites (up to 12, plus pinned ones, `main/recent-sites.ts`) were listed only on the start screen. The editor's menus were flat lists of commands, drawn in the title bar on Windows and mirrored to the macOS menu bar (LF-13), with no submenus | A gap: every desktop app people know has *File › Open Recent*. Needs submenus in the editor's menus |
| 2 | An image's width and/or height should be settable, keeping its proportions or fixing both | The Image element had Width (Small 320 px, Medium 448 px, Large 672 px, Full), per device, with the canvas's width handles snapping to them (2.17). The picture always kept its own proportions; there was no height. Cropping to an aspect preset existed only in Media (1.16) | Partly covered. Images side by side couldn't line up, and nothing set a height. F-ED-4's rule (style controls are tokens) rules out free pixel values without a decision |
| 3 | An image should be able to open larger in a popup | The Gallery section had a lightbox (G10, 2.7): a native `<dialog>` with next and previous. The Image element had no such option, and its export held no file larger than it showed (X2) | A gap, which reuses the Gallery's lightbox |
| 4 | Section widths aren't consistent: Features is wider than an empty Section with a heading | The Section capped its content at 896 px (`max-w-4xl`), as Contact details and the video and map embeds do; Features, Gallery, Team, Stats, Logos and the Pricing grid at 1152 px (`max-w-6xl`); the text-led sections (FAQ, centred Text, Call to action) at 768 px (`max-w-3xl`), on purpose, for line length. The Section's only width control was *Full width* | A bug: a Section built from a heading and elements didn't line up with the grid sections around it. Squarespace gives each section a content width ([product/08](08-component-styling.md) §2.5) |

## 2. Options put to the product owner

- **Image size:** (a) a *Shape* setting with crop-to-fill on the focal point, plus height presets, all tokens; (b) exact pixel width and height with a *Keep aspect ratio* lock, in Advanced mode only; (c) exact pixels for everyone, as Wix does, which [product/08](08-component-styling.md) §2.5 notes is what makes sites inconsistent.
- **Section width:** (a) a *Content width* setting on every section, each kind keeping today's width as its default; (b) only widen the Section to 1152 px; (c) one width for every section, text-led ones included, at the cost of long lines.
- **Open larger:** (a) the one picture; (b) next and previous through every such picture on the page, as the Gallery does.
- **When:** (a) a short block before Phase 4; (b) inside Phase 4; (c) Phase 5's hardening.

## 3. Decisions

All decided by the product owner on 29 Oct 2026, each the recommended option.

| ID | Decision |
|---|---|
| PF-1 | ✅ MVP, item 3.18 ([#632](https://github.com/nexustech/webforge/issues/632), 1.5 days, stream A): *File › Open Recent* with the 5 most recently opened sites and *Clear Recent* (which keeps pinned sites), on Windows and macOS. The editor's menus gain submenus for it |
| PF-2 | ✅ MVP, item 3.19 ([#633](https://github.com/nexustech/webforge/issues/633), 2 days, stream B): the Image element gains *Shape* (Original, Square, Landscape 4:3, Wide 16:9, Portrait 3:4, Set height), cropping to fill on the focal point and never stretching, with a file large enough for the crop, and *Height* (Small, Medium, Large) for *Set height*, per device. No pixel values: F-ED-4's token rule stands |
| PF-3 | ✅ MVP, item 3.20 ([#634](https://github.com/nexustech/webforge/issues/634), 1.5 days, stream B after 3.19): *Open larger when clicked* on the Image element, one whole, uncropped picture in the Gallery's lightbox with no next or previous, a link to the large JPEG or PNG without JavaScript, and a large copy in the export only for such Images |
| PF-4 | ✅ MVP, item 3.21 ([#635](https://github.com/nexustech/webforge/issues/635), 2 days, stream C): *Content width* (Narrow 768, Medium 896, Wide 1152, Full) on every section, each other kind's default its width today; the Section's default becomes Wide, with a migration keeping Sections already saved at Medium, so existing sites and templates don't change; its *Full width* toggle becomes *Full* |

**Placement:** the four items join Phase 3 (+7 days, 57.5 → 64.5; total 412 → 419) and run before Phase 4, one per stream (B takes 3.19 then 3.20). At the measured pace of about 0.6, that is about 4 working days across the three streams, so Phase 3's 6 Nov and Phase 4's 13 Nov hold.
