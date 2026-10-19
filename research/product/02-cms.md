# CMS Features

**Status:** ✅ Scope agreed 2026-10-19 (decisions M1–M5)
**Context:**
- **Users:** DIY small-business owners (T1)
- **Output:** static flat HTML, no server, works from disk (X1)
- **Apps:** desktop app, single `.wforge` file (06)
- **Already decided:** click-to-edit text (Tiptap via Puck), Site Settings values bound into elements (X3), shared Header/Footer (C5)

**"CMS" for Webforge means:** managing *content* (text, images, lists of things, posts) separately from *layout*, so it's quick and safe to update. Everything is still generated into static pages at export/publish.

## What competitors offer

| Feature | Wix | Squarespace | Webflow | Bootstrap Studio | Canva / Google Sites / Adobe Express |
|---|---|---|---|---|---|
| Click-to-edit on page | ✅ | ✅ | ✅ (Editor) | ✅ | ✅ |
| **Collections** (lists of structured items) | ✅ **CMS Collections** with Items and Fields | ✅ Collection pages: **Blog, Events, Portfolio, Store** | ✅ **CMS Collections**, Collection lists | ✅ Blog: Collections, Authors, Tags ("Reflow") | ❌ |
| **List page + item page** generated from one design | ✅ Dynamic list / item pages | ✅ (per collection type) | ✅ Collection template pages | ✅ | ❌ |
| Blog with tags, RSS | ✅ (Wix Blog app) | ✅ | ✅ (via collections) | ✅ | ❌ |
| Content-only editor for clients | ✅ Roles & permissions | ✅ Contributors | ✅ Editor (content-only) | ❌ | Sharing |
| Visitor-submitted content, members | ✅ (server) | ✅ (server) | ⚠️ | ❌ | ❌ |
| Store / checkout | ✅ | ✅ | ✅ | ⚠️ Via third parties | ❌ |
| Site search | ✅ | ✅ | ✅ | ❌ | ❌ |

Wix, Squarespace and Webflow do the dynamic parts on their servers. **Webforge has no server, so anything dynamic must be generated at export time or run in the browser.**

## Static-friendly CMS features (what Webforge can do)

| Feature | How it works without a server | Complexity | Value for small businesses |
|---|---|---|---|
| **1. Click-to-edit text & images** | Already designed (Puck + Tiptap) | ✅ Done in design | ⭐⭐⭐ |
| **2. Content mode** ("Edit content only") | Toggle that locks layout, sections and styles; only text, images, links and list items are editable. Prevents accidental layout breakage | Low | ⭐⭐⭐ Safe quick updates ("change opening hours") |
| **3. Repeating lists inside sections** | Testimonials, team members, services, FAQs, opening hours, price lists as **editable lists** inside a section (Puck array fields): add, reorder, remove items | Low (Puck supports it) | ⭐⭐⭐ Covers most small-business "content" without full collections |
| **4. Site-wide values** | Business name, phone, address, social links from Site Settings bound into elements (X3). Edit once, changes everywhere | ✅ Done in design | ⭐⭐⭐ |
| **5. Collections** (Blog first) | Structured items stored in the `.wforge` file (title, date, image, rich text, tags…). At export: a **list page** (`blog.html`, paginated `blog-2.html`), an **item page per item** (`blog/my-first-post.html`), tag pages, an RSS feed (`blog/feed.xml`) | Medium–High | ⭐⭐ Blogs/news are common; also Events, Portfolio, Products (catalogue) |
| **6. "Latest items" sections** | Section showing the newest N items of a collection on any page (e.g. homepage "Latest news"), regenerated at export | Medium (with 5) | ⭐⭐ |
| **7. Import content** | Paste or import Markdown / Word text into a post; bulk import items from CSV | Medium | ⭐⭐ |
| **8. Site search** | **Pagefind** loads its index in the browser over the network, which is expected to fail from disk (X1). Alternative: a small index shipped as a normal script (e.g. MiniSearch, MIT) that works from disk; fine for small sites | Medium | ⭐ Most small sites don't need search |
| **9. Selling** | **Stripe Payment Links / PayPal buttons** are plain links to a hosted checkout: no JS, no server, fits C8. A "Buy button" element with a product card. Full carts (Snipcart etc.) need external JS and are out of scope | Low | ⭐⭐ Simple sales, bookings, donations |
| **10. Multilingual** | Duplicate pages per language with a language switcher; `hreflang` tags | High | ⭐ Some markets |
| **11. Remote / browser editing for clients** | Needs a server/hosting to store edits | Not possible without hosting | Tied to the deferred Webforge Hosting decision (B2) |
| **12. Scheduled posts, members, comments** | Need a server or third-party embeds | — | ❌ Out of scope |

## Proposed phasing

