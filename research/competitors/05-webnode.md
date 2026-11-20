# Webnode: Competitor Review

**Status:** 🟡 Proposals for decision ([§7](#7-proposals-for-decision)). Nothing here changes the spec or the plan until the product owner decides.
**Date:** 2026-11-20
**Question:** Webnode is a hosted builder for the same person Webforge is for. What does it offer, where is it ahead and behind, and what should Webforge take from it?

Webnode is the hosted website builder a first-time owner in continental Europe is likely to have tried: free to start, cheap to upgrade, in 24 languages. Unlike [Onlook](04-onlook.md), it is squarely in Webforge's niche, in the "hosted, for owners" group of the [November comparison](03-comparison-2026-11.md#2-key-competitors), which named Wix, Squarespace, Hostinger and GoDaddy but not Webnode. This note adds it.

## 1. Method

- **Webnode's own pages**, read on 20 Nov 2026: features, pricing, the AI builder, e-commerce, about, the Knowledge Base and its 2025 and 2026 product-update pages. The pricing page was read in a browser and served pounds; the template gallery and the store's price table would not load, and three older page addresses returned 404.
- **Independent sources:** Trustpilot; Capterra and G2 through search summaries only (both refused a direct read); reviews by Tooltester (July 2025), Experte and Vincent Schmalbach (October 2026).
- **Two live Webnode sites,** one on a paid plan with its own domain and one on a free subdomain: their HTML was fetched and read. Nothing was tested in a browser, so what the cookie bar does on a visit is inferred from the markup.
- **Limits.** No account was made and the editor was not used: what the editor does comes from Webnode's help pages and from reviewers. Where sources disagree, both are given. Prices differ by country and changed during 2026.

## 2. The product

|                         |                                                                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Who**                 | Webnode AG, Zurich, with development in Brno; launched 2008; owned by team.blue since 2020 (Wikipedia). "Over 50 million websites created"                                                                                              |
| **What**                | A hosted builder: the site lives on Webnode's servers, at a `webnode.page` address or the owner's domain                                                                                                                                |
| **Languages**           | The editor and support in 24 languages; sites in over 30                                                                                                                                                                                |
| **Start**               | Free with no time limit, with Webnode's branding. "More than 150" templates, or one prompt to the AI builder                                                                                                                            |
| **Price**               | Four plans, per month on yearly billing: Limited £3.90, Mini £6.50, Standard £11.90, Profi £19.90 (monthly billing costs more: £4.50 to £24.90). Monthly billing was added in March 2026                                                |
| **What the plans gate** | Webnode's branding stays on Free, Limited and Mini. Standard adds the store, two site languages, 100 members, five backups, Google Analytics and the AI Assistant. Profi adds unlimited languages, members and backups, and site search |
| **Refund**              | 15 days on the first order; not on renewals or domains                                                                                                                                                                                  |

**What reviewers say.** Trustpilot 4.0 from 1,233 reviews; Capterra 4.6 from 762; Experte 7.8 out of 10; Tooltester 3.95 out of 5. The praise is the same everywhere: easy to use, cheap, and the best language-versions feature Tooltester has tested. The complaints: little design freedom (preset colours, about 30 font pairings, no mobile view), a basic blog and store, a template that can't be changed after it is chosen, and support that is hard to reach on the cheaper plans. Two 2026 Trustpilot reviews describe an upgrade charged at nearly double the offered price.

**What this means for Webforge.** Webnode is a real alternative for our customer, and its first hour is easier than ours: nothing to install, a free plan, and hosting included. Its limits are exactly where Webforge is strong: the site can't leave, the design can't go far, and the price never ends.

## 3. The editor and what a site can have

### 3.1 Starting

- **One prompt** to the AI builder since April 2026 (no questionnaire): it offers three designs, then writes the pages. Contact details in the prompt are filled in.
- **AI Migration** (released March 2026): paste the address of an existing site and it is rebuilt as a Webnode site.
- **In practice** (Schmalbach, October 2026): three designs of seven pages in about 35 seconds, but with invented teachers, dollar prices, an American phone number and a German town, and the sign-up email placed as the business's address. Experte found the generated sites plainer than the hand-made templates.

### 3.2 Editing

- Pages are sections holding content blocks. Blocks are dragged within a page, with a width slider, and can be moved or copied to other pages.
- **No per-device editing** and no mobile preview beyond narrowing the browser window.
- **Styling:** one accent colour chosen from a palette, one font per page from a list, and text colour in the text editor. Eight typography styles and 47 colours were added in October 2026. **No CSS at all,** and no custom fonts found.
- **Custom HTML:** a block on any paid plan, shown only on the published site; code can also be added to the header and footer.
- **Undo** covers most content changes on one page, not deleting a page. A published site can't be unpublished.
- **The AI Assistant** (October 2025) is a chat in the editor that writes sections, pages and blog posts, edits and translates text and makes images: three free uses, then Standard and above. Webnode's features page also lists an MCP server for outside AI tools.

### 3.3 Site features

| Feature               | Webnode                                                                                                                                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Language versions** | Add a language in Settings, optionally copying the pages and their content; addresses like `/es`; the visitor's browser language is detected. Translation is by hand, or text by text with the AI Assistant. Two languages on Standard, unlimited on Profi |
| **Store**             | From Standard: Stripe, PayPal, Klarna, bank transfer; variants, discount codes, several currencies; no commission. No digital products, automatic tax or live shipping rates (Tooltester)                                                                  |
| **Members**           | Locked pages and registration: 100 on Standard, unlimited on Profi                                                                                                                                                                                         |
| **Forms**             | Contact, reservation, newsletter and custom, with the number of fields set by the plan                                                                                                                                                                     |
| **Search engines**    | Titles, descriptions, addresses, 301 redirects, a sitemap, alt text with optional AI. **No structured data** was found in either live site. Tooltester (2025) reported no redirects; Webnode's pages now list them                                         |
| **Cookies**           | A built-in bar with four categories that turns on Google's Consent Mode                                                                                                                                                                                    |
| **Backups**           | Manual, five on Standard; automatic daily backups are a paid extra that keeps three. A restore is the whole project, and rolls back orders and form entries with it                                                                                        |
| **Statistics**        | Built in: visits, pages and sources                                                                                                                                                                                                                        |

### 3.4 What a Webnode site is made of

From the two live sites:

- **Weight.** Every page loads shared files from Webnode's network: a script of 427 KB, another of 122 KB and a stylesheet of 375 KB, uncompressed, with more besides. The paid site's home page was 273 KB of HTML on 273 lines. One test measured PageSpeed 98 on a desktop and 64 on a simulated phone.
- **Other parties.** Fonts come from Google. Webnode's own Google Tag Manager container is in the head of every page, with no consent condition visible in the markup, and each page carries the visitor's IP address and browser in a tracking block that reports to Webnode.
- **Branding.** The free site has a footer credit and a promotional strip. The paid site, on its own domain, still carried a "made with Webnode" link.
- **Done well.** Pictures are WebP with a JPEG fallback, sized, and lazy-loaded below the fold. The text and menu are in the HTML, so a page reads without JavaScript; the gallery does not.

### 3.5 Leaving

By Webnode's own help pages: the site is hosted only by Webnode, **cannot be exported or moved to another host,** has no source files and cannot be copied. When a plan lapses the site goes back to the free version, and Webnode's help says its design changes. Tooltester says an offline copy can be downloaded; that conflicts with Webnode's pages and could not be confirmed.

## 4. Where Webforge stands

| Area                           | Webnode                                                   | Webforge today                                                                               | Verdict                                                                                                       |
| ------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| The first hour                 | Nothing to install, free, hosted                          | A desktop app to install; a host to choose                                                   | **Behind** by design; publishing was simplified in [#1014](https://github.com/nexustech/webforge/issues/1014) |
| Starting a site                | 150+ templates; one prompt, three designs                 | 8 templates, 15 themes, a four-step quick start, a site from a brief through AI apps         | Level in kind; behind in number of templates                                                                  |
| Starting from an existing site | AI Migration from an address                              | Out of scope (C3)                                                                            | **Behind** ([§7](#7-proposals-for-decision), WN-1)                                                            |
| Design freedom                 | One accent colour, one font, no CSS                       | Themes, Theme Studio, a look per kind of component, per-item Style, a stylesheet in Advanced | **Ahead**                                                                                                     |
| Phones                         | Automatic only                                            | Per-device values, a phone preview by QR code                                                | **Ahead**                                                                                                     |
| Language versions              | Yes, well reviewed, on the upper plans                    | The site's own labels in three languages (6.12); versions in v1.1 (6.13)                     | **Behind** until 6.13                                                                                         |
| The editor's own language      | 24                                                        | English                                                                                      | **Behind**; held (CC-4)                                                                                       |
| Store, members                 | Yes                                                       | A Buy button and a Booking button; out of scope (M5)                                         | Behind by choice                                                                                              |
| Search engines                 | The mechanics; no structured data                         | The mechanics, LocalBusiness and BlogPosting data, _Being found_ in Site Check, `llms.txt`   | **Ahead**                                                                                                     |
| Checks before publishing       | None found                                                | Site Check                                                                                   | **Ahead**                                                                                                     |
| Going back                     | Undo on a page; whole-project backups on upper plans      | Undo history, Version History with restore as one undo step, autosave                        | **Ahead**                                                                                                     |
| AI                             | An assistant on Webnode's account, gated by plan          | An Assistant on the owner's own account, with a review card and undo; AI apps through MCP    | Level; ours has no plan gate                                                                                  |
| What visitors load             | About 1 MB of shared files, Google fonts, a tag manager   | Files that work from disk, with no outside requests                                          | **Ahead**                                                                                                     |
| Visitors' privacy              | A tracker and the visitor's IP in every page              | Nothing, unless the owner adds Google Analytics behind consent                               | **Ahead**                                                                                                     |
| Leaving                        | Not possible                                              | The site is a folder of files                                                                | **Ahead**                                                                                                     |
| Statistics                     | Built in                                                  | Google Analytics if the owner sets it up                                                     | Behind; a static site has no server to count with                                                             |
| Price over three years         | Standard on yearly billing: about £430. Profi: about £715 | $99 once, plus a host, which can be free                                                     | **Ahead**                                                                                                     |

**In one paragraph.** Webnode wins the first hour and the things that need a server: a store, members, statistics, and language versions today. Webforge wins everything about the site itself: how it can look, what it weighs, what it tells search engines, how safely it can be changed, and whether the owner can ever leave. The owner most likely to choose Webforge over Webnode is one who has already been on a hosted builder and felt the limits, which is why the first proposal below matters.

## 5. Lessons from its weak points

- **An AI that invents facts makes work.** The reviewer had to find and remove made-up prices, people and a phone number. A generated site should carry what the owner said and clearly marked gaps for the rest.
- **A whole-project restore is a blunt tool.** Webnode's restore takes orders and form entries back with it. Ours restores a version as one undo step, which is the right design; nothing to change.
- **A template that can't be changed** is a recurring complaint. Ours separates the starting content from the theme, which can be changed at any time; worth saying in the help and on the website.
- **Plan gates on basics** (a form's fields, branding on two paid plans) are resented. A reason to keep Webforge's single price with nothing switched off.

## 6. What is not worth copying

- **Hosting, a store, members and built-in statistics:** each needs a server, and M5 already decided the first three.
- **A free plan with branding:** our price model is one licence (MVP §8).
- **One prompt in place of the quick start's four steps:** the four steps are what stop the invented facts of §3.1.
- **Browser-language detection by a script on every page:** a static site can offer a language switcher and `hreflang`, which 6.13 already plans; a redirect script would be a choice for its ADR, not a default.

## 7. Proposals for decision

Sizes are rough ideal days, to be estimated properly if adopted. None is in the plan.

| #        | Proposal                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Why                                                                                                                                  | Size                    |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| **WN-1** | **"Bring your current site":** from the quick start, the owner gives their existing site's address, and the Assistant (or an AI app) reads its public pages and fills the new site with their own words, contact details and page list, as a site from a brief does. On the owner's own AI account, with the pages fetched only when they ask. It takes text and facts, never markup or design. Reopens C3 (importing existing websites, out of scope) in this narrow form | The owner most likely to switch already has a site on a hosted builder that won't let them leave. Webnode shipped this in March 2026 | 3–5 (v1.1)              |
| **WN-2** | **Notes for language versions (6.13, [#1033](https://github.com/nexustech/webforge/issues/1033)):** adding a language offers to copy every page and its content, as Webnode does; and the ADR decides whether a visitor's language is ever detected, given a static site                                                                                                                                                                                                   | Webnode's version of this feature is the best reviewed in its class, and copying the content is the step reviewers praise            | 0 (a note on the issue) |
| **WN-3** | **A rule and a test: generated content invents no facts.** The quick start, a site from a brief and the Assistant never write a made-up name, price, phone number, address or opening hour. What the owner didn't give stays a marked placeholder, which Site Check already lists. Whether today's instructions already say this was not checked here                                                                                                                      | Webnode's AI builder was caught doing exactly this in October 2026                                                                   | 1                       |
| **WN-4** | **A help page, "Moving from a hosted builder":** what to copy across, how the domain moves, what a host is and what it costs, and what changes (no monthly fee, the site is a folder)                                                                                                                                                                                                                                                                                      | The first hour is where Webnode is ahead; this is the page that owner needs                                                          | 0.5                     |
| **WN-5** | **Evidence for CC-4** ([#1035](https://github.com/nexustech/webforge/issues/1035), the editor in other languages, held): Webnode offers its editor in 24 languages and its strength is non-English Europe                                                                                                                                                                                                                                                                  | CC-4 waits for demand; this is a data point for when it is reviewed, not a reason to start it                                        | 0 (a note on the issue) |

**Not proposed:** more templates for their own sake (the comparison's §7 already covers sections and elements); built-in statistics; a free tier; a one-prompt start.

**If only one is taken:** WN-3, since it is a day's work and protects the thing owners trust us with. WN-1 is the one with the most to gain, and the largest.

## Sources

All read on 20 Nov 2026.

- Webnode: [features](https://www.webnode.com/features/) · [pricing](https://www.webnode.com/pricing-w2/) · [AI website builder](https://www.webnode.com/ai-website-builder/) · [e-commerce](https://www.webnode.com/e-commerce/) · [about](https://www.webnode.com/about-us/) · [2025 updates](https://www.webnode.com/support/2025-product-updates/) · [2026 updates](https://www.webnode.com/support/2026-product-updates/) · [multilingual sites](https://www.webnode.com/blog/how-to-make-multilingual-website/)
- Webnode's Knowledge Base: [editor and content FAQ](https://www.webnode.com/support/editor-and-content-faq/) · [paid and unpaid services](https://www.webnode.com/support/paid-and-unpaid-services/) · [content blocks](https://www.webnode.com/support/add-new-content-block/) · [fonts](https://www.webnode.com/support/change-website-font/) · [accent colour](https://www.webnode.com/support/change-complementary-color/) · [HTML code](https://www.webnode.com/support/add-html-code/) · [cookie consent](https://www.webnode.com/support/add-cookie-consent/) · [restoring a backup](https://www.webnode.com/support/restore-website-from-backup/) · [automatic backups](https://www.webnode.com/support/understanding-automatic-backup/) · [statistics](https://www.webnode.com/support/websites-statistics/)
- Independent: [Trustpilot](https://www.trustpilot.com/review/webnode.com) · [Capterra](https://www.capterra.com/p/167799/Webnode/reviews/) (search summary) · [G2](https://www.g2.com/products/webnode/reviews) (search summary) · [Tooltester](https://www.tooltester.com/en/reviews/webnode-review/) · [Experte](https://experte.com/website-builder/webnode) · [Vincent Schmalbach](https://www.vincentschmalbach.com/webnode-review/) · [Wikipedia](https://en.wikipedia.org/wiki/Webnode)
- Live sites read: a paid site on its own domain and a free `webnode.cz` subdomain, both from [a public list of Webnode examples](https://howtostartanllc.com/how-to-build-a-website/webnode-website-examples)
- Webforge: [November comparison](03-comparison-2026-11.md) (CC-1…CC-11) · [gap analysis](../product/05-feature-gap-analysis.md) · [a site from a brief](../product/16-ai-site-from-a-brief.md) · [pricing](../product/10-competitor-pricing.md) · MVP §5 (C3, M5)
