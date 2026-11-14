# Where Webforge stands against its competitors, November 2026

**Status:** 🟡 Proposals for decision (CC-1…CC-12, [§8](#8-proposals)). Nothing here changes the spec or the plan until the product owner decides.
**Date:** 2026-11-14
**Question:** Six weeks of building after the gap analysis, how does Webforge compare with the tools a small-business owner would otherwise choose, and what should come next? Four topics were asked for by name: sites in more than one language, a light/dark switch for visitors, search engines, and missing sections and elements.

## 1. Method

- **Earlier research re-read:** the [gap analysis](../product/05-feature-gap-analysis.md) (G1–G40, GA1–GA10), the [Webflow](01-webflow.md) and [Pinegrow](02-pinegrow.md) reviews, the [Bootstrap Studio 9 review](../bootstrap-studio/06-bootstrap-studio-9.md), the [CMS note](../product/02-cms.md) (M1–M5), [search visibility](../product/12-search-visibility.md) (SEO-1…12) and [pricing](../product/10-competitor-pricing.md).
- **What ships today** was read from the code on `main`, not from the plan: the component catalogue (`packages/site-components/src/catalogue-data.json`), the themes, the export pipeline and Site Check.
- **Competitors as they stand on 14 Nov 2026**, from vendors' own documentation, feature pages and changelogs where they could be fetched. No account was opened and no app installed. Webflow's help centre and pricing page refused automated reading, so Webflow's rows rest on its public update posts and third parties.
- **Markers in the tables:** ✓ confirmed from the vendor's page that day; (✓) believed from earlier knowledge, not re-checked; app = an add-on or marketplace item; – = the vendor says no, or it is missing from its own list; ? = not found.
- **Who was looked at.** Hosted: Wix, Squarespace, Webflow, Framer, Hostinger, Jimdo, GoDaddy, Durable, Canva Websites, Google Sites, Carrd. Desktop or static output: Bootstrap Studio, Pinegrow, Blocs, Elements (Realmac), Mobirise, Sitely (Sparkle's new name), Publii, Nicepage. Canva, Google Sites, Carrd, Sitely, Publii and Nicepage are new to this research.

## 2. Key competitors

Three groups matter, for different reasons.

| Group                     | Who                                                                             | Why they matter                                            | What they do that Webforge can't                                                                               | What Webforge does that they can't                                                                   |
| ------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Hosted, for owners**    | Wix, Squarespace, Hostinger, GoDaddy                                            | What Webforge's user has heard of and will compare it with | Hosting and domain in one click; bookings, shop, members; a site in several languages; AI agents               | Own the site as a file; any host; no monthly fee; works offline; nothing loaded from anyone else     |
| **Hosted, for designers** | Webflow, Framer                                                                 | Set the bar for polish, localisation and AI                | CMS at scale, per-locale sites, interactions                                                                   | The same as above, and a product an owner can use without training                                   |
| **Desktop, files out**    | Bootstrap Studio, Elements, Blocs, Mobirise, Sitely, Nicepage, Pinegrow, Publii | The same promise as Webforge: buy an app, own the files    | Bootstrap Studio: visitor dark mode with a switch. Nicepage: language versions. Several: popups, tables, audio | Aimed at owners, not developers: quick start, Site Check, Content mode, plain words, version history |

**Closest rivals.** Bootstrap Studio 9 (20 Oct 2026: local CMS collections, Marquee, Preloader, an AI assistant on the user's own key, still $29–59 once) and Elements (subscription, Tailwind, a Markdown CMS, an MCP server). Both are tools for people who know some web design. Mobirise and Nicepage are the desktop tools aimed at beginners, and both now generate sites from a prompt.

**What changed in 2026** that the earlier notes don't have:

- **AI moved from "generate a site" to "an agent that edits the site"**: Wix Harmony (Jan), Framer 3.0 (June), Hostinger's AI Builder (Aug, merged with Horizons), GoDaddy Airo. Hosted prices are now metered in AI credits.
- **"AI visibility" became a standard SEO feature in twelve months**: Wix (July 2025), Squarespace (July 2026), Durable, Webflow. `llms.txt` is written or uploadable on Wix, Webflow, Hostinger and Framer.
- **Local CMS reached the desktop tools**: Bootstrap Studio 9, Elements, Pinegrow 10.1.
- **Sparkle became Sitely** and moved to a subscription with a one-off option; Hostinger Website Builder is now "AI Builder, manual mode"; GoDaddy closed its first AI builder (July).

## 3. How Webforge compares

| Area                     | Hosted, for owners                                   | Desktop, files out                             | Webforge today                                                                | Verdict                                                                     |
| ------------------------ | ---------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Getting started          | Questions or a prompt, then a site                   | Templates; Mobirise and Nicepage from a prompt | Four-step quick start, 8 templates, 15 themes, example sites                  | Level                                                                       |
| Editing                  | Sections and blocks, click to type                   | Mostly a designer's canvas                     | Sections and elements, click to type, Content mode                            | Level; see the UI audit                                                     |
| Sections and elements    | 40–100 blocks, plus app markets                      | 30–200, varies widely                          | 21 sections, 19 elements                                                      | **Behind** ([§7](#7-sections-and-elements))                                 |
| Theme and styling        | Site styles; little per-block control                | Full CSS control                               | Themes, Theme Studio, per-item Style, looks, stylesheet in Advanced           | Ahead of the hosted group                                                   |
| Visitor light/dark       | None native on Wix or Squarespace                    | Bootstrap Studio full; three follow the system | None; one scheme per site                                                     | **Behind** two rivals ([§5](#5-a-lightdark-switch-for-visitors))            |
| Several languages        | Wix native; Squarespace by Weglot; Hostinger up to 4 | Nicepage only                                  | One language; labels on the site are English whatever it is                   | **Behind** the hosted group ([§4](#4-sites-in-more-than-one-language))      |
| Blog                     | Yes                                                  | Recent, in three                               | Yes, with RSS                                                                 | Level                                                                       |
| Shop, bookings, members  | Yes                                                  | Links out, or an add-on                        | Buy button and Booking button (links); out of scope by M5                     | Behind by choice                                                            |
| Search engines           | Checklist, AI text, structured data, redirects       | Meta fields, Open Graph, a sitemap             | All the mechanics, LocalBusiness data, a _Being found_ check, `llms.txt`      | **Ahead** of the desktop group; level with hosted ([§6](#6-search-engines)) |
| Checks before publishing | SEO checklists                                       | Sitely and Bootstrap Studio have a checker     | Site Check: links, contrast, alt text, placeholders, being found              | Ahead                                                                       |
| AI                       | Agents, metered credits                              | Own-key assistants in four                     | Assistant on the user's own account with review and undo; AI apps through MCP | Level with desktop; no credits to buy                                       |
| Safety                   | Site history on some plans                           | Rare                                           | Undo history, version history, autosave                                       | Ahead                                                                       |
| Publishing               | One click, their host only                           | FTP; some Netlify or GitHub                    | Folder, ZIP, FTP/FTPS/SFTP, Netlify                                           | Level with desktop; harder than hosted                                      |
| Output                   | Their servers, their scripts                         | Files, often with CDN links                    | Files that work from disk with no outside requests                            | **Ahead** of everyone                                                       |
| Price over three years   | $300–1,000                                           | $59 once to $99–249 a year                     | $99 once ([pricing](../product/10-competitor-pricing.md))                     | Ahead of hosted                                                             |
| Interface languages      | Wix about 20; Squarespace 6                          | Nicepage 10; most English only                 | English only                                                                  | Level with desktop                                                          |

**In one paragraph.** Webforge already beats every desktop rival on what an owner needs around the site (starting, checking, being found, going back) and beats the hosted group on ownership and cost. It trails in three places an owner will notice: the choice of sections and elements, a site in more than one language, and, against Bootstrap Studio and Elements, a dark mode for visitors. It trails the hosted group in bookings, shops and members by a decision already made (M5), which this note doesn't reopen.

## 4. Sites in more than one language

### 4.1 What the others do

| Product                                                        | Several languages                                                                                                                             | Cost or limit                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Wix                                                            | Built in: main and secondary languages, a language menu, machine translation, per-language SEO, a choice of subfolder, subdomain or parameter | 3,000 free machine-translated words, then paid |
| Squarespace                                                    | Weglot extension; machine translation first; language subdomains                                                                              | Weglot's own subscription                      |
| Webflow                                                        | Paid add-on: locales in subfolders, a locale switcher, hreflang, AI translation                                                               | $9–29 a month per locale                       |
| Framer                                                         | Paid add-on: locales, AI translation kept in step with the original (Mar 2026)                                                                | $20 a month per locale, up to 20               |
| Hostinger                                                      | Built in, basic: adding a language copies the pages; translation by hand                                                                      | 4 languages                                    |
| Nicepage                                                       | A Language element: translates text, menus and buttons, with a switcher                                                                       | ?                                              |
| Bootstrap Studio, Pinegrow, Elements, Mobirise, Sitely, Publii | None: "make one project per language"                                                                                                         | –                                              |
| Jimdo, GoDaddy W+M, Durable, Canva, Google Sites, Carrd        | None found                                                                                                                                    | –                                              |

So it is common and paid on hosted builders, and almost absent from desktop tools. A desktop tool that does it properly, at no extra charge, would stand alone. It also fits the output: language folders are plain files.

### 4.2 Where Webforge stands

- **One language per site.** Site Settings › General › Language sets `<html lang>` for every page (`packages/model/src/settings.ts:213`, `packages/pipeline/src/html.ts:103`). No page can differ. No `hreflang`, no `dir`, no right-to-left support.
- **The site's own labels are always English.** About 70 strings that appear on the exported site ("Menu", "Back to top", "Accept all", "Decline", the lightbox's "Close", day names in opening hours, "Play the video from…") are `siteText.*` keys in the one English catalogue (`packages/i18n/src/en/components/`). A site whose language is `de` exports German-formatted dates beside "Monday" and "Accept all". **This is a defect today**, whatever is decided about several languages.
- **The editor is English only**, and `t()` has no locale (`packages/i18n/src/translate.ts`). Strings are all in the catalogue, which is the hard part done.
- **Decided so far:** M4 puts multilingual at v1.2+, as "per-language pages + `hreflang`" ([CMS note](../product/02-cms.md)); SEO-3 says no `hreflang` while a site has one language. Nothing covers right-to-left scripts or translation.

### 4.3 What to build, in three steps

1. **The site's labels in the site's language (CC-1).** Translate the ~70 `siteText` strings into a first set of languages, chosen by the site's Language setting, with English as the fallback and each one changeable per site (as the cookie banner's message already is). Make Language a list of names, not a code to type. Small, self-contained, and it fixes the defect above.
2. **Language versions of a site (CC-2).** A site has a main language and added ones. Each page, the Header, the Footer, the menu and the text in Site Settings have a version per language. The structure (sections, images, styling) is shared, so a layout change is made once; the words differ. Export writes the main language at the root and the others in folders (`/de/about.html`), with `hreflang` and `x-default` in every page and the sitemap, a language's own `lang`, and a **Language switcher** element for the Header that links each page to its counterpart. Site Check gains "not translated yet" per language. All of it works from disk.
3. **Help with the translating (CC-3).** The Assistant and AI apps already work on the user's own account: add "translate this page into…" as one undoable step with the review card. No machine translation is sold or bundled, in keeping with AIA-1…14. Right-to-left languages (`dir="rtl"`, mirrored layouts) follow as their own item, since every section has to be checked.

**Kept separate: the editor's own language (CC-4).** It is a different job (a locale for `t()`, translated catalogues and help pages) for a different reason (selling outside English-speaking countries). Worth doing with or just after CC-2, since an owner who needs a German site may well want a German editor, but not a condition of it.

## 5. A light/dark switch for visitors

### 5.1 What the others do

| Product          | Follows the visitor's setting | A switch on the site        | How the two looks are made                           |
| ---------------- | ----------------------------- | --------------------------- | ---------------------------------------------------- |
| Bootstrap Studio | ✓                             | ✓ Theme Switcher component  | The theme panel edits each mode's colours separately |
| Framer           | ✓                             | Marketplace components only | Each colour style has a light and a dark value       |
| Elements         | ✓ ("Allow Dark Mode")         | ?                           | Light and dark colours in the theme                  |
| Blocs            | ✓                             | –                           | A dark version of a class                            |
| Sitely           | ✓                             | ?                           | A dark colour theme per site                         |
| Webflow          | Custom code                   | Custom code                 | Variable modes                                       |
| Wix, Squarespace | –                             | – (apps, plugins or code)   | –                                                    |

Rare, then: only Bootstrap Studio has the whole thing, and the two builders an owner knows best have nothing. It is a visible, modern-looking feature that the hosted leaders can't match.

### 5.2 Where Webforge stands

- A site has **one fixed scheme**. Four of the fifteen themes are dark. Nothing in the export mentions `prefers-color-scheme`, and there is no switch.
- Most of the machinery exists. Every theme already carries **two palettes**, the main one and its `inverse`, used today for a section's _Reversed_ colours (`packages/themes/src/theme-css.ts:443`). Site Check already measures contrast.
- **Decided so far:** G12, "auto dark/light by visitor preference, optional toggle", v1.1, sized S, not yet a plan item. PG-5 (light and dark side by side in the editor) waits on it.

### 5.3 What to build (CC-5)

- **Theme tab › "Dark mode for visitors":** Off (today) · Follow the visitor's device · Follow the device, with a switch.
- **The dark look is the theme's second palette**, shown and editable in Theme Studio as "Dark colours". For a theme that is dark already, the second palette is its light look. Sections set to _Reversed_ stay the reverse of whichever is showing.
- **Export:** both palettes as CSS variables; `@media (prefers-color-scheme: dark)` does the following with no script at all, which suits the no-JavaScript rule. The switch is a **Light/dark switch** element for the Header: a button, one small classic script, the choice kept in the visitor's browser. Nothing is requested from anywhere.
- **Pictures:** an optional dark-mode logo in Site Settings; other images are left alone.
- **The editor:** a light/dark button on the canvas toolbar (and PG-5's side-by-side later). **Site Check** runs its contrast rule on both.
- **The cost is in the templates**, not the feature: every template and section must look right in both, so the visual suite doubles for themes with dark mode on.

## 6. Search engines

### 6.1 Where Webforge stands: well

The export writes a sitemap with dates, `robots.txt`, canonical links, Open Graph and Twitter cards, `LocalBusiness` and `WebSite` structured data with address, hours and coordinates, per-page and site-wide `noindex`, verification tags, redirects for renamed pages, an RSS feed, `llms.txt` on request, sized and lazy-loaded WebP images with the first one prioritised, a favicon set and a 404 page. Site Check's _Being found_ group covers descriptions, duplicate titles, a main heading, business details, Google Business Profile and Search Console. No desktop rival comes close; of those checked, only Publii writes structured data at all.

The rule in SEO-11 (no control Google says does nothing; no keyword scores; no "AI visibility" score; no network calls such as IndexNow from the export) still reads well a year on, and this note keeps it. The hosted builders' AI-visibility dashboards need a server and a subscription to track chatbots; they are not something a static-site tool should imitate.

### 6.2 What the others have that Webforge doesn't

| Gap                                                | Who has it                                                        | Worth doing?                                                                                                                                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Article data on blog posts                         | Wix, Squarespace (automatic)                                      | **Yes (CC-6).** The Blog shipped after the SEO note; posts have a date, author-less summary and picture and emit no `BlogPosting`. Google documents it.                                             |
| Redirects that work on ordinary web hosts          | Wix, Webflow, Framer (server redirects); Blocs writes `.htaccess` | **Yes (CC-7).** Renames write a stub page with a 0-second refresh and Netlify's `_redirects`. Most FTP hosts are Apache: also write real 301s in `.htaccess`, when publishing to FTP or on request. |
| `hreflang`                                         | Wix, Webflow, Framer                                              | With CC-2, not before (SEO-3).                                                                                                                                                                      |
| Product data on Buy buttons                        | Wix, Squarespace (their shops)                                    | **Maybe (CC-8).** A Buy button has a name, price and picture; `Product` with an offer is documented by Google. Needs a currency and care not to mislead.                                            |
| Event data                                         | Wix, Squarespace                                                  | With an Events section, if one is built ([§7](#7-sections-and-elements)).                                                                                                                           |
| AI-written titles, descriptions and alt text       | Wix, Squarespace, Hostinger, Canva, Webflow                       | Already decided: SEO-10, part of 6.9d. Make sure _Being found_'s **Fix** offers it where the Assistant is on.                                                                                       |
| A guided SEO checklist                             | Wix, Squarespace                                                  | Site Check is this. Its result needs to be seen: the UI audit found it hidden while its panel is closed (#1009).                                                                                    |
| Search Console and Business Profile inside the app | Wix                                                               | No: needs accounts and a server. The two reminders in _Being found_ are the right size.                                                                                                             |
| Editable `robots.txt`, blocking AI crawlers        | Wix; Publii by plugin                                             | **Small, optional (CC-9):** one tick box, "Ask AI companies not to train on this site", writing the known crawler rules. Considered and not proposed in the SEO note; owners now ask for it.        |
| IndexNow, keyword tools, AI visibility scores      | Wix, Squarespace, Durable                                         | No (SEO-11).                                                                                                                                                                                        |

Two findings from the UI audit belong here too: the Café / Restaurant template ships pages with no main heading, so Site Check warns about the template's own pages; and a new site keeps the template's sample description of someone else's business.

## 7. Sections and elements

### 7.1 What Webforge has

**21 sections:** Hero, Text, Text + Image, Call to action, Features, Gallery, Testimonials, Team, Pricing, FAQ, Stats, Logos, Video, Map, Opening hours and contact, Contact form, Newsletter signup, Section (blank), Announcement bar, Latest posts, plus Header and Footer. **19 elements:** Heading, Text, List, Image, Carousel, Embed video, Button (and Booking button), Spacer, Divider, Icon, Social links, Columns, Tabs, Embed map, Form, Buy button, Custom Code, Post tags.

**On "Accordion".** Webforge has one, under another name and in one place: the FAQ section's "Questions that open" layout is an accordion built on `<details>`, which works with no script. What is missing is an **Accordion element** that can go inside any section, as Tabs can. Wix, Elements, Nicepage and (by recollection) Squarespace, Webflow, Bootstrap Studio and Mobirise all have one as a free-standing block.

### 7.2 What is missing

Ranked by how often a small business needs it, how many competitors have it, and how well it suits files with no server. "Earlier" is what past research decided.

| #   | Missing                                                             | Who has it (confirmed)                                        | Fits static files?                            | Earlier                                | Proposal                                                |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| 1   | **Accordion** element                                               | Wix, Elements, Nicepage                                       | Yes: `<details>`, no script                   | Only as the FAQ layout                 | **CC-10, first**                                        |
| 2   | **Steps / Timeline** section ("How it works")                       | None confirmed as a block; common in templates                | Yes: no script                                | G16, Later                             | CC-10                                                   |
| 3   | **Table** element (prices, sizes, timetables)                       | Wix, Elements, Nicepage                                       | Yes; needs a narrow-screen layout             | G16, Later; CSV (G38) not adopted      | CC-10                                                   |
| 4   | **Popup** (an offer or notice; opens on a button)                   | Wix, Squarespace, Bootstrap Studio, Blocs, Elements, Nicepage | Yes: `<dialog>`, as the lightbox is           | G19, v1.1, not a plan item             | CC-10                                                   |
| 5   | **Before and after** image slider                                   | Elements (add-on) only                                        | Yes: a range input and a little script        | Rejected with option C                 | CC-10: Trades and Salon / Beauty templates would use it |
| 6   | **Contact buttons** (WhatsApp, call, email) that stay on screen     | Wix                                                           | Yes: links                                    | Not found                              | CC-10                                                   |
| 7   | **Menu / price list** section with headings and dotted prices       | Wix, Squarespace, GoDaddy                                     | Yes                                           | Pricing's "Price list" layout is close | CC-11: check the Café template first                    |
| 8   | **Logo or text marquee**                                            | Wix, Squarespace, Hostinger, Bootstrap Studio 9               | Yes: CSS only, stopped for reduced motion     | BS9: not proposed                      | CC-11                                                   |
| 9   | **Countdown** to a date                                             | Nicepage; Wix by app                                          | Yes: a little script, a plain date without it | G16, Later                             | CC-11                                                   |
| 10  | **Audio player**                                                    | Wix, Squarespace, Blocs, Elements, Nicepage                   | Yes: `<audio>`; file size is the concern      | Deferred (GA7)                         | CC-11                                                   |
| 11  | **Video background** for a Hero                                     | Wix                                                           | Yes; file size                                | G13, v1.1                              | Keep at v1.1                                            |
| 12  | **Numbers that count up** in Stats                                  | Nicepage                                                      | Yes: a little script                          | Rejected with option C                 | CC-11, as a Stats option                                |
| 13  | **Events** list (date, place, link)                                 | Wix, Squarespace, Nicepage                                    | Yes, as a Blog-like collection                | Events preset, v1.2+                   | CC-12                                                   |
| 14  | **Portfolio / projects** collection                                 | Wix, Squarespace, Webflow, Framer                             | Yes, same engine                              | v1.2+                                  | CC-12                                                   |
| 15  | **Search** on the site                                              | Wix, Squarespace, Hostinger, Nicepage                         | Yes, with an index in a script                | M4, v1.2+                              | Keep                                                    |
| 16  | **Language switcher**, **Light/dark switch**                        | See §4 and §5                                                 | Yes                                           | –                                      | CC-2, CC-5                                              |
| 17  | **File upload** field in forms                                      | Wix, Elements                                                 | Only if the form service takes files          | Not found                              | Not proposed                                            |
| 18  | **Share buttons** on posts                                          | Wix, Squarespace, Hostinger, Nicepage                         | Yes: plain links, no trackers                 | Not found                              | CC-11, small                                            |
| 19  | Breadcrumbs, mega menu, charts, multi-step forms, table of contents | One product each, at most                                     | Mostly                                        | Not found or not proposed              | Not proposed                                            |
| 20  | Instagram feed, Google reviews, bookings, cart, members             | Hosted builders                                               | No: needs a server or loads from others       | Out (M5, BS9)                          | Stay out                                                |

Each new section or element has a known price in this codebase: `pnpm new-component` scaffolds it with strings, a story and a test; it then needs a help entry, a catalogue-data refresh, a place in at least one template, and the visual and keyboard suites.

## 8. Proposals

For the product owner. Sizes are rough ideal days, to rank, not to plan with. None is in the plan.

| ID    | Proposal                                                                                                                                                                                                     | Size             | When                            | Depends on                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------- | -------------------------- |
| CC-1  | **The site's labels in the site's language**: translate the ~70 `siteText` strings for a first set of languages, per-site overrides, Language as a list                                                      | 3                | Before v1.0: it is a defect     | –                          |
| CC-2  | **Language versions of a site**: per-language text on a shared structure, language folders, `hreflang`, a Language switcher element, Site Check for untranslated text (pulls M4's multilingual half forward) | 15–20            | v1.1                            | CC-1; an ADR for the model |
| CC-3  | **Translate with the Assistant or an AI app**, one undoable step per page; right-to-left languages as a following item                                                                                       | 4 + 6            | v1.1, after CC-2                | CC-2, 6.9                  |
| CC-4  | **The editor in other languages**: a locale for `t()`, catalogues, help pages                                                                                                                                | 8 + per language | v1.1 or later                   | –                          |
| CC-5  | **Dark mode for visitors**: follow the device, optional switch element, dark colours in Theme Studio, canvas preview, contrast checked on both (G12, made concrete)                                          | 8–10             | v1.1                            | –                          |
| CC-6  | **`BlogPosting` data on posts**                                                                                                                                                                              | 1                | Before v1.0                     | –                          |
| CC-7  | **Real 301 redirects for Apache hosts** (`.htaccess`), beside the stub pages                                                                                                                                 | 1.5              | Before v1.0                     | –                          |
| CC-8  | **`Product` data on Buy buttons**, with a currency                                                                                                                                                           | 1.5              | v1.1; decide if wanted          | –                          |
| CC-9  | **"Ask AI companies not to train on this site"** in Site Settings                                                                                                                                            | 0.5              | v1.1; decide if wanted          | –                          |
| CC-10 | **Six missing building blocks, first batch**: Accordion element, Steps / Timeline section, Table element, Popup, Before and after, Contact buttons                                                           | 9                | v1.1, Accordion and Steps first | –                          |
| CC-11 | **Second batch**: menu / price list, marquee, countdown, audio, counting numbers, share buttons                                                                                                              | 7                | v1.1 or later                   | –                          |
| CC-12 | **Events and Portfolio** as collections on the Blog's engine, with `Event` data                                                                                                                              | 8                | v1.2 (as planned)               | –                          |

**Issues.** Each proposal has an issue that records it and what is still to decide: CC-1 to CC-12 are #1032 to #1043, in that order. CC-1, CC-6 and CC-7 sit in the Phase 5 milestone, CC-12 in none, the rest in v1.1. They are proposals until decided, and none is queued in a stream.

**Suggested order.** CC-1, CC-6 and CC-7 are small and fix things that are wrong or thin today; do them in beta hardening. Then CC-10's Accordion and Steps. Then choose between CC-5 (dark mode: smaller, showy, two rivals have it) and CC-2 (languages: larger, no desktop rival has it properly, opens new markets). My recommendation is CC-5 first because it is a third of the size and mostly built, then CC-2 as the headline of the release after.

**Not proposed, and why.** Bookings, a cart, members and comments (M5 stands). Instagram and Google review feeds (they load from other companies, against the export rule). IndexNow, keyword scores and AI-visibility dashboards (SEO-11 stands). Bundled or sold machine translation (AIA: the user's own account only). File-upload fields (depends on each form service).

## 9. Open questions

1. Is a wrong-language label on a non-English site (CC-1) a must-fix for v1.0, and which languages first? Suggested: French, German, Spanish, Italian, Dutch, Portuguese, Polish.
2. For CC-2, should the main language sit at the root with the others in folders (suggested, and what Wix and Webflow do), or every language in a folder with a chooser at the root?
3. For CC-5, should dark mode be on by default in new sites from themes that have a good second palette, or always off until chosen?
4. Is a popup (CC-10) acceptable at all, given Google's warning about intrusive ones? Suggested: only opened by a button, or once after a delay with a visible close, never covering the page on a phone.
5. Should CC-12 wait for v1.2, now that the Blog's engine exists?

## 10. Not covered

- **No competitor was run.** Everything is from documentation; nothing was installed and no account opened. Cells marked (✓) or ? need checking before they are quoted anywhere public.
- **Webflow** in particular: its help centre and pricing could not be read directly.
- **Jimdo, GoDaddy, Durable, Canva, Google Sites and Carrd** were covered lightly; their section lists were mostly not found.
- **WordPress and Shopify** are still outside this research.
- **Prices** were not re-checked beyond the changes in §2; the [pricing note](../product/10-competitor-pricing.md) is from 27 Oct 2026.
- **Interface language counts** are verified only for Nicepage (10).
- **Sizes** in §8 are estimates made without reading the model or the pipeline in depth.

## Sources

Retrieved 14 Nov 2026.

- **Wix:** [Multilingual overview](https://support.wix.com/en/article/wix-multilingual-an-overview) · [auto-translating](https://support.wix.com/en/article/wix-multilingual-auto-translating-your-site) · [light and dark mode request](https://support.wix.com/en/article/studio-editor-request-light-and-dark-mode-on-live-sites) · [SEO](https://www.wix.com/seo) · [elements in the editor](https://support.wix.com/en/article/wix-editor-elements-available-in-the-editor) · [AI Visibility Overview](https://www.wix.com/press-room/home/post/wix-launches-ai-visibility-overview-with-full-generative-engine-optimization-support-for-ai-powered)
- **Squarespace:** [SEO](https://www.squarespace.com/marketing/seo) · [Weglot](https://www.squarespace.com/enterprise/resources/optimize-squarespace-sites-with-weglot) · [content blocks](https://support.squarespace.com/hc/en-us/articles/206543757-Content-blocks) · [July 2026 updates](https://www.squarespace.com/blog/product-updates-july-2026)
- **Webflow:** [Localization](https://webflow.com/feature/localize) · [pricing](https://webflow.com/pricing) · [variable modes](https://developers.webflow.com/designer/reference/variable-modes) · [AI SEO and AEO](https://webflow.com/updates/ai-seo-aeo) · [llms.txt](https://webflow.com/updates/introducing-llmstxt)
- **Framer:** [pricing](https://www.framer.com/pricing) · [Auto Translate](https://www.framer.com/help/articles/auto-translate-for-localization/) · [light and dark mode](https://www.framer.com/academy/lessons/light-dark-mode) · [SEO guide](https://www.framer.com/help/articles/guide-to-seo-features-and-tools/)
- **Hostinger:** [multiple languages](https://www.hostinger.com/support/6435770-website-builder-how-to-add-multiple-languages/) · [elements](https://www.hostinger.com/support/6435894-website-builder-website-elements/) · [builder and Horizons](https://www.hostinger.com/support/10683629-hostinger-horizons-difference-between-hostinger-website-builder-and-hostinger-horizons/)
- **Bootstrap Studio:** [dark mode](https://bootstrapstudio.io/docs/dark-mode.html) · [SEO and social](https://bootstrapstudio.io/docs/seo-and-social.html) · [releases](https://bootstrapstudio.io/pages/releases) · [multilingual forum thread](https://forum.bootstrapstudio.io/t/multi-lingual-support-master-page-and-child-pages/5059)
- **Pinegrow:** [home](https://pinegrow.com/) · [release notes](https://pinegrow.com/release_notes/) · [multilingual forum thread](https://forum.pinegrow.com/t/multilingual-site/1378)
- **Blocs:** [features](https://blocsapp.com/mac/) · [pricing](https://blocsapp.com/pricing/) · [dark theme](https://help.blocsapp.com/knowledge-base/dark-theme/)
- **Elements:** [product page](https://www.realmacsoftware.com/elements/) · [docs index](https://docs.realmacsoftware.com/sitemap.md) · [multilingual forum thread](https://forums.realmacsoftware.com/t/elements-multilingual-website/56418)
- **Mobirise:** [home](https://mobirise.com/) · [multilingual help](https://mobirise.com/help/how-to-create-a-multilingual-site-448.html)
- **Sitely:** [home](https://sitely.app/) · [Sitely 7](https://sitely.app/blog/introducing-sitely-7.html) · [multilingual thread](https://community.sitely.app/t/multilingual-website/9425)
- **Publii:** [home](https://getpublii.com/) · [site settings](https://getpublii.com/docs/website-settings.html)
- **Nicepage:** [features](https://nicepage.com/features)
- **GoDaddy:** [sections](https://www.godaddy.com/help/add-a-section-20119) · **Google Sites:** [insert content](https://support.google.com/sites/answer/90538) · **Canva:** [optimise a website](https://www.canva.com/help/optimize-canva-website/)
