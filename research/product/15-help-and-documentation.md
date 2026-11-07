# Help and documentation: pages now, in the app later

**Status:** ✅ Decided (HP-1…HP-9, §9, product owner, 7 Nov 2026: each as proposed; HP-10 the same day, when 5.4b started). The pages are in [`docs/help/`](../../docs/help/README.md). The decisions are recorded in `spec/02` §7, standards §8 and §9, CLAUDE.md and the plan (5.4a, 5.4b).

**The product owner's question (6 Nov 2026):** Webforge should have documentation for its key features. It should start as Markdown documents that are kept up to date, and later be readable from the UI. Which features should have help text, and what does Webforge offer today?

**Goal:** a small-business owner who is stuck finds the answer in the app, in the words the app uses, without going online. A developer who changes a feature can't forget to change its help.

## 1. Method

Read against `main` at `a43ea53b` (6 Nov 2026), and again at `713b0300` (7 Nov 2026) once Version History, publishing and AI apps had merged:
- **Strings:** every English UI string in `packages/i18n/src/en/`.
- **Code:** each renderer area in `apps/desktop/src/renderer/`, the menus and the shortcut table (`shell/shortcut-standard.ts`), and the catalogue (`packages/site-components/src/catalogue-data.json`).
- **Main and pipeline:** `apps/desktop/src/main/` and `packages/pipeline` for what export, preview, backups and publishing really do.
- **Specs and plan:** the specs, the glossary ([product/01](01-terminology.md)) and the plan items that mention help (1.35, 2.14b, 4.9, 5.4).

A feature counts as **available** only when a person can reach it in the app. Main-process code with no UI behind it doesn't count.

## 2. What exists today

- **Inline help text:** short hints under fields, empty-state lines, warnings and confirmations. There are a lot of them: every field kind takes a hint, and the strings are careful and use the glossary.
  - Examples: the hint under *Hide this page from search engines* (it explains how it differs from *Hide from navigation*); the Buy button's *Payment link*; the contrast warnings; Site Check's one-line verdicts.
  - This is the help people see most, and it's in good shape.