| Phase | Features |
|---|---|
| **MVP** | 1 Click-to-edit · **2 Content mode** · **3 Repeating lists** · 4 Site-wide values · **9 Buy button (Stripe/PayPal links)** |
| **v1.1** | **5 Collections, starting with Blog** (posts, tags, RSS, pagination, post template) · 6 Latest-items sections · 7 Markdown/CSV import |
| **v1.2+** | More collection types (Events, Portfolio, Products catalogue, Team) · 8 Search (script-index approach) · 10 Multilingual |
| **Deferred** | 11 Remote editing (with Webforge Hosting, B2) · 12 Server features (out of scope) |

## How Collections would work (v1.1 design sketch)
- **Terminology (glossary-consistent):**
  - **Collection** (e.g. *Blog*), **Item** (e.g. a *Post*), **Fields**.
  - **List section** shows items; **Item page design** is the layout used for every item's page.
  - Wix and Webflow users know "Collection"; Squarespace users know "Blog/Events pages". The UI can say *"Blog"* for the built-in blog collection.
- **Editing:** a **Collections** panel with a spreadsheet-like list of items. Click an item to edit it in a form (title, date, cover image, summary, rich-text body, tags, SEO fields, draft/published).
- **Design:** the item page design is a normal Puck page whose elements are **bound to fields** ("Heading → Title"). List sections bind repeated cards to items.
- **Storage:** items are documents in the `.wforge` file (06), so they're covered by autosave, versions and undo (D1–D7). Each item edit is one undo step ("Edited post 'Spring opening'").
- **Export:** generates flat pages per X1 (`blog/<slug>.html`). Drafts are excluded. Sitemap and RSS use the Site URL (X3).
- **Site Check:** missing cover images, empty required fields, duplicate slugs, posts without descriptions.

## Decisions (2026-10-19)

| # | Topic | Decision |
|---|---|---|
| M1 | **MVP CMS scope** | ✅ Click-to-edit text & images · **Content mode** · **Repeating lists** (testimonials, team, services, FAQs, opening hours, prices) · Site-wide values (X3) · **Buy button** (Stripe Payment Links / PayPal links) |
| M2 | **Collections** | **v1.1: Blog** (posts, tags, RSS, pagination, post page design, latest-posts section, Markdown/CSV import). **Then** in priority order: **Portfolio / Gallery**, **Team / People**, **Events**. Products catalogue not prioritised (Buy buttons cover simple selling) |
| M3 | **Content mode** | **Simple toggle:** *Design* ⇄ *Content* editing for the same user. No password-protected hand-off lock |
| M4 | **Search & multilingual** | **Later (v1.2+).** Search via a small index shipped as a normal script (works from disk, X1); multilingual via per-language pages + `hreflang` |
| M5 | **Out of scope** | Remote/browser editing for clients (tied to deferred Webforge Hosting, B2); members, comments, scheduled posts, carts/checkout beyond payment links |

### Content mode (M3): behaviour
- **Toolbar toggle:** **Design | Content**. In Content mode:
  - **Editable:** text, images (replace/crop), links, button labels, list items (add/reorder/remove), Site Settings values, collection items (v1.1).
  - **Locked:** adding/moving/deleting sections and elements, styles, theme, Custom Code. The Add panel is hidden; the Edit panel shows only the Content tab.
- Undo/redo, Version History, Preview and Publish all work in both modes.
- A natural default for returning users: open existing sites in **Content** mode once the site has been published at least once (setting).

### Buy button (M1)
- Element **Buy button** (and a *Product card* section variant): label, price text, image, and a **payment link URL** (Stripe Payment Link, PayPal button link, or any checkout URL).
- Plain `<a href>`, so no external scripts (C8). Opens the provider's hosted checkout.
- Site Check: warns if the URL is empty or not https.

## Remaining open questions
1. **Other payment link providers** to preset beyond Stripe and PayPal (e.g. Square, Lemon Squeezy, Shopify Buy links)? Any https URL works via "Custom link" meanwhile.

## Sources
- Wix: [CMS overview (collections, items, fields, dynamic pages, datasets)](https://support.wix.com/en/article/cms-content-management-system-an-overview) · [Working with dynamic pages](https://support.wix.com/en/working-with-dynamic-pages)
- Webflow: [Dynamic content limits](https://help.webflow.com/hc/en-us/articles/33961370432275)
- Squarespace: [Events/calendar collection pages](https://support.squarespace.com/hc/articles/206543837) · [Pages & navigation basics](https://www.paigebrunton.com/blog/squarespace-pages-navigation)
- Search: [Introducing Pagefind (CloudCannon)](https://cloudcannon.com/blog/introducing-pagefind/) · [Pagefind on a static site](https://raymii.org/s/blog/Site_update_self_hosted_search_via_pagefind.html) · MiniSearch (MIT, npm)
- Payments: [Stripe Payment Links](https://docs.stripe.com/no-code/payment-links) · [Stripe Buy Button](https://edge-docs.stripe.com/no-code/buy-button) (needs Stripe's script; Payment Links don't)
- Bootstrap Studio blog/collections: [../bootstrap-studio/04-key-features.md](../bootstrap-studio/04-key-features.md)
