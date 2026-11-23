# Trial: Webforge's own website, built with Claude Code

Can Webforge, driven by Claude Code through [AI apps](../help/ai-apps.md), build Webforge's own website? This is the plan for trying it, and for writing down where it is hard. The friction found is the result, as much as the site.

**Who runs it:** the product owner.
**Where:** any computer with Webforge and Claude Code. Someone has to be there at the start and the end: only a person can choose pictures, set the logo and turn on **Work without asking**.
**How long:** half a day, pictures included.
**Issue:** [#1230](https://github.com/nexustech/webforge/issues/1230): post the log there.

**Runs so far:**

| Run | Date       | Build                             | Log                                                                                           |
| --- | ---------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | 2026-11-21 | 0.2.0, `main` of 20 Nov, macOS    | [#1230, first comment](https://github.com/nexustech/webforge/issues/1230): 24 rows, 10 issues |
| 2   | to be run  | 0.3.0 or newer, `main` of the day | a new comment on #1230                                                                        |

Run 2 checks what changed since run 1 ([§5](#5-what-changed-since-run-1)) and tries leaving Claude Code to work alone. The gaps that still stand are in [§7](#7-known-gaps). Proposals behind them: [running AI apps unattended](../../research/product/19-ai-apps-unattended.md) (UA-1…UA-6) and [the Header and Footer](../../research/product/20-header-and-footer.md) (HF-1…HF-7).

## 1. The site

Five pages, in English, on a template close to a product site (choose in **Start a Site**; none is made for software).

| Page         | What it holds                                                                                                                                                                     | Sections to use                              | Where the content comes from                                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Home**     | What Webforge is in one line, a screenshot of the editor, three or four reasons to choose it, a button to Download                                                                | Hero, Features, Text + Image, Call to action | [MVP spec](../../spec/02-mvp-spec.md) §1; the product in one line in `CLAUDE.md`                                                                             |
| **Features** | The core features, each with a screenshot: templates and Start a Site, editing on the page, themes, Site Check, export and publish, AI apps                                       | Text + Image (several), Features, Gallery    | The help pages in [`docs/help/`](../help/README.md)                                                                                                          |
| **Compare**  | Webforge beside the hosted builders and the desktop tools, at a high level: who owns the site, what it costs over three years, whether it works offline, where the site is hosted | Text, Table, FAQ                             | [Where Webforge stands](../../research/competitors/03-comparison-2026-11.md), [What the competitors charge](../../research/product/10-competitor-pricing.md) |
| **Pricing**  | One licence, US $99, unlimited sites, a 7-day trial; what is included; questions                                                                                                  | Pricing (one plan), FAQ                      | [MVP spec §8](../../spec/02-mvp-spec.md#8-business--licensing-model-decided-2026-10-19)                                                                      |
| **Download** | A button each for Windows and macOS, and what the computer needs                                                                                                                  | Text, Call to action                         | [`docs/releasing.md`](../releasing.md)                                                                                                                       |

**Download buttons go nowhere yet.** Every "Download" button elsewhere links to the Download page. On the Download page itself, leave the two buttons without a link and note what Webforge and Site Check make of that (see the log, row 4). Since run 1, the export leaves a button with no link out of the page ([#1256](https://github.com/nexustech/webforge/issues/1256)).

**Selling starts at v1.1.** The price and the trial are facts from the spec, but not yet on sale: the site says "coming with v1.1", not "buy now". Run 1's site presented them as available now.

**Comparison rules.** Name competitors by what they are and what they charge, with the month the price was read. No competitor's logo, screenshot or wording.

## 2. Before you start

1. **Webforge:** `main` as it is on the day (`pnpm install`, then `pnpm dev`), or the newest build (0.3.0 or newer). Write down the commit or version.
2. **Claude Code:** installed and signed in.
3. **Pictures, in one folder,** as PNG or JPEG:
   - the logo (from `apps/desktop/branding`);
   - six screenshots of the editor at 1600×1000 or larger, in the dark or the light look, not both: the start screen with the templates; a page being edited with the Edit panel open; Theme Studio; Site Check with findings; the Preview on Desktop and Mobile; the Export or Publish dialog.

   Take them from a site made from a template, not from a real customer's. Run 1's were taken with a temporary Playwright script against the built app; that still works.
4. **A folder for the exported site,** outside the repository.

## 3. Connecting Claude Code

Follow [AI apps › Claude Code](../help/ai-apps.md#claude-code): **File › AI Apps…** (also on the start screen), tick **Let AI apps connect**, **Add AI App**, **Claude Code**, then the three steps Webforge shows, each with its own copy button: the add command, the key command and the key. Start Claude Code in that terminal within 5 minutes. Webforge says when it connects, and `/mcp` lists `webforge` as connected.

Start Claude Code in the repository's folder, so it can read the spec, the help pages and the research notes for the content.

## 4. The steps

Give Claude Code one step at a time. After each, note what happened in the log, with the time: run 1 kept no clock, so record start and end times this time.

1. **Start the site.** "Start a new site in Webforge for Webforge itself: a desktop website builder for small-business owners. Pages: Home, Features, Compare, Pricing, Download. Read `spec/02-mvp-spec.md` §1 and §8 first." Check **Start a Site**, then **Create Site**.
2. **Let it work alone.** In **AI Apps**, under Claude Code, set **Work without asking** to 2 hours. From here to step 7, leave Webforge in the background or step away, and come back at the end of each step.
3. **Build the pages.** "Build out the five pages as one plan. Take the features from `docs/help/`, the comparison from `research/competitors/03-comparison-2026-11.md` and `research/product/10-competitor-pricing.md`, and the price from the MVP spec §8. The price isn't on sale until v1.1: say so. Invent no facts, customers or quotes. Every Download button links to the Download page; the two buttons on the Download page have no link." When you come back, read **While You Were Away**, then **Keep**.
4. **Pictures.** "Ask me for the logo and six screenshots, then place each where it belongs, with a description for people who can't see it." Choose them in **Add Files…**: the question waits for you. Then set the logo yourself in **Site Settings › Logo**: an app can't.
5. **Theme.** "Set the theme's colours to match the logo, and check the contrast." Ask for the look in [§9](#9-the-look-to-aim-for).
6. **Header and Footer.** "Show the logo in the Header in place of the name. Give the Header its own button, Download, linking to the Download page, and hide Download in the menu. Make the Footer columns: the logo and a line about Webforge, then the product's pages, then the help and the licence." Note what you wanted here and couldn't have.
7. **Check.** "Run Site Check and fix what you can. List what is left for me." Read **Examples to check** yourself: correct each, or click **This Is Correct**.
8. **Look.** "Open the Preview." Look at every page on Desktop and Mobile.
9. **Export** yourself (**File › Export…**) to the folder from §2, and open `index.html` from disk.

If something goes wrong while you're away, try **Undo All of** the app's **Changes** in While You Were Away, then **Undo** to bring them back, and log how it went.

## 5. What changed since run 1

Each row of run 1's log that became work, and what to check now. Note in the log whether it holds.

| Run 1 row  | Fixed by                                                   | Check in run 2                                                                                       |
| ---------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 4, 5, 21   | [#1249](https://github.com/nexustech/webforge/issues/1249) | Step 3 is one plan, with each section's items set as it's added, and no sample items left            |
| 6          | [#1250](https://github.com/nexustech/webforge/issues/1250) | `components` and `fields` answer briefly, with the style fields on request                           |
| 7          | [#1251](https://github.com/nexustech/webforge/issues/1251) | An icon name that doesn't exist is refused                                                           |
| 9          | [#1252](https://github.com/nexustech/webforge/issues/1252) | Step 4 takes one ask: `requestMedia` answers _waiting_ while Add Files is open, then gives the files |
| 13         | [#1253](https://github.com/nexustech/webforge/issues/1253) | A contrast finding from `runSiteCheck` names its colours and ratio                                   |
| 20         | [#1254](https://github.com/nexustech/webforge/issues/1254) | Start a Site leaves no sample email or phone, and Site Check lists any left                          |
| 22         | [#1255](https://github.com/nexustech/webforge/issues/1255) | `openPreview` answers with the Preview's address                                                     |
| plan row 4 | [#1256](https://github.com/nexustech/webforge/issues/1256) | The Download page's buttons with no link are left out of the export. Is that what you want there?    |
| 15         | [#1257](https://github.com/nexustech/webforge/issues/1257) | Reversed Call to action bands take the reversed colours on the dark theme                            |
| 23         | [#1258](https://github.com/nexustech/webforge/issues/1258) | The comparison table stacks readably on a phone with an empty first heading                          |
| 11, 17, 18 | 5.37–5.39 (HF-1, HF-2, HF-4)                               | Step 6: the logo in the Header, its own button, Footer columns                                       |
| plan row 1 | 5.34–5.36 (UA-1…UA-3)                                      | Steps 2–3: questions wait, Work without asking, While You Were Away                                  |
| plan row 6 | [#1228](https://github.com/nexustech/webforge/issues/1228) | Facts the app made up, such as "buy now", are marked as examples and listed in Site Check            |

Run 1's rows with no issue (1, 2, 3, 8, 12, 14, 19, 24) may show again: note them only if they changed.

## 6. The log

One row for each thing that slowed you down, surprised you or couldn't be done. Copy this table into a new comment on the issue, headed _Run 2_.

| #   | Step | What happened | What you expected | How bad (blocked / slow / cosmetic) |
| --- | ---- | ------------- | ----------------- | ----------------------------------- |
| 1   |      |               |                   |                                     |

Rows to fill in whatever else happens:

1. How many questions Webforge asked before you set **Work without asking**, and which still asked after (payment links, contact details).
2. While You Were Away: whether it listed every change, and whether **Undo All** and **Undo** did what they said.
3. Pictures: how many times you were asked, and whether each landed in the right place.
4. A button with no link: what the editor, Site Check and the exported page do with it.
5. Anything Claude Code asked for that AI apps has no tool for.
6. Anything it wrote that isn't true of Webforge, and whether **Examples to check** caught it.
7. The whole trial's time, and how much of it was yours.
8. Each row of [§5](#5-what-changed-since-run-1): holds, or doesn't.

## 7. Known gaps

Gaps that still stand, read from the code and the help pages on 2026-11-23.

| #   | Gap                                                                                                                                                                              | What to do in the trial                 | Proposal                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------- |
| 1   | **Some changes always ask,** even while the app works without asking: where visitors' money or details go, contact details, the web address, search engines, and starting a site | Come back to answer; the question waits | none: decided (S18, UA-2)        |
| 2   | **Pictures need you each time.** An app can't add a file; it asks, and you choose in **Add Files…**                                                                              | Have the folder ready                   | UA-4, not taken for now          |
| 3   | **The logo needs you.** An app can't set Site Settings' **Logo**, so the Header can't show it until you do                                                                       | Set it yourself in step 4               | none                             |
| 4   | **No export or publish for an app**                                                                                                                                              | Export yourself                         | UA-5, not taken for now          |
| 5   | **No see-through Header, no bottom line in the Footer**                                                                                                                          | Do without; note it                     | HF-6 and HF-5, not taken for now |
| 6   | **No template for a software product**                                                                                                                                           | Choose the nearest                      | none                             |
| 7   | **No Custom Code or stylesheet for an app**                                                                                                                                      | Do without                              | none: decided (F-AI-1)           |
| 8   | **No set of screenshots of the editor** kept for marketing                                                                                                                       | Take the six in §2                      | none                             |

Closed since run 1: questions running out after 60 seconds (UA-1), no unattended work (UA-2, UA-3), no logo or element in the Header and Footer (HF-1, HF-2, HF-4), and `href="#"` for a button with no link (#1256).

## 8. Done when

- the exported site opens from disk, with all five pages, its pictures, the logo in the Header and working links between pages;
- Site Check shows no _Must fix_ other than what the missing download links cause, and no **Examples to check** left;
- the log is on the issue, with each row of §5 marked, and each new row that should become work has an issue of its own or a line saying why not.

## 9. The look to aim for

The product owner's reference, 2026-11-20: [pixelcrew.ai](https://pixelcrew.ai), for its look and feel, not to copy. Looked at in a browser that day; nothing of its code, pictures or wording is used.

**What makes that look:** one long page on black, off-white text and a single bright accent (used only for the main button, the highlighted plan and small marks); a very large, tight headline in a plain geometric sans; small labels, tags and file names in a monospaced font; thin borders and rounded corners on dark cards in place of shadows; a framed screenshot of the product under the headline; a fixed, see-through Header with a logo, five links and one button; and a Footer of labelled columns with a line below. No gradients and no animation.

| #   | Part of the look                                                                  | Webforge today                                                                                                                                                         | Gap                                                                                |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | Black page, one accent, thin borders, no shadows                                  | ✅ The Dark theme, with Brand, Surface, **Card style**, **Border width** and **Shadows** set in the theme                                                              | Run 1: borders barely show on black, and white fails on the logo's orange (row 14) |
| 2   | Headline about 100 px, letters set tight                                          | 🟡 **Text sizes** and **letter spacing** for headings are theme settings                                                                                               | Run 1: the largest is `6xl`, spacing has three steps (row 12)                      |
| 3   | A plain geometric sans, with a monospaced font for labels                         | 🟡 Inter, Manrope and Figtree come with Webforge, and JetBrains Mono can be the theme's **Accent** font. Geist isn't among the fifty; **Browse All Fonts** may have it | none if a near font will do                                                        |
| 4   | Small label above a title ("How it works")                                        | ❌ sections have a title and a text, no label above                                                                                                                    | **a label above a section's title** (DP-1)                                         |
| 5   | Tags and status marks ("SaaS · Web app", "Runs second")                           | ❌ no tag or badge element; only Pricing's badge                                                                                                                       | **a Tag element** (DP-2)                                                           |
| 6   | Header: logo, menu, one button, see-through and blurred                           | 🟡 fixed Header with a logo, its own button and a style change on scroll; no see-through or blur                                                                       | HF-6 or a _Blurred_ scroll style                                                   |
| 7   | A framed screenshot under a centred headline                                      | ✅ Hero, _Centred, image below_; the image takes a border and corners                                                                                                  | none expected                                                                      |
| 8   | Cards of uneven size holding mixed content (a tall card beside two short ones)    | 🟡 Columns hold elements; Features has _Cards_                                                                                                                         | whether a column can be a card, and columns uneven: try it (not tried in run 1)    |
| 9   | A heading that stays put while a numbered list scrolls beside it                  | 🟡 Steps, _Numbered_ or _Timeline_                                                                                                                                     | **the text beside, staying in view** (DP-3)                                        |
| 10  | Showcase cards: a large picture beside a title, text and tags, in a bordered card | 🟡 Text + Image, left or right                                                                                                                                         | a card frame around it, and tags (row 5)                                           |
| 11  | Three plans, one outlined in the accent                                           | ✅ Pricing, _Cards_, **Highlight this plan**                                                                                                                           | none: run 1 found it an accent border                                              |
| 12  | Footer: logo and line, three labelled columns of links, a bottom line             | 🟡 up to four columns of elements (a heading, text, an image, menu links), with **Start from**; no bottom line                                                         | HF-5 (not taken) is the bottom line                                                |
| 13  | One page, the menu jumping to its sections                                        | ✅ one-page sites, with the section in view highlighted                                                                                                                | none; but §1 plans five pages: choose one                                          |

**Three gaps that no adopted proposal covers:** the label above a title (4), the Tag element (5) and Steps with its text staying in view (9). They are proposals DP-1 to DP-3 in [Three small parts of a designed page](../../research/product/21-designed-page-parts.md), deferred to v1.1 or later, so the trial does without them.

**For the trial:** ask Claude Code for this look in step 5 ("black Surface, off-white text, one bright Brand colour, thin borders, no shadows, a monospaced Accent font"), and record rows 6, 8 and 12 in the log.
