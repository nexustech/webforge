# 0025. Collections: an item is a page, wrapped in its collection's shared design

- Status: Accepted (M2-1, product owner, 2026-11-10)
- Date: 2026-11-10
- Related: M2-1 in [product/02](../../research/product/02-cms.md#decisions-2026-10-19), 6.10a (#874), 6.10b (#875), M2 and its sketch in [product/02](../../research/product/02-cms.md), BS9-3 and its design note (§5) in [bootstrap-studio/06](../../research/bootstrap-studio/06-bootstrap-studio-9.md), [ADR 0012](0012-site-format-migrations.md), [ADR 0003](0003-wforge-sqlite-storage.md), 1.17 (Site Settings bindings), 6.1 (kept addresses), 6.3 (draft pages)

## Context

M2, as amended by BS9-3, builds the Blog on a general collections engine, so that Portfolio, Team, Events and Menus can follow as presets. The engine needs:

- custom fields;
- a page per item;
- a design shared by every item's page, with its elements bound to the item's fields;
- lists of items (6.10b's _Latest posts_, pagination and tag pages);
- importing items (6.10b).

People still choose "Blog", never "collection".

Product/02 sketched items as data: a Collections panel listing them like a spreadsheet, a form to edit each one with its body as a rich-text field, and one item page design edited on the canvas. That design brings costs:

- **A rich-text editor in a form.** Today rich text is only ever edited on the canvas.
- **A canvas mode for something that isn't a page.** The editor shows and selects pages only (`EditorSelection.pageId`).
- **A second export path.** Pages generated from data would need their own way through the pipeline.
- **Things to rebuild for items:** drafts (6.3), kept addresses (6.1), the sitemap, Site Check and the AI apps' page commands, all of which pages already have.
- **Writing in a form.** The owner writes the post's text in a form and sees it only on a preview, which is unlike the rest of Webforge.

## Decision

**An item is a page that belongs to a collection. Its own content is its body, which the owner writes on the canvas. The collection's design is shared: it is drawn above and below every item's body, with elements bound to the item's fields.** It works the way the shared Header and Footer already do.

1. **A collection** is a new part of the site, `collections: Record<CollectionId, Collection>`, stored as one document, `collections`, like `sharedSections`. A collection has:
   - `id` and `preset` (`"blog"`; later `"portfolio"`, `"team"`, `"events"` or `"menu"`);
   - `name` ("Blog"), the Pages panel group's heading and undo labels' name for it (renaming it comes later);
   - `folder`: where its items' pages go (`blog`, so `blog/spring-opening.html`);
   - `fields`: the item's own fields beyond the title, each with a name, a label and a kind (`date`, `text` or `image`; more kinds when a preset needs them). The blog's are `date`, `summary` and `picture`.
   - `design: { before: NodeDoc[]; after: NodeDoc[] }`: the elements drawn above and below each item's body.

   The preset names the defaults: its fields, its starting design and its folder. **A preset adds no code paths,** so Portfolio is another preset, not another engine.

2. **An item is a page** with two optional fields:
   - `collection`: its collection's id;
   - `entry`: its field values, checked against the collection's fields. A value that doesn't fit reads as empty, as any invalid value does (ADR 0012, decision 2).

   The item's title is the page's title, and its address is the page's slug in the collection's folder. Everything a page has works unchanged:
   - drafts (6.3); undo, autosave and versions, document by document;
   - renaming with its old address kept (6.1); the sitemap;
   - Site Check; the AI apps' page commands.

   `siteIssues` checks four things:
   - an item's collection exists;
   - its folder is its collection's;
   - collection folders don't collide with one another;
   - the home page and the not-found page are never items.

3. **Binding to an item's field** extends Site Settings' bindings (1.17), one mechanism as BS9-3's note asks.
   - **In a text element,** `props.bindings` gains `item.<field>` values beside the Site Settings keys, plus `item.title`.
   - **In a Text element,** its rich text can show a text or date field the same way (`item.summary`), as a paragraph.
   - **In an image field,** the same `bindings` entry can name an image field (`item.picture`). An image field can't be bound today.
   - **Where it resolves:** `RenderContext` gains `item(field)`. The canvas gets the shown item's values; the export gets each page's.
   - **Where it isn't an item:** on a page that isn't one (a design element pasted onto an ordinary page), a binding to an item field shows the element's own text.
   - **Dates:** a bound date is written in the site's language (`10 November 2026`), in a `<time datetime>` element.

4. **The canvas** draws an item as Header, design `before`, the item's content, design `after`, then Footer.
   - The design's elements are edited in place, with a banner like the Header's: _"This is the blog's design: changes show on every post."_
   - Edits go to `draft.collections[id].design`, as edits to the Header go to `draft.layout`.
   - The design's top-level sections are locked, as the Header's are. Deleting an element from it asks first, saying every post shows the change (D7).
   - A page that hides the Header or Footer still shows the design.

5. **The export and Preview** compose the same thing. `siteToSnapshot` expands the design into each item's page and fills in its bindings, as it expands shared copies today. The pipeline gains no new kind of page.
   - **Output:** `blog/<slug>.html`, at the item's path, with `pagePrefix` giving its links one `../`.
   - **Drafts** are left out by `publishedSite`, as any draft page is.
   - **Sharing:** a post's picture is its share image, unless its Page Settings choose another.
   - **The menu:** posts are never added to it by themselves, as the Blog lists them; a menu that follows the pages leaves them out.

6. **The Pages panel** shows each collection as a group headed by its name, listing its items newest first by date, with **New post** (the preset names it).
   - **Add page** gains **Blog**, which:
     - adds the collection with its preset;
     - adds a first post to show it;
     - shows that post.
   - **Item settings:** Page Settings for an item shows the collection's fields first, after its title (**Date**, **Summary**, **Picture**). Its folder is the collection's: an item can't be moved to another folder, made the Home page or reordered by hand, and a duplicate is another item.
   - **One Blog per site** is offered for now; the engine allows more.
   - **Undo labels:** each change is one step with its own label, such as _"Added post 'Spring opening'"_, _"Edited post 'Spring opening'"_ or _"Edited the blog's design"_.

7. **Format 13** adds `collections: {}` to every site, with a migration step, a fixture and the inverse in `migrations.test.ts`. The new optional page fields need no bump of their own (ADR 0012, decision 1), but they ride on this one.
   - The storage document kinds gain `collections`.
   - `validateSiteChanges` gains its branch.
   - The clipboard's carrier (ADR 0012, its consequences) gets an empty `collections`.

8. **What 6.10a doesn't do** (6.10b, then later presets):
   - a list of items on a page (_Latest posts_, the blog's own page with pagination), and tags with a page each;
   - the RSS feed;
   - importing Markdown or CSV;
   - Site Check's rules for posts.

   **Lists of items** will be a section bound to a collection, rendered from its published items at build time, so the export stays flat HTML with no scripts (X1). The section reads items through one function, `collectionItems(site, id)`, that gives each item's title, field values and address, if it has one, never its page. That keeps it working for the item-only collections in decision 9.

9. **Items without a page of their own are a later, separate kind.** A dish on a menu or a member of a team is a card in a list, not a page.
   - **What 6.10a builds:** an engine shaped for blogs, portfolios and events, whose items are pages.
   - **What Menus and Team get later:** a collection with `pages: false` holds its items in the collection document itself, as `items: { id, title, entry }[]`.
     - They're edited in a form under the collection's group in the Pages panel.
     - They have no slug, no page and no sitemap entry.
     - They're drawn only by list sections, through the same `collectionItems`.
   - **Why not a page marked as having none?** It would put things in the Pages panel that aren't pages, give them slugs, settings and Header options that mean nothing, and make every reader of pages skip them. The form only needs plain fields (text, date, picture, a price, a short description), not rich text.
   - **Until then,** a menu or a team is a section's repeating list (F-ED-6), as today. BS9's design note keeps those lists plain data, so a later step can turn one into a collection.

## Consequences

- **What items get for free.** Collections cost a part, two page fields, a binding kind and a canvas composition. They don't need a second editor, a form with rich text or a second export path. Drafts, kept addresses, versions, the sitemap, Site Check and the AI apps work for items because items are pages.
- **The design is shared.** Changing the blog's design changes every post, as BS9-3 wants. A post's own layout can still differ in its body: a gallery in one post, a video in another.
- **Writing on the canvas.** Writing a post is writing a page, on the canvas, in the way the person already knows. There is no spreadsheet view; the Pages panel's group is the list, and 6.10b's import fills it in bulk.
- **Page count.** A site with many posts has many pages. Opening a site, the history and the commit already scale by page (one document each; ADR 0022's benchmarks). A blog of a few hundred posts is within what the benchmarks measure.
- **Two kinds of collection, one list.** The kind whose items are pages comes first: 6.10a builds it with the Blog, and Portfolio and Events are later presets of it. Collections whose items are only data (Menus, Team; spec/02 names both as presets) are a separate, later kind, with its own small form (decision 9). Both feed the same list section, so 6.10b's sections and tag pages don't depend on which kind they show. Until the second kind lands, Menus and Team stay as sections with repeating lists. spec/02 §5 says which presets come with 6.10a (the Blog) and which wait for the item-only kind (Team, Menus).
- **Format 13.** An older build opens a format 13 site read-only (ADR 0012), so it never writes a site whose collections it doesn't know.
