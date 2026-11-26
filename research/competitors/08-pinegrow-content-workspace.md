# Pinegrow's Content Workspace and CMS Mode, against Content mode and the Blog

**Status:** ✅ Decided 2026-11-26: PG-16 to PG-18 adopted, all three for v1.1 ([§6](#6-decisions))
**Date:** 2026-11-26
**Question:** Pinegrow 10 has a Content Workspace and a "CMS Mode" for people who only update content. How do they compare with Webforge's Content mode and its Blog, and what should Webforge take from them?

**Short answer:** They solve different problems. Pinegrow is better at handing a finished site to someone else to keep up to date; Webforge is better at managing content. Pinegrow's "CMS" is a restricted way of editing static HTML: it has no blog, collections, tags or feed unless the site is a WordPress theme. Three things are worth weighing: changing repeating items in Content mode, a list of a page's content to edit from, and a latch that keeps a site in Content mode.

## 1. Method

- **Pinegrow:** its documentation pages for the Content Workspace (dated 1 Oct 2026), CMS Mode (2022), editable areas, components, master pages, Desktop and Online sync and publishing, the release notes for 10 and 10.1, and its sales pages, read on 26 Nov 2026. Nothing was run. The pages were read through a tool that summarises them, so the names of buttons and attributes are as it relayed them.
- **Webforge:** the [CMS note](../product/02-cms.md) and its decisions M1 to M5, the help pages (`the-editor.md`, `edit-panel.md`, `layers.md`, `find-and-replace.md`, `blog.md`, `ai-apps.md`), [ADR 0011](../../docs/adr/0011-layers-always-visible.md) and [ADR 0025](../../docs/adr/0025-collections.md), and the code named in [§3](#3-where-webforge-stands) on `main` of 26 Nov 2026. The app was not run.
- **Sizes** in [§5](#5-proposals) are first guesses. Each item needs its own `Implementation plan` before it is built.

**Confidence:** high for what the Content Workspace does. Medium for how a client gets access (Pinegrow Online's roles and the price of a client licence aren't documented), and for the sizes. Medium for one finding about Webforge, marked in [§3](#3-where-webforge-stands), which comes from the code and should be checked in the app.

**IP rule (unchanged from UI1):** we may copy interaction patterns and layout conventions. We never copy Pinegrow's code, CSS, icons, images, help text or wording.

## 2. What Pinegrow does

### 2.1 The Content Workspace

A workspace of three columns, new in Pinegrow 10, in the desktop app and in Pinegrow Online.

| Part                    | What it does                                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Outline**             | Everything on the page that holds content, found automatically and grouped as page information, header, main content and footer. A search box matches the names of fields and what they hold                 |
| **Field editor**        | The chosen item's fields. Typing changes the page as you type. Arrows step to the next and previous item                                                                                                     |
| **The page**            | Beside them. Clicking something on it opens its fields                                                                                                                                                       |
| **What can be changed** | Text of every kind, links (with types for an address, an email, a phone number and a place on the page), pictures and their alt text, the wording of forms, and the page's title, description and share tags |
| **Rich text**           | Bold, italic, underline, strikethrough, links and lists                                                                                                                                                      |
| **Pictures**            | Choose another, or crop and resize, which saves a new file                                                                                                                                                   |
| **Repeating items**     | Add, duplicate, reorder and remove, only where the designer has declared the items a collection. Other repeated items are changed one by one                                                                 |
| **What is left alone**  | Structure and styling. Adding or moving sections isn't part of it                                                                                                                                            |
| **Large pages**         | Past 250 fields, one section at a time                                                                                                                                                                       |

### 2.2 CMS Mode: handing the site to someone else

| Part                    | What it does                                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Who may change what** | Set field by field: only the designer (the default), the designer and editors, or nobody. A section or the whole page can be set at once                        |
| **Names and groups**    | A field can be renamed, so an editor reads "Opening hours" and not "Heading 2", and fields can be grouped                                                       |
| **For the project**     | Which tools editors get (adding elements, the AI assistant, publishing) and which pages they can open                                                           |
| **How an editor works** | In the desktop app started in CMS Mode, historically with a cheaper licence for that alone, or in the browser with Pinegrow Online, which is paid for each user |
| **Desktop and Online**  | Sent and fetched by hand, with a review first; one person edits at a time; a conflict is settled file by file                                                   |
| **Review**              | No approval step. The designer has [revisions and the before-and-after review](06-pinegrow-revisions.md)                                                        |
| **Limits it states**    | A field set to nobody can still be changed on the page. Pinegrow's own page puts the feature at sites of a few pages with one editor                            |

### 2.3 What its "CMS" is not

- **Static sites have no content as data:** no collections or kinds of content, no blog, no lists made from data, no design shared by every item, no tags, no pages of older posts, no feed and no search. A "collection" is a place on one page where items can be added and reordered.
- **Reuse** is by components and master pages. A change to one reaches its copies when the designer runs an update, which keeps only what was marked editable.
- **Content that comes from data** exists only when building a WordPress theme with Pinegrow's add-on, and then lives in WordPress.

## 3. Where Webforge stands

| Pinegrow                                         | Webforge today                                                                                                                                                                                                                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A way of working that changes content only       | ✅ **Content mode** (F-ED-10, M3): the same page, with layout and styles locked. Remembered with each site                                                                                                                                                                              |
| Nothing to set up for one's own use              | ✅ Nothing to set up at all: every text and picture can be changed, and everything else is locked                                                                                                                                                                                       |
| Text, links and pictures                         | ✅ On the page; the Edit panel shows only its Content tab                                                                                                                                                                                                                               |
| Page title and description beside the content    | ➖ In Page Settings, a dialog. An AI app may change them in Content mode (`ai-apps.md`); whether the owner's own Page Settings stays open there was not checked                                                                                                                         |
| Search across a page's content                   | ➕ **Find and Replace** searches the whole site: every page, the Header and Footer, shared sections, the blog's design and Site Settings                                                                                                                                                |
| An outline of the page                           | ➖ **Layers** lists sections and elements by kind, read-only in Content mode (ADR 0011). It is a list of the page's structure, not of its words                                                                                                                                         |
| Add, reorder and remove repeating items          | ❌ **Only a List's items**, from the code: the List toolbar is the one toolbar marked to show in Content mode (`ListToolbar.tsx`). A feature, a question, a team member or a price plan can't be added or removed there. M3 meant list items to be changeable. To be checked in the app |
| Values used in many places                       | ➕ Site Settings values bound into elements; a shared Header, Footer and shared sections that change everywhere at once, with no update to run                                                                                                                                          |
| Who may change what, field by field              | ❌ Not wanted so far: one owner, and M3 chose a plain switch with no lock                                                                                                                                                                                                               |
| Editing in a browser, and sending changes across | ❌ Out of scope: it needs a server (M5)                                                                                                                                                                                                                                                 |
| A blog, tags, a feed, lists of the newest posts  | ➕ Webforge has them (6.10a, 6.10b, ADR 0025); Pinegrow has none for a static site                                                                                                                                                                                                      |
| Review of what an editor changed                 | ➕ Undo History names each step; Version History, with PG-11 and PG-12 adopted, will say and show what changed                                                                                                                                                                          |

So Webforge is ahead on content itself, and level on changing words and pictures safely. It is behind in two places: changing the things a small business changes most (a new team member, a question, a price) without leaving Content mode, and handing the site to someone who must not break it.

## 4. What Webforge's design already allows

- **Every editable thing is already known.** A component declares its fields and their kinds (`text`, `richtext`, `media`, `link`), which is what Find and Replace and Site Check already walk. A list of a page's content is that walk, drawn as a list.
- **Children are declared too.** A slot says which elements it takes (`allow: ["Feature"]`), so "add another of these" needs no setting up, where Pinegrow needs the designer to declare a collection.
- **Content mode is one switch.** The canvas and panels read it in a handful of places, and one toolbar is already marked as showing in Content mode.

## 5. Proposals

| ID    | Proposal                                                                                                                                                                                                                                                                                                                                              | Why                                                                                                                                                                                 | Size                                                 |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| PG-16 | **Repeating items in Content mode.** Where a section holds one kind of item (a feature, a question, a team member, a price plan, a testimonial, a stat), Content mode lets the owner add one, duplicate, reorder and remove them, as it does a List's items. Everything else stays locked                                                             | These are the changes Content mode is for: a new member of staff, a new question, a price. Today they need Design mode, which unlocks everything. M3 already says list items change | About 2 days; proposed for Phase 5, decided for v1.1 |
| PG-17 | **A list of the page's content.** In Content mode, a **Content** panel lists what the page says, section by section: each text, picture and link, with the page's title and description first. Choosing one selects it on the page and opens it for editing; a box finds text on this page. It takes Layers' place in the left column in Content mode | Small text and things behind others are hard to click, and the page's title and description are in a dialog. One list makes "check everything this page says" a single pass         | About 4 days; v1.1                                   |
| PG-18 | **A latch on Content mode.** _Keep in Content Mode…_ asks for a few words to remember; leaving Content mode then asks for them. It says plainly that it stops accidents, not a determined person: the site is one file on a computer the other person is using                                                                                        | "Someone else updates prices or opening hours" is what the help page says Content mode is for, and nothing stops that person switching to Design. This revisits M3                  | About 1.5 days; v1.1                                 |

Not proposed:

- **Who may change what, field by field.** It is work for a designer with clients. An owner has no one to set it up for, and Content mode's one rule needs no explaining.
- **Names for fields.** Layers already takes a name for any element.
- **Editing in a browser, and a cheaper licence for editors.** Both need a server and accounts (M5, B2).
- **A workspace of fields in place of the page.** Webforge's owner edits on the page; PG-17 is a list beside it, not a form instead of it.

Lessons, with no scope:

- **"CMS" means two things.** For Pinegrow it is a safe way to edit; for Wix, Webflow and Webforge it is content kept as data. Webforge's pages should keep saying "blog" and "Content mode", and not "CMS".
- **Updates that must be run are a trap.** Pinegrow's components change their copies only when an update is run, and overwrite what wasn't marked editable. Shared sections that change at once are the better design; keep them so.

## 6. Decisions

Product owner, 2026-11-26: "Adopt all three but in 1.1". Recorded in `spec/02` §7 (item 69) and §5, and in the plan's list of v1.1 work that isn't yet items. PG-16 was proposed for Phase 5 and moves to v1.1 with the others, so Phase 5 gains no work and no issue is filed.

| ID    | Decision                                                                                                  |
| ----- | --------------------------------------------------------------------------------------------------------- |
| PG-16 | ✅ **v1.1:** repeating items in Content mode. About 2 days; an item when v1.1 is planned                  |
| PG-17 | ✅ **v1.1:** a list of the page's content, in a Content panel. About 4 days; an item when v1.1 is planned |
| PG-18 | ✅ **v1.1:** a latch on Content mode, amending M3. About 1.5 days; an item when v1.1 is planned           |

## Sources

- Pinegrow documentation, read 26 Nov 2026: [Content Workspace](https://docs.pinegrow.com/docs/master-pinegrow/content-workspace/), [CMS](https://docs.pinegrow.com/docs/pinegrow-pro/cms/), [editable areas](https://docs.pinegrow.com/docs/pinegrow-pro/editable-areas/), [components](https://docs.pinegrow.com/docs/pinegrow-pro/components/), [master pages](https://docs.pinegrow.com/docs/pinegrow-pro/master-pages/), [Desktop and Online sync](https://docs.pinegrow.com/docs/pinegrow-online/desktop-online-sync/), [publishing](https://docs.pinegrow.com/docs/master-pinegrow/publish/), the release notes for [10](https://docs.pinegrow.com/release_notes/pinegrow-web-editor-10/) and [10.1](https://docs.pinegrow.com/release_notes/pinegrow-web-editor-10-1/).
- Pinegrow's sales pages: [pinegrow.com](https://pinegrow.com/), [pinegrow.online](https://pinegrow.online/).
- [Pinegrow Web Editor: Competitor Review](02-pinegrow.md) (PG-1 to PG-9) and [Pinegrow's Revisions](06-pinegrow-revisions.md) (PG-10 to PG-15).
- Webforge: [CMS Features](../product/02-cms.md) (M1 to M5); `docs/help/the-editor.md`, `find-and-replace.md`, `blog.md`, `ai-apps.md`; `apps/desktop/src/renderer/editor/ListToolbar.tsx`.
