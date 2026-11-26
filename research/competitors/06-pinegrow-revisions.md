# Pinegrow's Revisions and change review, against Version History

**Status:** ✅ Decided 2026-11-26: PG-10 to PG-13 adopted, PG-10 and PG-11 in Phase 5 and PG-12 and PG-13 in v1.1 ([§7](#7-decisions))
**Date:** 2026-11-26
**Question:** Pinegrow 10 has a Revisions tab beside its undo history, with a review of what changed. Does Webforge want any of it, and how hard would it be to build?

**Short answer:** Webforge already has the Revisions tab: it is Version History (F-SITE-4, plan item 4.6). What Pinegrow adds is the review: seeing what changed between two versions, and restoring part of one. Four pieces of that are worth having, about 8 days in all, and Webforge's file format makes them easier than they were for Pinegrow.

## 1. Method

- **Pinegrow:** its documentation page _Visual change review and revisions_ (last updated 28 Sep 2026), read on 26 Nov 2026. Nothing was run: this note describes what the page says the feature does.
- **Webforge:** the help page `docs/help/version-history.md`, the MVP spec (F-SITE-4, F-PB-3), the [Pinegrow review](02-pinegrow.md) and its decision PG-4, and the code named in [§4](#4-what-webforges-code-already-allows) on `main` of 26 Nov 2026.
- **Sizes** in [§5](#5-proposals) come from reading that code, not from a plan. Each item needs its own `Implementation plan` before it is built.

**Confidence:** high for what Pinegrow offers and for what Webforge has. Medium for the sizes. Low for how well Pinegrow's element-by-element restore works in practice: its own page lists cases where it can only show a change, not restore it.

**IP rule (unchanged from UI1):** we may copy interaction patterns and layout conventions. We never copy Pinegrow's code, CSS, icons, images, help text or wording.

## 2. What Pinegrow does

A revision is a saved copy of the whole project, kept after the project closes. Pinegrow 9.1 added revisions; Pinegrow 10 added the review.

| Part                    | What it does                                                                                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The list**            | A tab beside the undo history, newest first. A row opens to show how many files were added, changed and deleted, and the most-changed files                                                              |
| **Saving**              | A button saves one; new ones get a numbered default name, and can be renamed. Optionally one is saved after a save, when a set time has passed (5 minutes by default)                                    |
| **Where they are kept** | In a folder outside the project, which can be moved                                                                                                                                                      |
| **Comparing**           | A window compares a revision with the one before it, with any other, or with the project as it is now. A list of changed files on one side; for each file, three views                                   |
| **View: source**        | The file's lines, removed and added                                                                                                                                                                      |
| **View: side by side**  | Both versions of the page drawn next to each other                                                                                                                                                       |
| **View: by element**    | A list of elements added, changed, moved or removed. Choosing one marks it on the page; a switch shows the whole page before or after                                                                    |
| **Restoring**           | One element, chosen files, or the whole revision. Restores of single elements are collected and applied together. Every restore saves a revision of the project as it is first                           |
| **Limits it states**    | Single elements can be restored only in pages that exist in both versions, and not where it can't match an element reliably, in embedded code or in page metadata. The page preview runs without scripts |
| **Other**               | Open a revision read-only in a window; copy one to a folder; compare the project with what was last published; changes an AI assistant made open in the same window                                      |

## 3. Where Webforge stands

| Pinegrow                                               | Webforge today                                                                                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Save a named revision                                  | ✅ _Save Version…_, Ctrl+Alt+S                                                                                                                                                       |
| Automatic revisions, on a timer                        | ✅ On events, each named after what happened: start of the day, before a change to every page, before a restore, on publish, before an AI app's changes. The last 20 kept (5 to 100) |
| Kept outside the project                               | ✅ Kept inside the site's file, so they travel with it                                                                                                                               |
| Open a revision read-only                              | ✅ _Preview_, in the browser                                                                                                                                                         |
| Restore a whole revision, saving the current one first | ✅ _Restore…_, and it is one step Undo takes back                                                                                                                                    |
| Copy a revision to a folder                            | ✅ _Open as New Site…_                                                                                                                                                               |
| Compare with what was published                        | ➕ Webforge goes further: _Republish…_ puts an earlier version on the web host (F-PB-3). It has no comparison                                                                        |
| Rename a revision                                      | ❌ A version keeps the name it was saved with                                                                                                                                        |
| What a revision changed, in the list                   | ❌ A row shows a name, a date and a small picture                                                                                                                                    |
| Both versions side by side                             | ❌ Adopted for v1.1 as PG-4 on 24 Oct 2026; not yet a plan item                                                                                                                      |
| A list of changed elements                             | ❌                                                                                                                                                                                   |
| Restore one element or chosen files                    | ❌                                                                                                                                                                                   |
| The source's changed lines                             | ❌ Not wanted: Webforge's owners don't read source                                                                                                                                   |

So the tab itself is not the gap. The gap is that an owner choosing a version to go back to has a name, a date and a thumbnail to go on, and can only take all of it or none.

## 4. What Webforge's code already allows

Pinegrow compares HTML files, so it has to work out which element in one file is which in the other. Webforge's versions hold the site's documents, which gives four things for little work.

- **A version knows which documents changed without reading them.** A version is a list of documents, each with an id, a kind and the hash of its content (`packages/storage/src/blob-reach.ts`, `VersionManifest`). Two versions differ in a page exactly when that page's hash differs, so "what changed" for a row in the list is a comparison of two short lists.
- **Restore already works part by part.** `restoreSite` (`packages/model/src/site-documents.ts`) replaces only the parts and pages that differ, inside one history step (`session.edit` in `apps/desktop/src/renderer/versions/version-actions.ts`). Restoring one page is the same step for one page.
- **A version's pictures are still there.** A file's content is kept while the working copy or any version uses it (`ProjectStore.blobsReachedBy`), so a page brought back from a version still finds its pictures' bytes.
- **The preview can already serve a version beside the current site.** `openVersion` in `apps/desktop/src/main/preview-ipc.ts` builds the version and serves it from the same local server as the current site's preview.

Two things the code does not give:

- **Built pages don't say which section is which.** The preview's HTML has no section ids, so marking a changed section on the drawn page needs the preview build to add a marker (never the export).
- **A page depends on parts it doesn't hold.** Its Media entries, the theme, and the shared header and footer are separate documents. A page restored alone is drawn with today's theme and header, and its pictures' Media entries may have been deleted since.

## 5. Proposals

### 5.1 Small, could join Phase 5

| ID    | Proposal                                                                                                                                                                                          | Why                                                                                                                                    | Size     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| PG-10 | **Rename a version.** _Rename…_ in a version's menu, for versions the owner saved and those Webforge saved                                                                                        | "Untitled version" and "Start of the day" can't be told apart a week later                                                             | 0.5 day  |
| PG-11 | **Say what a version changed.** Each row says how it differs from the site now, in the app's words: "Home and Contact changed, 1 page added, the theme changed". Nothing about elements or source | It is what an owner needs to pick the right version, and it costs a comparison of hashes ([§4](#4-what-webforges-code-already-allows)) | 1.5 days |

### 5.2 Larger, proposed for v1.1 with PG-4

| ID    | Proposal                                                                                                                                                                                                                                                                                                                | Why                                                                                                                | Size   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------ |
| PG-12 | **Before and after, for one page.** _Compare…_ opens the version's page and the page as it is now: side by side in a wide window, and with a _Before_ / _After_ switch in a narrow one. The pages that changed are listed, and the sections that changed are named and marked. This is PG-4 with its scope written down | PG-4 is already adopted; Pinegrow's switch shows how it fits a small window, which the fit rule needs at 960 × 600 | 4 days |
| PG-13 | **Restore one page.** From the comparison or a version's menu: the page goes back to how it was, in one step Undo takes back, after a _Before a restore_ version. A page deleted since comes back. The theme, header, footer and menu stay as they are now, and the dialog says so                                      | Restoring the whole site to get one page back loses everything done since                                          | 2 days |

A comparison with the live site needs nothing more than PG-12: the newest _Published_ version is already marked, so _Compare with the live site_ is the same window opened on it.

### 5.3 Not proposed

| ID    | What                                                        | Why not                                                                                                                                                                                                                  |
| ----- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PG-14 | **Restore one section or element**                          | Where it goes when the page's order has changed, and what happens to what replaced it, are questions an owner shouldn't have to answer. Pinegrow's own page lists what it can't restore. Look again once PG-13 is in use |
| PG-15 | **The source's changed lines**, and **versions on a timer** | Owners don't read source. Versions named after what happened ("Before: Delete Page") tell an owner more than numbered ones every five minutes, and 20 kept would last under two hours                                    |

### 5.4 Open questions for the plans

- **PG-11:** a deleted page's title is only in the version's own documents. Read them when a row is opened, not for every row.
- **PG-12:** whether the two pages are drawn inside the editor's window or opened in the browser as _Preview_ is. Inside the window needs the renderer's content security policy and sandbox checked first; that is the item's main risk.
- **PG-12:** the marker the preview adds to sections must never reach an exported site. A test of the export should say so.
- **PG-13:** a restored page's pictures need their Media entries back if they were deleted, and its address may now belong to another page.
- **All four:** the comparison is a new dialog, so it joins the fit test (CLAUDE.md, _Tests_), and `docs/help/version-history.md` changes with each.

## 6. What this would not change

- Versions stay inside the site's file, and automatic versions stay tied to events.
- Version History stays a tab beside Undo History: the same place Pinegrow puts its Revisions tab.
- AI apps' changes keep their own _Before app's changes_ version; approve-before-apply for AI edits stays a separate v1.1 item (WF-2).

## 7. Decisions

What the other competitors offer, and whether these decisions hold against it, is in [competitors/07](07-version-history-elsewhere.md).

Product owner, 2026-11-26: "Adopt all four". Recorded in `spec/02` §7 (item 67) and in the plan (`spec/04` §3, scope change of 26 Nov 2026).

| ID           | Decision                                                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| PG-10        | ✅ **Phase 5, out of plan:** rename a version. [#1484](https://github.com/nexustech/webforge/issues/1484), 0.5 day                                  |
| PG-11        | ✅ **Phase 5, out of plan:** each version says what it changed. [#1485](https://github.com/nexustech/webforge/issues/1485), 1.5 days                |
| PG-12        | ✅ **v1.1:** before and after for one page, as the scope of PG-4. About 4 days; an item when v1.1 is planned                                        |
| PG-13        | ✅ **v1.1:** restore one page. About 2 days; an item when v1.1 is planned                                                                           |
| PG-14, PG-15 | ➖ **Not proposed, not built:** restoring one section or element (look again once PG-13 is in use); the source's changed lines; versions on a timer |

## Sources

- Pinegrow documentation, [Visual change review and revisions](https://docs.pinegrow.com/docs/master-pinegrow/visual-change-review/), read 26 Nov 2026.
- [Pinegrow Web Editor: Competitor Review](02-pinegrow.md) (PG-1 to PG-9), 24 Oct 2026.
- Webforge: `docs/help/version-history.md`; `spec/02-mvp-spec.md` (F-SITE-4, F-PB-3); [ADR 0018](../../docs/adr/0018-publishing-from-a-version.md).
