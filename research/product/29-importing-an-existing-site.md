# Importing an existing site: what an owner can bring, and how

**Status:** ✅ Decided 2026-11-27: IM-1, IM-4 and IM-6 adopted, IM-3 and IM-5 at v1.1; IM-2 and IM-7 not adopted ([§8](#8-decisions))
**Date:** 2026-11-27
**Question:** Three quarters of UK sole traders already have a website ([product/28](28-who-the-owner-is.md)), and the spec rules importing out (C3). What can an owner bring with them, what do the other builders do, what does a move risk, and what should Webforge do about it?

**Short answer:** Keep copying a site's design out of scope: no rival does it faithfully, and the design isn't the owner's to take. Bring the owner's words, pictures and addresses. Three steps, cheapest first. First, say how to move safely, since the real harm in a move is lost email, broken pictures and addresses that stop working, none of it in the editor. Second, let an owner list the addresses their old site used, so each sends visitors on; Webforge already does this for a page it renamed, but not for an address it never had. Third, bring the content: an AI app connected to Webforge can already read the old site and rebuild its pages, except the pictures, which Webforge won't download. A built-in importer is about two weeks of work and is better decided after the beta shows how the AI route fares.

## 1. What is decided and built already

- **Importing existing websites is out of scope** (C3, [MVP spec §5](../../spec/02-mvp-spec.md)).
- **The help page _Moving from another website builder_** (UC-5, [#1526](https://github.com/nexustech/webforge/issues/1526), Phase 5, open) is today's answer to "can I bring my site?": bring your words and pictures across by hand.
- **Old addresses keep working after a rename** (#862). When a published page's file name changes, the old address gets a small page that sends visitors on; on Netlify, and on Apache hosts once the destination's switch is on, it redirects for good. They are listed in **Site Settings › Search engines**, where they can be removed. An address can't be added there by hand, and each is a file name ending `.html`.
- **An AI app works on the open site** through the bridge (4.9): it reads and changes pages, sections, text, Site Settings and the theme. **It never adds a picture, and Webforge downloads nothing:** the app asks, and the owner chooses files (`docs/help/ai-apps.md`).
- **Research importing next** (WO-6, product/28): this note.

## 2. Method and limits

- **What 26 products do,** from their own documentation first and their forums second, read on 27 Nov 2026: eleven desktop builders, ten hosted ones and five tools that rebuild a site from its address with AI. Several vendors' pages could be read only as search summaries; §3 says which claims are whose.
- **What an owner can take,** from the platforms' own help pages and terms: Wix, Squarespace, Hostinger, WordPress, Carrd, Framer and others. GoDaddy's pages could not be read.
- **Moving without harm,** from Google's guidance on moving a site, the hosts' documentation on redirects, the registrars' pages on moving a domain, and ICANN.
- **How an importer could be built,** from the package registry and the projects' own pages for versions and licences, Electron's security guide and OWASP. Pages from Squarespace, Webflow and Framer were fetched to see what their first response carries.
- **Not found:** any team's account of how long an importer took to build; any count of votes for an import feature; any study of small businesses harmed by a move.
- **Not legal advice.** §4.2 is a reading of terms of service; one point needs a solicitor.
- Nothing was built or run against a real owner's site.

## 3. What the others do

### 3.1 Desktop builders

| Product              | Brings in                                                 | From                         | As                                 | What the vendor says of it                                                        |
| -------------------- | --------------------------------------------------------- | ---------------------------- | ---------------------------------- | --------------------------------------------------------------------------------- |
| Sitely               | Text, pictures, links and their arrangement               | A page's or a site's address | Its own editable pages             | Check every page at both widths                                                   |
| WYSIWYG Web Builder  | Text, pictures, video, form controls, menus, page details | An HTML file or an address   | Its own objects                    | Tables, scripts and widgets may fail; use a poor import as a picture to work from |
| Publii               | Posts, pages, pictures, tags, menus, search details       | A WordPress export file      | Its own posts and pages            | Not the theme; pictures that failed are listed; a live site can't be read         |
| Blocs                | Pictures, colours and fonts only                          | An address                   | Assets to place by hand            | A full import isn't possible; in the dearer edition only                          |
| RapidWeaver Elements | The page list and site settings, with no content          | Its own older projects       | Empty pages                        | Users ask for the content too                                                     |
| EverWeb              | Blog posts and photo galleries                            | A site published from iWeb   | Its own blog                       | A whole iWeb site can't be imported; a rebuild by hand is sold                    |
| Pinegrow             | Everything, as it is                                      | A folder of HTML             | The original HTML, edited in place | Not for sites that need a server                                                  |
| Bootstrap Studio     | Single HTML and CSS files                                 | Files                        | Custom code, not its components    | Users report broken picture paths                                                 |
| Nicepage             | Nothing                                                   |                              |                                    | It can't convert other sites; rebuild, or use its AI                              |
| Mobirise, WebSite X5 | Nothing                                                   |                              |                                    | Copy and paste                                                                    |

### 3.2 Hosted builders

| Product       | Brings in                                                          | From                                | Limits it states                                                                                           |
| ------------- | ------------------------------------------------------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Wix           | Blog posts only                                                    | WordPress                           | A whole site from elsewhere is "not supported"; a request for it is open. No redirects are made            |
| Squarespace   | Posts, pages, pictures, comments                                   | WordPress, Blogger, Tumblr          | No styles; nothing from Wix or the other builders                                                          |
| WordPress.com | Pages, pictures, menus, the site's title                           | A Wix address; a Squarespace export | The design is chosen afresh; a paid service moves the look too                                             |
| Hostinger     | Visible text, layout, colours, fonts, the menu                     | An address, rebuilt by AI           | Not an exact copy; pages outside the menu are missed; **text it can't read is filled with generated text** |
| GoDaddy       | Content, and the logo, pictures, colours and fonts if ticked       | An address, rebuilt by AI           | A fresh design, not a copy; no shop                                                                        |
| Duda          | Visible text, pictures and the business's name, **into a library** | An address                          | Not placed on pages; up to 30 pages; needs a sitemap                                                       |
| Framer        | A few elements at a time                                           | A live page, by a browser extension | No animations or screen sizes                                                                              |
| Webflow       | Rows into its collections                                          | A spreadsheet file                  | No HTML                                                                                                    |

Nothing was found for Carrd, Webnode, Jimdo or Durable.

### 3.3 Rebuilding from an address with AI

Lovable brings text, pictures, fonts and colours for up to ten pages, and not forms or the page's description. Relume reads the page list only. v0 works from a screenshot. No vendor publishes how faithful the result is, and Hostinger and GoDaddy both say it is not a copy.

### 3.4 What this shows

- **Nobody carries a design across faithfully.** Every product that reads an address says the layout is approximate. Forms never survive.
- **Half the desktop rivals import nothing,** and their forums hold the same thread over and over: "can I import my site?", answered no.
- **Two patterns suit a builder made of sections.** Sitely's: turn each page into editable native content and ask the owner to check it. Duda's and Blocs': collect the text and pictures and let the owner place them.
- **An address is the only source that works for everyone.** Wix, GoDaddy, Jimdo and Framer give no export file. WordPress's export file is the one worth reading, and Squarespace's is the same format with much left out.
- **One thing to rule out:** filling what couldn't be read with generated text, unmarked.
- **People charge for this:** a flat $499 for Wix to WordPress at one agency; $50 to $400 from freelancers.

## 4. What an owner can take

### 4.1 What the platforms hand over

| Platform    | An export                                         | What is in it                                                                                  |
| ----------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Wix         | None                                              | Its help says a site must run on Wix                                                           |
| Squarespace | A WordPress-format file                           | Ordinary pages, one blog, text and pictures. Not shops, portfolios, headers, footers or styles |
| WordPress   | A WordPress export file                           | Posts, pages, comments, links to pictures. Not the theme or the picture files                  |
| Hostinger   | Copy and paste, and the pictures from its library | Not the design or a shop                                                                       |
| Carrd       | A ZIP of plain HTML, on its dearer plans          | Forms show but don't work                                                                      |
| Framer      | None                                              |                                                                                                |
| Webflow     | Code on paid plans (from secondary sources)       | Not collections or forms                                                                       |

GoDaddy's, Jimdo's, Webnode's and Durable's could not be confirmed.

### 4.2 What is the owner's

- **The owner's own words and photos are theirs** on Wix (§3.1 of its terms), Squarespace (§2.1) and Hostinger (§8).
- **The design is not.** Templates, stock photos, icons and fonts are licensed for use on that platform only: Wix §3.2, Squarespace §5.4 and §4.1, Hostinger §9. An import that brought a stock photo or copied a template's look would take what the owner has no right to move.
- **Text and pictures made by the platform's AI** are the owner's on Wix (§5.4) and Hostinger (§13).
- **Wix's terms bar crawling and copying sites built on it** (§2.3). _To confirm with a solicitor:_ whether that reaches an owner, or a tool acting for them, reading their own published site. Wix's clauses were read from the previous version of its terms page.
- **A customer's review belongs to the customer.** Google says a business needs the writer's permission to show a review on its own site.

### 4.3 What a move puts at risk

None of these is in the editor, and each is what an owner would blame the new tool for.

- **Addresses.** Wix and Squarespace use addresses like `/about-us`; Webforge writes `about.html`. Nearly every address changes. Google's guidance: send each old address to its new one with a permanent redirect, not everything to the home page; keep the redirects for at least a year; expect a few weeks of movement in the results.
- **Where redirects can be made:** Netlify and Cloudflare Pages read a redirects file. Apache hosts read `.htaccess`. GitHub Pages allows neither, only a page that forwards.
- **Pictures.** They live on the old platform's servers. If the old plan ends before they were copied, they are gone. WordPress.com tells people to keep the old site up until the move is done.
- **Email.** Mail on the domain stops if the mail records aren't recreated where the domain now points.
- **The domain.** A transfer takes 5 to 15 days and can be locked for 60 days after a purchase or a change of owner. Pointing the domain at the new host needs no transfer.
- **Cancelling Wix** leaves a free site with adverts and disconnects the domain; the content isn't deleted.

## 5. How an import could be built

- **The pages can be read without running them.** Wix says its pages are rendered on its servers; Squarespace's, Webflow's and Framer's first response carried their text when fetched. GoDaddy's, Hostinger's and Google Sites' are not confirmed. A hidden window that runs the page is the fallback, under the same rules as any untrusted page (sandbox, no permissions, no downloads, its own throwaway session).
- **Every library it needs is permissively licensed and maintained:** `cheerio` and `parse5` to read HTML, `defuddle` or Mozilla's Readability for the body of a page, `metascraper` for titles and descriptions, `sitemapper` and `robots-parser`, `fast-xml-parser` for a WordPress export, `sanitize-html`, `request-filtering-agent` for the safety check below. **To avoid:** WordPress's own block converter and importer (GPL) and Firecrawl's core (AGPL).
- **Menus, footers and contact details have no library.** They are found by rule: the page's `nav`, `header` and `footer`, links that start `tel:` and `mailto:`, links to social sites, the address element, and the business's details where the page carries them in machine-readable form. Those details are a bonus, not a given: across the web, about 4 % of pages carry a local business's, and 64 % carry the title and picture used for sharing.
- **Pictures at full size:** Wix and Squarespace serve resized copies from addresses with the size in them; both document how to ask for the largest. Pictures that load late hide their real address in other attributes.
- **Safety.** A desktop app that fetches an address a person typed must refuse anything but `http` and `https`, refuse addresses on the computer or the local network, and check again after every redirect (OWASP). It should obey the site's `robots.txt` unless the owner says the site is theirs, fetch slowly, and stop at a set number of pages. Login pages and cookie banners are reported, never worked around.
- **The AI route needs none of this in Webforge.** The owner's AI app reads the old site with its own tools and writes sections through the bridge. Nothing is sent to Webforge's maker, and no model is added to the app. What it can't do is bring the pictures.
- **Effort:** no team's account was found. The products that do it all narrow the job: visible content only, pages found from the menu or the sitemap, a cap on pages.

## 6. What follows for Webforge

1. **C3 is right about the design and wrong as a whole.** Copying a look is unreliable everywhere and not the owner's to take. The words, the owner's own pictures, the page list, the business's details and the addresses are theirs, and are what a move needs.
2. **The cheapest help is advice.** Email, the domain, pictures and addresses are where owners are hurt, and a page of plain steps prevents all four. It belongs on #1526's help page, which is not yet written.
3. **Addresses are half built.** The kept addresses of #862 are the right mechanism. What is missing is adding one by hand, and an address without `.html`, which is what every hosted builder uses.
4. **The content can come across today,** with an AI app, for an owner who has one. That is the same route the product owner's own website trial took ([#1230](https://github.com/nexustech/webforge/issues/1230)). It has never been tried on someone's old site.
5. **Pictures are the gap in that route,** and in copying by hand: saving twenty pictures one at a time from a browser, at whatever size the old site served them.
6. **A built-in importer is the dear option,** and its value depends on how many owners have an AI app. The beta's sign-up now asks who made the tester's present site (WO-3), and watching testers (WO-4) will show how they bring their content. Decide it with that in hand.
7. **A promise to keep:** nothing invented. Whatever brings content across says what it couldn't read, and the _example_ mark and Site Check's list (5.33) already exist for text that isn't the owner's.

## 7. Proposals

| ID   | Proposal                                                                                                                                                                                                                                                                                                                                                                                                                              | Why                                                                                             | Cost                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| IM-1 | **Reword C3.** Out of scope: copying another site's design, layout, template or stock pictures. In scope: bringing across the owner's words, their own pictures, the page list, the business's details and the old addresses                                                                                                                                                                                                          | §6.1 and §4.2                                                                                   | A decision; a line in the spec                                                                   |
| IM-2 | **A moving checklist in the help.** _Moving from another website builder_ gains the steps in order: copy your pictures before anything else; list your old addresses; build and publish; point the domain and don't transfer it in a hurry; recreate the mail records; keep the old site until the new one is live; ask before reusing a customer's review. It names no price                                                         | §4.3 and §6.2: this is where owners are harmed                                                  | About half a day, added to [#1526](https://github.com/nexustech/webforge/issues/1526)            |
| IM-3 | **Add an old address by hand.** In **Site Settings › Search engines**, beside the kept addresses: **Add an Old Address…** takes an address from the old site, with or without `.html`, and the page it should go to. It exports as the kept addresses do: a redirect on Netlify and Apache, a forwarding page elsewhere. Site Check lists pages with no old address when the site says it replaces one                                | §6.3: nearly every address changes in a move, and Google's guidance is one redirect per address | About 2 days, as an estimate; to check first what an address without `.html` needs in the export |
| IM-4 | **Try the AI route on a real old site, and write it up.** The product owner, or a tester, moves a small existing site into Webforge with an AI app: the pages, the text, the business's details. The help's _AI apps_ page gains the request to give and what to expect. What was hard is filed, as the website trial's findings were                                                                                                 | §6.4: it exists and has never been tried for this                                               | About half a day of the product owner's time, and half a day of writing                          |
| IM-5 | **Pictures from a web address.** In Media, **Add from a Web Address…**: the owner gives a page's address; Webforge lists the pictures on it at their largest size; the owner ticks the ones that are theirs; they are added to Media. Only on the owner's own action, with §5's safety rules. An AI app can ask for it, and the owner still chooses                                                                                   | §6.5. It changes "Webforge downloads nothing", so it is a decision and not only a feature       | About 4 days, as an estimate, with a security review; v1.1                                       |
| IM-6 | **Decide a built-in importer after the beta.** If WO-3 and WO-4 show owners without an AI app struggling to bring content, build **Bring Pages from Another Site…**: read the pages found from the menu or the sitemap, up to 30; collect each page's title, description, headings, text and pictures; make simple sections from them; fill the business's details; record the old addresses; report what was skipped; invent nothing | §6.6 and §3.4                                                                                   | About 10 days, as an estimate; not before v1.2; needs IM-3 and IM-5                              |
| IM-7 | **Ask a solicitor about reading one's own site,** with the points already listed on [#1579](https://github.com/nexustech/webforge/issues/1579): whether a platform's terms against crawling reach an owner, or a tool acting for them, copying their own words and pictures                                                                                                                                                           | §4.2. IM-5 and IM-6 both depend on the answer                                                   | A question; no days                                                                              |

**Together:** about 3 days now (IM-2, IM-3 and the writing of IM-4) and about a day of the product owner's time; 4 days at v1.1 if IM-5 is adopted; IM-6 only if the beta calls for it.

**Not proposed:** reading a WordPress or Squarespace export file (worth doing only inside IM-6); opening a folder of HTML as it is (Webforge has no way to edit it); copying a design with AI.

## 8. Decisions

The product owner, 27 Nov 2026. Quoted words are the answers chosen.

| ID   | Decision                                                                                                                                                                                                                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IM-1 | ✅ **"Yes, reword":** copying another site's design, layout, template or stock pictures stays out of scope; bringing the owner's words, own pictures, page list, business's details and old addresses is in                                                                                                                                                                           |
| IM-2 | ❌ **Not adopted.** No moving checklist is added to the help; #1526's page stays as planned                                                                                                                                                                                                                                                                                           |
| IM-3 | ✅ **"Yes, at v1.1":** an old address added by hand, with or without `.html`. About 2 days; an item when v1.1 is planned                                                                                                                                                                                                                                                              |
| IM-4 | ✅ **Adopted:** the AI route is tried on a real old site and written up; about half a day of the product owner's time and half a day of writing                                                                                                                                                                                                                                       |
| IM-5 | ✅ **"Yes, at v1.1":** pictures from a web address the owner gives, the owner ticking which are theirs, with a security review. About 4 days; an item when v1.1 is planned. It changes "Webforge downloads nothing", and the help says so when it ships. The answer chosen named a solicitor's answer first; IM-7 was not adopted, so that question is asked when the item is planned |
| IM-6 | ✅ **Adopted:** a built-in importer is decided after the beta, from what WO-3 and WO-4 show; not before v1.2                                                                                                                                                                                                                                                                          |
| IM-7 | ❌ **Not adopted now.** No question goes to a solicitor yet; see IM-5                                                                                                                                                                                                                                                                                                                 |

## 9. Sources

All read on 27 Nov 2026.

- **Desktop builders (§3.1):** Sitely's [pages documentation](https://sitely.app/docs/pages.html); EverWeb on [iWeb sites](https://billing.ragesw.com/index.php/knowledgebase/168/Can-I-transfer-my-iWeb-site-to-EverWeb-or-do-I-have-to-rebuild-it.html); Realmac's [dev diary on importing Classic projects](https://forums.realmacsoftware.com/t/dev-diary-96-import-classic-projects-into-elements/50180); Blocs' [Extractor](https://help.blocsapp.com/knowledge-base/extractor/) and [forum](https://forum.blocsapp.com/t/import-website-in-blocs/27685); Bootstrap Studio's forum on [importing a site](https://forum.bootstrapstudio.io/t/import-existing-website-and-edit-custom-code/4998); Pinegrow on [editing an existing site](https://pinegrow.com/docs/getting-started/how-to-edit-your-existing-website-with-pinegrow/); WYSIWYG Web Builder's [Import HTML](https://wysiwygwebbuilder.com/import_html.html); Publii's [WordPress import](https://getpublii.com/docs/import-wordpress-into-static-html-site.html); Nicepage on [importing a site](https://nicepage.com/blog/import-existing-website-657224); [Mobirise](https://mobirise.com/help/project-files-368.html); [WebSite X5](https://helpcenter.websitex5.com/en/post/143712).
- **Hosted builders and AI tools (§3.2, §3.3):** Wix on [importing blog posts](https://support.wix.com/en/article/importing-blog-posts-from-wordpress-to-the-new-wix-blog) and its [open request for importing a site](https://support.wix.com/en/article/request-importing-a-site-created-outside-of-wix); Squarespace on [importing](https://support.squarespace.com/hc/en-us/articles/206543957-Importing-content-from-WordPress-Blogger-or-Tumblr); WordPress.com on [importing from Wix](https://wordpress.com/support/import/import-from-wix/); Hostinger's [website cloner](https://www.hostinger.com/ai-builder/website-cloner); GoDaddy on [rebuilding a site](https://www.godaddy.com/en/help/rebuild-my-website-in-airo-ai-builder-42965); Duda's [import of content](https://www.duda.co/product-updates/import-content-from-any-site-to-speed-up-your-build); Framer's [HTML to Framer](https://www.framer.com/learn/html-to-framer/); Webflow on [importing collection items](https://university.webflow.com/lesson/import-collection-items); Lovable's [import](https://docs.lovable.dev/features/projects/import-website.md); Relume's [import](https://resources.relume.io/resources/docs/import-an-existing-site-into-the-relume-site-builder); one agency's [price for Wix to WordPress](https://seahawkmedia.com/services/wordpress-migration-services/wix-to-wordpress/).
- **What the platforms hand over and what is the owner's (§4.1, §4.2):** Wix on [exporting a site](https://support.wix.com/en/article/exporting-or-embedding-your-wix-site-elsewhere) and its [terms of use](https://www.wix.com/about/terms-of-use); Squarespace on [exporting](https://support.squarespace.com/hc/en-us/articles/206566687-Exporting-your-site) and its [terms of service](https://www.squarespace.com/terms-of-service); Hostinger on [exporting content](https://www.hostinger.com/support/11767392-website-builder-exporting-your-content) and its [terms](https://www.hostinger.com/legal/universal-terms-of-service-agreement); WordPress.com on [exporting](https://wordpress.com/support/export/); Carrd on [downloading a site](https://carrd.com/docs/sites/downloading); Framer on [exporting](https://www.framer.com/help/articles/can-i-export-my-website-to-html-and-self-host-it/); Google on [using customers' reviews](https://partnermarketinghub.withgoogle.com/brands/google/use-cases/customer-reviews/).
- **Moving without harm (§4.3):** Google on [moving a site with changed addresses](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes); redirects on [Netlify](https://docs.netlify.com/manage/routing/redirects/overview/) and [Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/redirects/); [GitHub Pages' limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits); moving a domain away from [Wix](https://support.wix.com/en/article/transferring-your-wix-domain-away-from-wix-2477749) and [Squarespace](https://support.squarespace.com/hc/en-us/articles/205812338-Transferring-a-domain-away-from-Squarespace); ICANN's [transfer policy](https://www.icann.org/resources/pages/transfer-policy-2016-06-01-en).
- **Building an importer (§5):** the npm registry and each project's repository for versions and licences; the [Web Almanac 2024 on structured data](https://almanac.httparchive.org/en/2024/structured-data); Wix on [how its pages are rendered](https://support.wix.com/en/article/viewing-your-pages-source-code-the-way-search-engines-do) and on [picture addresses](https://dev.wix.com/docs/api-reference/assets/media/media-manager/url-image-transformation); Squarespace's [image loader](https://developers.squarespace.com/image-loader); Electron's [security guide](https://www.electronjs.org/docs/latest/tutorial/security); OWASP on [requests to addresses a user gives](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html); the [robots.txt standard](https://www.rfc-editor.org/rfc/rfc9309); HTTrack's [questions and answers](https://www.httrack.com/html/faq.html).
