# Freelancers and agencies: the people who build sites for others

**Status:** ✅ Decided 2026-11-28: FA-1 to FA-7 all adopted, FA-2 as "their own licence", FA-3 at v1.1 and FA-4 at v1.2 ([§8](#8-decisions))
**Date:** 2026-11-28
**Question:** The person who makes sites for others is one of the four people Webforge serves (WO-1), and one licence covers the sites they make (WO-2). How many of them are there, what do the other builders offer them, what do they need from Webforge, and what should it not try to be?

**Short answer:** They are few, and each pays once, so they are not where the money is. They are where the owners are: a freelancer who builds in Webforge hands each client a site the client then needs Webforge to change. So serve the hand-over, not the agency. Webforge's licence is already the plainest on offer: three desktop rivals now charge extra or yearly for client work, and that is what freelancers complain about most. What is missing is small: a hand-over that leaves the client holding everything, a way to start a new site from one of your own, and plain words about what the client needs. One question has to be decided, because the licence as written leaves a gap: what a client pays to change a site someone else built for them. Do not build what the hosted builders sell to agencies: billing clients, hosting, editing in a browser, revenue share.

## 1. What is decided and built already

- **The person who makes sites for others** is named in the spec: a freelancer, or the relative who is good with computers (WO-1, [product/28](28-who-the-owner-is.md)).
- **One licence covers sites made for other people, paid or unpaid;** the person who receives a site needs no licence to have it (WO-2).
- **A licence is one person's, on three computers at a time;** someone the owner sends a copy to works on the same licence, using one of the three (SL-1, SL-2, [product/26](26-licensing-and-selling.md)). The pair in mind was an owner and one helper.
- **Without a licence, after the trial, a site still opens, exports and publishes; editing waits for a licence** (UC-1).
- **Built today:** **Content mode**, which changes words and pictures and locks the layout; **Save a Copy as ZIP…** and **Open Site from ZIP…**, a whole site as one file, without its publishing passwords, which stay in the computer's own password store; your own themes, which are there for every site; copy and paste of sections and elements between two sites.
- **Adopted for v1.1, not yet items:** **Keep in Content Mode…**, a latch against accidents (PG-18); a Content panel listing what a page says (PG-17); adding and removing repeating items in Content mode (PG-16); **Send a Copy to Edit…** and seeing what changed when it comes back (UC-4, PG-11).
- **Ruled out:** editing a site in a browser, and deciding field by field who may change what (M5).
- **Not built, and not proposed before:** saving a site as a template of your own; a library of saved sections.

## 2. Method and limits

- **How many there are,** from the ONS's survey of people by occupation and its counts of businesses (read from Nomis) and the US Bureau of Labor Statistics. The occupation figures are survey estimates with wide margins.
- **What they charge and use,** from one independent survey of WordPress freelancers (1,144 people, 2024), two tool vendors' surveys, and a UK publisher's check of published price lists. No independent UK survey of rates for small-business work was found.
- **What 23 builders offer them,** from the vendors' own pages where they could be read, on 28 Nov 2026: twelve hosted products and page builders, eleven desktop ones. Webflow's and GoDaddy's own pages, and several licence agreements, could not be read; §4 says which figures came from search summaries. **Black Friday prices were showing on many sites.**
- **What they say,** from the products' forums, Hacker News, dev.to and blogs. **Reddit could not be reached,** so the freelancers' own reasons in §3.3 rest on about a dozen sources, several of them vendors'.
- **Not found:** how many freelancers use Webflow, Framer, a desktop tool or hand-written code; how often a designer vanishes or holds a client's domain; anything that counts the unpaid helper beyond one US figure.

## 3. Who they are

### 3.1 How many

| Measure                                                        | Figure                                |
| -------------------------------------------------------------- | ------------------------------------- |
| UK web design professionals, self-employed                     | 9,000, give or take 3,700 (of 30,600) |
| UK graphic and multimedia designers, self-employed             | 35,200 (of 125,700)                   |
| UK registered small businesses in specialised design           | 23,630 with under ten staff           |
| US web developers and web and digital designers, self-employed | about 33,000 (of 220,100 jobs)        |

Official figures, 2025–26. **They are few:** for each self-employed UK web designer there are about 450 UK businesses with no employees ([product/28](28-who-the-owner-is.md) §3.1). No code or count is only "people who build small-business websites", and the graphic designers who also make sites are in neither web figure.

### 3.2 What they charge

- **A small site:** £1,500 to £3,000 from a UK freelancer in one cost guide; among 28 UK price lists read in 2026 the middle package was £520. Among 1,144 WordPress freelancers, mostly US, 72 % charge under $5,000 a project.
- **Keeping it up:** the middle entry "care plan" among 18 UK price lists is £50 a month. In a tool vendor's survey, 57 % charge $25 to $100 a month and 77 % also sell the hosting. About a third of the WordPress freelancers get most of their income from recurring work.
- **Against that,** US $99 once is two months of a typical care plan.

### 3.3 What they use, and why

- **By sites:** of sites built on a system, about 64 % are on WordPress, 7 % on Shopify, 5 % on Wix, 3 % on Squarespace and under 2 % on Webflow (Web Almanac 2025). Nothing counts desktop tools.
- **Their reasons, most mentioned first:** income that recurs from hosting and care; less upkeep and fewer security updates; a client who can change things without breaking the layout; the cost for each site or seat; not being locked in, and handing over cleanly; speed and templates to reuse.
- **The first reason pulls away from Webforge and the next four towards it.** A static site has nothing to update and nothing to rent out. A freelancer whose income is care plans has little reason to change; one who is paid for the build and wants no calls afterwards has every reason.

### 3.4 What goes wrong

- **The words never arrive:** in a vendor's survey of 120 agencies, clients caused 87 % of delays.
- **Clients don't edit anyway:** freelancers report that nearly all clients come back for changes, or lose the login.
- **The designer vanishes holding everything.** A UK host describes hosting, the domain, its settings, the email and the site's login all in the designer's name, and two agencies that left over thirty sites behind. No figure says how often.
- **A static site built by a developer is safe and cheap to host and hard for the client to change.** Nobody found described a hand-over that a non-technical client managed alone.

### 3.5 The unpaid helper

One US survey has 1 % of small-business sites built by a friend or relative, 9 % by the owner and 37 % by someone on the staff, who is often no professional. Church and charity sources describe one person holding every password as the risk. Nothing sizes this group.

## 4. What the builders offer them

### 4.1 How a licence treats client work

| How                        | Products                                                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| In the ordinary licence    | Bootstrap Studio, WYSIWYG Web Builder, Mobirise, Publii, Divi, Bricks; and **Webforge** (WO-2)                                      |
| A dearer or yearly edition | RapidWeaver Elements (its $249-a-year edition, against $99), Sitely (its Pro plan), WebSite X5 (a yearly Agency edition since 2024) |
| For each person            | Webflow, Framer; Pinegrow, with $20 once for each client who edits                                                                  |
| For each site or domain    | Duda, Webflow's and Wix's site plans, Elementor's and Bricks' lower tiers, Elements' online editor                                  |

### 4.2 What the hosted builders give professionals

- **The client pays the platform directly,** and ownership passes online: Wix, Squarespace, Webflow, Framer, Shopify.
- **A restricted role in the browser** for the client: Wix, Webflow, Framer, Duda, Squarespace.
- **Money back to the professional:** Wix 20 to 30 % of a client's yearly plan, Shopify 20 %, WordPress.com up to 50 %, Squarespace 10 to 25 % off.
- **A directory of professionals,** and at Wix and Shopify a place to sell templates.
- **Templates and sections to reuse,** capped by plan at Duda (two to five templates).
- **Their own name on it** at Duda's dearest plan.

Each of these needs a server, an account for every client, or billing.

### 4.3 How a client changes a site built for them

- **Hosted:** in a browser, in a restricted role. This is the one thing desktop tools lack.
- **Pinegrow:** the designer marks what may change; the client installs Pinegrow with a $20 licence and publishes the site themselves. Its forum calls needing the files on the client's computer a serious limit.
- **Blocs, with a third party's add-on; Elements, with an online editor at $99 to $199 for each domain:** an editor on the client's own web host.
- **Bootstrap Studio, EverWeb, WYSIWYG Web Builder, Mobirise, Sitely, WebSite X5:** the client needs the app and the project file, or pays for every change.
- **No desktop rival documents a hand-over.**

### 4.4 What freelancers complain about

- **Paying more to do client work,** and the rule changing after they bought: Elements' users call £250 a year out of reach for someone keeping one or two sites; WebSite X5 took paid client work out of its ordinary editions.
- **A fee for each site or domain** that grows with their work: Elements' editor, Duda, Elementor.
- **Price rises they must pass on:** Webflow in May 2026, Squarespace in July 2026.
- **Hand-overs that go wrong:** a Wix Studio site passed to a client who then needed a dearer plan; a Hostinger builder site that can't change account.

## 5. What follows for Webforge

1. **They are a route, not a market.** Nine thousand self-employed UK web designers buying once is little. Each one who builds in Webforge leaves behind clients who need Webforge to change their site, and tells other people what they use.
2. **The licence is already the offer.** Client work in the ordinary licence, any number of sites, nothing for each site or seat, every later version: no rival that sells to non-designers matches it, and three have moved the other way. It needs saying, and keeping.
3. **The gap in the licence.** SL-2 lets the person an owner sends a copy to use one of the licence's three computers. That was written for an owner and a helper. For a freelancer it means two clients at most can change their own sites, and the freelancer's key is on their computers. Every other client needs a licence of their own, or the freelancer makes every change. Nothing says this today.
4. **The hand-over is nearly there, in pieces.** The site as one file, Content mode, the latch, the copy to edit and the changes shown on its return are built or adopted. What no piece does is leave the client holding everything: where the site is published, whose name the domain and hosting are in, which outside services its forms and buttons use, and what to install.
5. **The same hand-over serves the volunteer.** A club's site passes from one person to the next, and one person holding every password is the risk the churches and charities name.
6. **Starting from your own work is the missing reuse.** Themes carry across sites and sections paste between them, but a freelancer's second site for a plumber starts from the built-in template again.
7. **What recurs for them elsewhere doesn't exist here, and shouldn't.** Hosting to resell, care plans for updates, a share of a client's subscription: a static site with one price has none of them. A freelancer who lives on those is not who Webforge is for.

## 6. The question to decide: what a client pays to change their site

| Option                                         | What it means                                                                                                                 | For                                                                                  | Against                                                                                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **A. Their own licence** (as written)          | The client buys Webforge at the ordinary price, or uses the 14-day trial for a first round of changes, or asks the freelancer | One price, nothing new to build or explain; $99 is two months of a typical care plan | A client who changes their opening hours twice a year may not pay it; the freelancer's hand-over ends with "now buy this" |
| **B. Content mode without a licence**          | Anyone may change words and pictures in Content mode without a licence; Design mode needs one                                 | The hand-over is complete; no rival offers it                                        | An owner could build a site in the trial and keep it up for nothing, which gives away what many owners need               |
| **C. A cheaper licence for content only**      | A second, lower price that unlocks Content mode alone, as Pinegrow's $20 does                                                 | Fits the client who only changes words                                               | A second price and tier, against "one price"; more to build and to explain                                                |
| **D. More places on the freelancer's licence** | A licence covers the person's own computers and those of any client they send a copy to                                       | Simple for the freelancer                                                            | One licence could serve any number of businesses; it undoes SL-1                                                          |

**Proposed: A, said plainly,** and looked at again once v1.1 has sold for a few months. It keeps one price, and it is what makes the people who build for others worth serving. B is the generous choice and the risky one.

## 7. Proposals

| ID   | Proposal                                                                                                                                                                                                                                                                                                                                                                                                  | Why                                                                                                    | Cost                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| FA-1 | **Serve the hand-over, not the agency.** The spec says of the person who makes sites for others: Webforge helps them build and hand over, and sells nothing to run an agency on                                                                                                                                                                                                                           | §5.1 and §5.7. It decides what the next proposals are for, and what is refused                         | A decision; a line in the spec                                                    |
| FA-2 | **A client needs their own licence to change their site** (option A), said on the Pricing page and in the licence agreement, with SL-2 reworded: the copy sent to a helper is for the same business or household, not for a client. Looked at again after v1.1 has sold for three months                                                                                                                  | §5.3 and §6                                                                                            | A decision; wording on [#1579](https://github.com/nexustech/webforge/issues/1579) |
| FA-3 | **A hand-over sheet.** **File › Hand Over This Site…** saves the copy to edit (UC-4) and a one-page summary to print or send: the site's pages; where it is published, without a password; the web address, and a line for whose name the domain and hosting are in; the outside services its forms, buttons and analytics use; what the next person needs to install and set up. It names nothing secret | §3.4, §4.3, §5.4 and §5.5: no desktop rival documents a hand-over, and it serves the volunteer too     | About 2 days, as an estimate; v1.1, with UC-4                                     |
| FA-4 | **Start a site from one of your own.** **File › Save as a Starting Site…** keeps a site as a template of your own, listed under **Yours** in New Site, on this computer                                                                                                                                                                                                                                   | §5.6. Speed and reuse is the weakest of the reasons freelancers give, so this is the one to drop first | About 3 days, as an estimate; v1.2; to check against how New Site lists templates |
| FA-5 | **Say what may be done with the templates and their pictures:** used on any site, a client's included; not sold on as templates. In the licence agreement, with the review of stock-photo licences that S5 deferred done before it is promised                                                                                                                                                            | §4.1: rivals state it, and a freelancer needs to know before using a template for a paying client      | A decision; the review is S5's, not yet estimated                                 |
| FA-6 | **Help for the person who builds for others:** a help page, _Making a site for someone else_: put the domain and the hosting in their name from the start; hand over with Content mode on; what they need to change it themselves; what never travels with the site (passwords). The website gets the same page among LP-8's                                                                              | §3.4: the harm is in who holds the domain and hosting, and no feature prevents it                      | About half a day of writing                                                       |
| FA-7 | **Not building, and saying so:** billing a client, hosting or reselling it, editing in a browser (M5 stands), a share of anything, a directory of professionals, a marketplace for templates, Webforge under someone else's name                                                                                                                                                                          | §4.2 and §5.7: each is a different product                                                             | A decision                                                                        |

**Together:** half a day now (FA-6), about 2 days at v1.1 (FA-3) and about 3 at v1.2 (FA-4); the rest are decisions.

**Left open:** how many freelancers would move from WordPress or a hosted builder for a tool with no recurring income in it; whether clients buy a licence or go back to the freelancer for every change. The beta recruits at least one person who builds for others (WO-3), and the first months of selling will show the second.

## 8. Decisions

The product owner, 28 Nov 2026. Quoted words are the answers chosen.

| ID   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FA-1 | ✅ **Adopted:** serve the hand-over, not the agency; a line in the spec's §1                                                                                                                                                                                                                                                                                                                                                              |
| FA-2 | ✅ **"Their own licence":** a client buys Webforge at the ordinary price to change a site built for them, or uses the trial, or asks the person who built it. Said on the Pricing page and in the licence agreement ([#1579](https://github.com/nexustech/webforge/issues/1579)); SL-2 is reworded so the copy sent to a helper is for the same business or household, not a client. Looked at again after v1.1 has sold for three months |
| FA-3 | ✅ **"Yes, at v1.1":** the hand-over sheet, with UC-4's copy to edit. About 2 days; an item when v1.1 is planned                                                                                                                                                                                                                                                                                                                          |
| FA-4 | ✅ **"Yes, at v1.2":** a site saved as a starting site of your own. About 3 days; an item when v1.2 is planned                                                                                                                                                                                                                                                                                                                            |
| FA-5 | ✅ **Adopted:** the templates and their pictures may be used on any site, a client's included, and not sold on as templates; in the licence agreement, once S5's review of stock-photo licences is done                                                                                                                                                                                                                                   |
| FA-6 | ✅ **Adopted:** the help page _Making a site for someone else_ ([#1645](https://github.com/nexustech/webforge/issues/1645), Phase 5, out of plan, half a day)                                                                                                                                                                                                                                                                             |
| FA-7 | ✅ **Adopted:** not building billing a client, hosting or reselling it, editing in a browser, a share of a client's payments, a directory of professionals, a marketplace for templates, and Webforge under someone else's name                                                                                                                                                                                                           |

## 9. Sources

All read on 28 Nov 2026.

- **How many (§3.1):** ONS [Annual Population Survey by occupation](https://www.nomisweb.co.uk/datasets/aps218) and [UK Business Counts](https://www.nomisweb.co.uk/datasets/idbrent), from Nomis; the US Bureau of Labor Statistics on [web developers and digital designers](https://www.bls.gov/ooh/computer-and-information-technology/web-developers.htm).
- **What they charge and use (§3.2, §3.3):** The Admin Bar's [2024 survey of WordPress professionals](https://theadminbar.com/2024-survey/); MainWP's [care survey](https://mainwp.com/web-care-survey-2022-results/); a UK publisher's [check of design prices](https://whito.co.uk/research/website-design-costs-uk/); the [Web Almanac 2025 on content management systems](https://almanac.httparchive.org/en/2025/cms); Clutch, [the state of small-business websites 2025](https://clutch.co/resources/state-of-small-business-websites-2025).
- **Their reasons and what goes wrong (§3.3 to §3.5):** the Blocs forum on [hosting clients' sites](https://forum.blocsapp.com/t/cleaning-up-client-messes/11375); Adobe's community on [letting clients edit](https://community.adobe.com/questions-621/how-to-let-clients-edit-their-sites-cms-643311); dev.to on [editing after a site has shipped](https://dev.to/madza/how-do-you-deal-with-content-editing-after-the-site-has-been-shipped-1oad) and on [static sites for clients](https://dev.to/per-starke-642/why-i-use-jekyll-for-custom-cost-effective-web-development-and-when-its-not-the-right-choice-1kc6); Hacker News threads on [a file-based editor for clients](https://hn.nuxt.dev/item/45081752) and on [who is left when the developer moves on](https://news.ycombinator.com/item?id=45137033); Duda's [survey of agencies](https://blog.duda.co/ask-any-agency-what-their-biggest-website-building-challenge-is-and-you-ll-get-the-same-answer); a UK host on [when a web designer stops replying](https://www.365i.co.uk/news/2026/05/29/when-your-web-designer-stops-replying/); a church resource on [one person knowing the password](https://www.resourceumc.org/content/when-only-one-person-knows-the-password-a-hidden-risk-for-churches).
- **What the builders offer (§4):** Wix on [revenue share](https://support.wix.com/en/article/wix-studio-receiving-revenue-share); a [Wix Studio hand-over that went wrong](https://forum.wixstudio.com/t/wix-studio-site-transferred-to-client-who-already-had-a-prepaid-business-plan-wix-now-requiring-client-to-upgrade/62722); Hostinger on [transferring a site](https://www.hostinger.com/support/9214881-how-to-transfer-website-ownership-in-hostinger/); Realmac's forum on [Elements' price for clients' sites](https://forums.realmacsoftware.com/t/elements-pricing-for-clientss-site/46220) and [its online editor's price](https://forums.realmacsoftware.com/t/elements-cms-online-editor-pricing-announcement/56143); WebSite X5 on [its licence for client work](https://guide.websitex5.com/en/support/solutions/articles/44002545397); Pinegrow's forum on [how clients edit](https://forum.pinegrow.com/t/how-do-clients-edit-with-cms/3061); the Blocs forum on [a content editor for clients](https://forum.blocsapp.com/t/cms-for-blocs-4/17253); Publii's forum on [more than one person editing](https://forum.getpublii.com/topic/multiuser-environment/); [Webflow's price changes of May 2026](https://brixtemplates.com/blog/webflow-may-2026-pricing-changes-explained), as a third party explains them. The vendors' own plan and partner pages of Squarespace, Framer, Duda, Shopify, WordPress.com, Divi, Bricks, Pinegrow, Bootstrap Studio, Blocs, Sitely, Mobirise, EverWeb and WYSIWYG Web Builder were read for §4.1 and §4.2.