- **Help menu:** *About*, *Keyboard Shortcuts* (also the `?` key, a live sheet built from the shortcut registry) and *Open Crash Reports Folder*. On the start screen it also has *Try an Example*.
- **Start screen *Help* tab:** two entries, *Keyboard Shortcuts* and *Try an Example*. `start/help-items.ts` notes that a bundled guide arrives with 5.4.
- **No help pages or Help topics command.** Also no *Help for this element*: it moved to 5.4 on 23 Oct 2026, and the Layers and canvas right-click menu doesn't have it.
- **The plan:**
  - **5.4** (#79, 4 days, Phase 5) covers the first-run welcome and tour, "contextual help links", the shortcuts sheet (done already), "help content in glossary language" and *Help for this element*.
  - **4.9** asks for a help page on connecting AI apps.
  - **Engineering standards §9** says user help is "written in glossary language, stored with the app".

## 3. Three kinds of help

| Kind | What it is | Where it lives | State |
|---|---|---|---|
| **Inline help text** | Hints under fields, tooltips, empty states, warnings, confirmation text | `t()` strings in `packages/i18n` | Mature; gaps listed in §4 |
| **Help pages** | One page per feature: what it does, where it is, how to use it, what to watch for | `docs/help/*.md` | 28 pages written with this note (§5) |
| **Guided first run** | Welcome, a short tour (edit text → preview → publish, QS-8), first-time tips | Renderer, 5.4 | The welcome exists (2.14b); the tour is 5.4 |

The three link together. A hint answers "what is this field?". A page answers "how do I…?" and "why did that happen?". The tour shows the way through once. An inline hint can end with a link to its page (§7) instead of growing longer.

## 4. Which features need help text

**Every feature in the app gets a help page.** Inline help is where the gaps matter. The features below are ranked by how likely people are to get stuck; 15 and 16 merged after the first ranking and are added at the end. They're mostly where two things look alike, or where something happens outside the editor.

| # | Feature | Why people get stuck | Inline help today | Help page | Contextual link (§7) |
|---|---|---|---|---|---|
| 1 | **Forms and the form service** | A static site can't receive messages itself; people need a third-party account | Canvas hint, Site Check finding | [forms](../../docs/help/forms.md) | Form and Contact form's Content tab; Site Settings › Forms |
| 2 | **Export vs Save a Copy as ZIP** | Both make a ZIP; one is the website, one is the site | Toast after saving a copy | [export](../../docs/help/export.md), [saving-and-backups](../../docs/help/saving-and-backups.md) | Export dialog; File menu |
| 3 | **Publish destinations and publishing** | FTP, SFTP, folders and keys are new to most people; a publish can stop at Site Check, or fail on the host's side | Good field hints; test results; an error per failure that says what to do | [publish](../../docs/help/publish.md) | Publish dialog and destination dialog; *Your site is live* |
| 4 | **Different on each device** | Changes made on Mobile apply to Mobile only, and the dots mean nothing until explained | Dot tooltips | [edit-panel#different-on-each-device](../../docs/help/edit-panel.md#different-on-each-device) | Edit panel, device buttons |
| 5 | **Theme vs Template, and *your own version*** | Switching theme looks like it might lose content; a built-in theme forks on first change | Confirmation text | [themes](../../docs/help/themes.md), [templates](../../docs/help/templates.md) | Theme panel, Theme Studio, New Site |
| 6 | **Header, Footer and shared sections** | One edit changes many pages | Banner over the canvas | [header-and-footer](../../docs/help/header-and-footer.md) | The banner; *Save as shared section* dialog |
| 7 | **Design vs Content mode; Simple vs Advanced mode** | Two switches with similar effects (things disappear) | Tooltip on the switch; Settings hint | [the-editor](../../docs/help/the-editor.md) | The switch; Settings › Interface |
| 8 | **Site Check findings** | Each rule needs a "why it matters" and a "what to do" longer than one line | One-line verdicts, Fix buttons | [site-check](../../docs/help/site-check.md), one anchor per rule | Each rule's row |
| 9 | **Search engines** | Web address, sitemap, descriptions, *Hide from search engines*, verification codes, business type | Good hints and previews | [site-settings](../../docs/help/site-settings.md), [pages](../../docs/help/pages.md#page-settings) | Site Settings › Search engines; Page Settings |
| 10 | **Code trust** | A security question that interrupts Export and Preview | The dialog's own text | [custom-code#code-from-somewhere-else](../../docs/help/custom-code.md#code-from-somewhere-else) | The dialog |
| 11 | **Media: alt text, focal point, crop** | Alt text and focal points are unfamiliar words | Field hints | [media](../../docs/help/media.md) | Media details; image fields |
| 12 | **Preview on Phone** | Needs the same home or office network, and may fail on public Wi-Fi | Dialog text, error text | [preview](../../docs/help/preview.md) | The dialog |
| 13 | **Colours: Reversed, shades, contrast** | "Reversed" is a new idea | Field hint | [styling#colours](../../docs/help/styling.md#colours) | Colours field |
| 14 | **Backups and damaged files** | Only seen in a bad moment | Native dialog text | [saving-and-backups](../../docs/help/saving-and-backups.md) | Recovery dialog |
| 15 | **Undo vs Version History vs backups** | Three ways back that look alike, and versions {appName} saves by itself appear unasked | Restore's confirmation; the empty list's line | [version-history](../../docs/help/version-history.md) | Version History panel; Save Version dialog |
| 16 | **AI apps** | An address, a key shown once and an MCP setting in another app; what the app may change | The dialog's own text | [ai-apps](../../docs/help/ai-apps.md) | AI apps dialog |

**Gaps found on the way.** Each should be fixed in the app; the help page then only needs to reflect the fix.
- **Netlify Forms** can be chosen in Site Settings › Forms, but forms then show "Netlify Forms isn't ready yet". It should be offered only once the site has a Netlify destination, rather than explained in help: 4.4b ([#723](https://github.com/nexustech/webforge/issues/723)) already has that as an acceptance criterion.
- **The Layers lock icon** is drawn for locked items, but nothing locks an item yet (`editor/layers.ts`). Leave it out of the help until something does.
- **Two messages speak of publishing as if it works.** Page Settings' *Hide this page from search engines* hint mentions what happens "when you publish by FTP or SFTP", and the quick start's contact-details text says Site Check points out samples "before you publish". Both became true when 4.5's publish flow merged (7 Nov 2026), so this gap is closed.
- **A stale comment** in `layers/register-layers-panel.tsx` calls Layers "Advanced mode only", though it's registered in both modes (ADR 0011). It misled this note's fact-check; the comment should be corrected.
- **No Help topics entry** in the Help menu or the command box, so the pages can't be found from the app until 5.4 (§7).

## 5. The help pages

There are 28 pages in [`docs/help/`](../../docs/help/README.md), one for each feature or panel rather than one per screen. Each has a stable `id`, a `summary`, `related` pages, an `updated` date, and `components` listing the site component types it explains. *Help for this element* uses `components` to find a page.

- **Start here:** Getting started · Templates and example sites · The editor.
- **Building pages:**
  - Editing on the page · The Add panel · Sections · Elements · Layers
  - The Edit panel · Styling · Header, Footer and shared sections · Links · Pages and the menu.
- **Your site's look and content:** Themes, colours and fonts · Media · Forms · Site Settings.
- **Checking and going live:** Preview · Site Check · Export · Publish (`status: partial`: no Netlify yet).
- **Your work:** Undo and Undo History · Version History · Saving, copies and backups · Settings · Keyboard shortcuts · Custom Code · AI apps (`status: partial`: pairing by address and key only).
- **Still to write, each in the PR that ships the feature:** publishing a version again (4.6b), Netlify (4.4b), and connecting Claude Desktop through its extension (4.9).

Every Add-panel component type, child items included, appears in exactly one page's `components`, with a heading of its own: [sections](../../docs/help/sections.md), [elements](../../docs/help/elements.md), [header-and-footer](../../docs/help/header-and-footer.md) and [custom-code](../../docs/help/custom-code.md).

The README sets the writing rules:
- the glossary's words;
- `{appName}` for the app's name;
- labels quoted from the strings;
- Windows keys with the Mac's;
- only what `main` does;
- a strict Markdown subset with no raw HTML or images.

## 6. Keeping them current

Pages go stale quietly, so the checks have to be mechanical where they can be:
1. **The same PR.** A change people can see updates its help page in the same PR, and the page's `updated` date. This becomes:
   - a line in engineering standards §8 (Definition of Done), beside "User-facing text uses i18n keys";
   - a hard rule in CLAUDE.md.

   The PR's code review checks it.
2. **A check in `pnpm check`** (`pnpm help-check`, 5.4b). It fails when:
   - a page's front matter doesn't parse (zod);
   - an `id` is repeated or doesn't match its file;
   - a link or `#anchor` between pages doesn't resolve;
   - a catalogue component type is in no page's `components`, or in two;
   - a page spells out the app's name instead of `{appName}`;
   - raw HTML appears.

   It can't catch a page that's still valid but wrong. That's what 1 and 3 are for.
3. **Plan items say so.** From now on, a plan item that adds or changes a feature has "Help page added or updated" among its acceptance criteria. 4.4b, 4.5, 4.6a, 4.6b and 4.9 gain it now.
4. **A pass at each phase exit.** Pages whose `updated` date is older than the phase start are read against the app. The phase-exit checklist gains the line.
5. **The beta's questions.** Questions from the beta testers (5.7, 5.8) feed the pages: each question that a page should have answered gets a line or a page.

## 7. Into the app (5.4)

The pages are written so the app can show them as they are:
- **Bundled, offline.** The renderer imports `docs/help/*.md` at build time and validates the front matter with zod, so a bad page fails the build. The pages ship inside the app, and nothing is fetched (standards §9, C8's spirit).
- **A Help window:**
  - a contents list from the README's groups, and a search over titles, summaries and text (a small local index, MIT-licensed such as MiniSearch, or a plain substring search over 28 pages);
  - pages rendered from the strict Markdown subset by a permissive renderer with raw HTML off (marked or micromark, both MIT);
  - links between pages open in the window, and the rare outside link opens in the browser;
  - `{appName}` filled in by `template()`.
- **Ways in:**
  - **Help › {appName} Help** (F1) and **Search Commands…**, which lists help topics as a group.
  - The start screen's **Help** tab, which lists *Getting started*, *The editor* and *Keyboard shortcuts* above the existing entries.
  - **Help for this element** in the canvas and Layers right-click menu (UX-24), which opens the page whose `components` holds the selected type, at its heading.
  - A small **?** on:
    - the Edit panel's header;
    - each Settings section;
    - the Export, Publish, Page Settings, code trust and Preview on Phone dialogs;
    - each Site Check rule, opening `site-check#<rule>`.

    Each **?** links to a fixed page and anchor, kept in one table in the renderer that `help-check` validates.
- **Later, not in the MVP:** screenshots drawn by Playwright from the fixture site, so they never go stale; translations, which follow the glossary like the UI strings; a copy of the pages on a website.

## 8. Effort

- **This PR:** the 28 pages, this note, and the README. Docs only, so no plan days.
- **Phase 4:** about half a day spread across 4.4b, 4.5, 4.6a, 4.6b and 4.9, for their pages. Within their estimates.
- **5.4 grows**, and splits in two because it goes over 5 days (the Phase 2 rule):
  - **5.4a, Onboarding and tour** (4 days, unchanged): the first-run tour, first-time tips, and the usability test.
  - **5.4b, Help in the app** (2.5 days, new; 3.5 days with HP-10):
    - the bundled pages and the Help window with search (1.5 days; 2.5 days as a window of its own, HP-10);
    - the ways in, including *Help for this element* (0.5 day);
    - `pnpm help-check` (0.5 day).

  Phase 5: +2.5 days.

## 9. Decisions

Decided by the product owner on 7 Nov 2026, each as proposed.

| ID | Decision |
|---|---|
| HP-1 | **Three kinds of help:** inline help text (`t()` strings), help pages (Markdown) and a guided first run. Each has its own job (§3) |
| HP-2 | **Help pages live in `docs/help/`** as Markdown with the front matter in §5, one page per feature or panel, written for the small-business owner in the glossary's words, with `{appName}` for the app's name. The README holds the writing rules |
| HP-3 | **The pages describe only what `main` does.** Partly built features say what works today in a line. The pages are merged now (this PR) and kept current from here on |
| HP-4 | **Same-PR rule:** a change people can see updates its help page in the same PR (standards §8, CLAUDE.md); plan items that change features list it in their acceptance criteria |
| HP-5 | **`pnpm help-check`** in `pnpm check` (§6, 2), built in 5.4b |
| HP-6 | **Help in the app, offline:** bundled at build, a Help window with search, and the ways in listed in §7, *Help for this element* among them. No online help in the MVP |
| HP-7 | **5.4 splits** into 5.4a *Onboarding and tour* (4 days) and 5.4b *Help in the app* (2.5 days, new): Phase 5 +2.5 days |
| HP-8 | **Fix the gaps in the app, not in help:** Netlify Forms is offered only once the site has a Netlify destination, which 4.4b's acceptance criteria already require (#723). The Layers lock icon stays out of help until something locks |
| HP-9 | **A help review at each phase exit,** and beta testers' questions feed the pages (§6, 4–5) |
| HP-10 | **The Help window is a separate window beside the editor** (product owner, 7 Nov 2026), so the owner can read and work at once: +1 day for 5.4b, which becomes 3.5 days |

The changes, following CLAUDE.md's *Working the plan*:
- a line in `spec/02` §7 and in standards §8 and §9;
- 5.4's five places, and a new 5.4b in all five;
- acceptance-criteria lines on #723, #73, #74, #724 and #171;
- no separate Netlify Forms issue: 4.4b (#723) covers it.
