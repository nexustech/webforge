# The templates catalogue: which starting sites to add, and in what order

**Status:** 🟡 Proposed 2026-11-27: TC-1 to TC-8 await the product owner, who chose on the day to decide them later ([§8](#8-decisions))
**Date:** 2026-11-27
**Question:** Webforge ships eight templates and planned to add two to four with each release (S2). Which kinds of business and group should the next ones be for, how large should the catalogue grow, and how should it be organised?

**Short answer:** Stay small and add by kind of business, in the order of how many such businesses there are and how little a platform already does for them. Two kinds are large and have nothing: people who work at customers' homes and gardens (gardeners, cleaners), and people who sell their own time (tutors, instructors, trainers, therapists). A third is everywhere in rivals' showcases and adopted already: clubs, churches and charities, which need a business type of their own. Skip property, holiday lets and takeaways, where a platform does the job. Aim for about sixteen templates by v1.2. Rivals with thousands are not better served by them: nobody lets a site change template later, and the largest catalogues now treat a template as a prompt for AI.

## 1. What is decided and built already

- **Eight templates** (S2, [product/03](03-starting-content.md), 19 Oct 2026): Café / Restaurant, Salon / Beauty, Trades, Consultant, Photographer / Portfolio, Shop, Personal / CV and Blank. Each has three to five pages, sample text, up to ten pictures and its own theme. The plan was "B at launch, then 2–4 per release"; option C, 15 to 20 templates, was set aside as too heavy before launch.
- **Seven business types** group them, and are the site's own type in Site Settings: food and drink, beauty, trades, services, creative, shop, personal. Each type has a **More precisely** list for search engines (a plumber, an electrician, a roofer, vehicle repair and so on) and three **suggested pages** (Reviews, Prices, Areas we cover and the like).
- **The quick start** makes a site from the owner's answers, and **Café** and **Trades** also come as finished examples.
- **Pictures are public-domain or free stock,** each with its source and licence in a manifest; the legal review of stock licences was deferred, to revisit before launch if required (S5).
- **Three more are filed for v1.1** at the product owner's request (27 Nov 2026): **Repair**, a tech repair shop with a Neon theme ([#1556](https://github.com/nexustech/webforge/issues/1556)); **Restaurant**, with a photo behind its Hero ([#1557](https://github.com/nexustech/webforge/issues/1557)); and a fuller Home page for Café ([#1558](https://github.com/nexustech/webforge/issues/1558)). Each new template is put at 2.5 days, and `pnpm new-template` writes its skeleton.
- **A template for a club or community group** is adopted, to be estimated here (WO-5, [product/28](28-who-the-owner-is.md)).
- **A garage is served already:** vehicle repair is in the trades' **More precisely** list, and the Trades template and its theme were judged to suit one (AIB-4).

## 2. Method and limits

- **Twenty rivals' galleries,** read on 27 Nov 2026: ten hosted builders and ten desktop ones. A total is the vendor's own claim or a count of the gallery, and §3 says which. Jimdo's and Google Sites' galleries could not be read.
- **How many businesses of each kind,** from the ONS's counts of UK enterprises by industry (2026) and its survey of the self-employed by occupation (July 2025 to June 2026), read from Nomis. The first counts businesses registered for VAT or PAYE and misses most sole traders; the second counts people in their main job, and is an estimate. The US ranking by industry could not be had.
- **Which templates sell,** from the counts ThemeForest, Webflow, WordPress.org, HTML5 UP and One Page Love display. **These measure what freelancers and agencies buy for clients,** not what owners choose.
- **What a group's site must carry,** from regulators' and umbrella bodies' pages. Several could be read only as search excerpts; §5 says which. This is background, not legal advice.
- **Not found:** how often people search for a template by trade; what share of small-business sites are one page; any study of how people who aren't designers choose a template, or how much sample text they keep.

## 3. The rivals' catalogues

### 3.1 How large, and how organised

| Product              | Templates                                 | Organised by                                                                 | Leads with                    |
| -------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------- |
| Wix                  | Over 2,000 (its claim)                    | Type and industry, with "most popular" and "new"                             | AI, with the gallery beside   |
| Canva                | 2,363 (its count)                         | About 40 topics                                                              | Templates                     |
| Hostinger            | Over 900 (its claim)                      | About 75 narrow kinds: plumbing, roofing, dental, church                     | AI; a template feeds it       |
| Squarespace          | 201                                       | Topic and type; all one family of designs                                    | Either                        |
| Webnode              | 199 (counted)                             | 20 categories                                                                | AI on the home page           |
| Durable              | 51                                        | 10 categories, all local services                                            | AI: "no templates to fill in" |
| GoDaddy              | 16 (counted)                              | By audience; each opens its AI builder                                       | AI                            |
| EverWeb              | 247                                       | 14 categories                                                                | Templates                     |
| Mobirise             | About 220, sold singly or as a yearly kit | No categories                                                                | Templates and AI              |
| WYSIWYG Web Builder  | Over 250 (its claim), free downloads      | By release; offered as demonstrations                                        | Templates                     |
| WebSite X5           | Over 150 (its claim), more for credits    | 13 categories                                                                | Templates and AI              |
| Publii               | 35, two thirds of them paid               | Blog-led                                                                     | Templates                     |
| Bootstrap Studio     | 15, mostly paid                           | Mostly landing pages                                                         | Templates                     |
| RapidWeaver Elements | 6 with the app                            | An AI start-up, a restaurant, a spa, a consultant, a profile, a waiting list | Templates                     |

Nicepage claims over 10,000 single-page designs. Blocs' and Sitely's numbers were not found.

### 3.2 What they cover

- **In every catalogue:** food, professional services, health, and property or places to stay.
- **In all but the smallest:** a shop, a portfolio, events and weddings, education, beauty, trades.
- **Only in the large ones:** churches, vehicle repair, pets, sports clubs.
- **Where "most popular" is shown, local services lead.** Wix's opens with a roofer, car detailing, a landscaper, a hair salon, a photographer, car repair, a charity, a massage therapist, a nursery and a fitness studio. Webnode's includes a doctor, a handyman, a solicitor, an electrician and a dog walker. Squarespace's two largest topics are local business and professional services.
- **Templates are named for a trade,** with that trade's words in them: "Roofing Services", "Hair Salon".

### 3.3 What users say

- **A site can't change template later** at Wix, Squarespace, Hostinger or Webnode; Wix has an open request for it. In Webforge the theme changes at any time and the template doesn't, the same as these.
- **They look alike** (Squarespace: one family of designs).
- **Sold separately:** Mobirise, WebSite X5, Publii and Bootstrap Studio charge for most of theirs. Publii's users objected to themes licensed for six months.
- **Too few for my trade** (Webnode).

### 3.4 Templates and AI

Only Durable and Jimdo have moved the gallery out of the way. Everyone else keeps one, and GoDaddy and Hostinger now hand the chosen template to their AI builder as its starting point. Webforge already has both routes: a template, or the quick start and an AI app.

## 4. How many of each kind there are

### 4.1 UK businesses and the self-employed

Kinds Webforge has no template for, by self-employed people (ONS, 2025–26), with the registered small businesses of the nearest industry where one exists:

| Kind                                              | Self-employed | Registered businesses with under ten staff |
| ------------------------------------------------- | ------------- | ------------------------------------------ |
| Taxi and cab drivers                              | 154,700       | 9,900                                      |
| Cleaners, with window cleaners                    | 127,800       | 18,470                                     |
| Gardeners and landscape gardeners                 | 105,800       | 22,395                                     |
| Sports coaches, fitness instructors and trainers  | 75,800        | 5,460 fitness facilities                   |
| Teaching not elsewhere classed, tutors among them | 75,800        | 16,295                                     |
| Animal care, dog walkers and groomers among them  | 59,200        | no industry of its own                     |
| Psychotherapists and other therapists             | 56,600        | 25,805 in other human health               |
| Childminders                                      | 39,100        | 8,495                                      |
| Driving instructors                               | 37,700        | 2,140                                      |
| Vehicle mechanics                                 | 27,400        | 47,400 in vehicle repair                   |

For comparison, kinds a template covers now: building trades not elsewhere classed 116,900, carpenters 106,700, hairdressers and barbers 84,300, plumbers 71,200, beauticians 68,100, decorators 64,300, electricians 63,200, photographers 51,200; and by registered business, management consultancy 136,430 and restaurants, cafés and takeaways 84,270.

- **Counting people, not registered businesses, changes the order:** gardeners, cleaners, instructors and pet carers are five to twenty times more numerous than the business register shows.
- **The trades are several businesses.** One Trades template serves carpenters, plumbers, electricians, decorators and builders, each 60,000 to 117,000 strong.
- **Two shapes of business are missing.** People who visit customers' homes and gardens on a round (gardeners, cleaners, window cleaners, dog walkers), and people who sell their own time by the session (tutors, instructors, trainers, therapists). Neither is a trade with a van and a job, and neither is a consultant with corporate clients.

### 4.2 Where a platform already does the job

- **Takeaways:** Just Eat lists about 100,000 UK outlets, the same order as every restaurant and takeaway business there is.
- **Holiday lets:** 441,040 properties are listed on Airbnb, Booking.com and Vrbo, against 7,730 businesses.
- **Estate agents** live on Rightmove. **Taxi drivers** take work from apps and ranks.
- **Hair and beauty** are split: half of salons in one census had no working site, and many use a booking page ([product/28](28-who-the-owner-is.md) §3.2). A template exists.
- **Trades** find work by recommendation; a directory lists under a tenth of them. A site of their own adds most here, and construction has the fewest sites of any sector (65 %).

### 4.3 Clubs, churches and charities

About 171,000 registered charities in England and Wales, three quarters of them with income under £100,000; about 38,500 places of worship in the UK; about 10,000 village halls in England; 7,000 scout groups; 12,500 parent–teacher associations; an estimated 13,800 amateur music groups. The only total found for sports clubs is 151,000, from 2013. No rival but the largest has a category for them, and none found has one for a sports team.

### 4.4 What sells to people who build for others

- **The largest pools Webforge doesn't cover:** property, medical and dental, vehicles (mostly dealers' listings), education (mostly course platforms), fitness and wellness, and charity, church and sports club.
- **Community templates sell steadily:** the leading charity, church and sports-club themes on ThemeForest show about 10,600, 8,900 and 5,500 sales.
- **Small everywhere:** weddings and pets.
- **Much like Consultant:** law and accounting.
- **The best sellers of all are general,** not for a trade; people who build for a living reuse one design.

## 5. What a kind's site must carry

Rules that would shape a template's sample content. Each is the owner's to check; none is advice.

| Kind                           | What its site is expected or required to show                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Any UK business                | Its name, an address and an email; a company's registered details; a VAT number if registered; a total price wherever a price is offered |
| Food sold at a distance        | Allergen information before the order                                                                                                    |
| Gas work                       | The Gas Safe logo only by a registered business, with its registration number                                                            |
| Electricians                   | A scheme's logo only as the scheme allows                                                                                                |
| Solicitors                     | The regulator's number and badge; prices for certain services; how to complain                                                           |
| Accountants, dentists          | Their regulator's and professional details; dentists also each dentist's registration and the date the site was last updated             |
| Charities, income over £10,000 | That it is a registered charity; by convention its number                                                                                |
| Churches (Church of England)   | A link to safeguarding information from the home page, with who to contact (read as an excerpt)                                          |
| Sports clubs                   | A named welfare officer and the club's policies, by the governing bodies' guidance; no rule found that it must be on the website         |

**What a club's, a church's or a charity's site holds** is mostly plain content: service times or fixtures, the next events, how to join and what it costs, who is who, how to hire the hall, how to give. **What an exported site can't do alone:** fixtures and tables that follow a league, members' logins, and taking a payment or a donation. Those are a link out, as booking is for a salon.

## 6. What follows for Webforge

1. **The size is not the gap.** The desktop rivals that include templates in the price include 6 to 15, or a few hundred of uneven quality. Eight good ones, each a whole site with its own theme, is a fair start, and S2's two to four a release is the right pace. Sixteen by v1.2 covers every kind in §4 worth covering.
2. **Order by people, and by what a platform leaves undone.** That puts the home-and-garden round and the one-person service first, and property, holiday lets, takeaways and taxis last.
3. **Community needs a business type as well as a template.** A club is not food, beauty, trades, services, creative, a shop or personal, and the type is what the quick start, the suggested pages and the search-engine details hang on.
4. **A template is a kind's words as much as its look.** Rivals name templates for a trade. Webforge's **More precisely** list already knows a plumber from a roofer, but the Trades template's words are one firm's. The cheap way to serve six trades is to let the precise kind choose the sample wording, not to draw six templates.
5. **The regulated kinds need their lines.** A solicitor's, a gas engineer's or a charity's template should carry the lines §5 lists, as marked examples (5.33), so the owner sees them and Site Check lists any left unfilled.
6. **Nothing here needs a template gallery redesign yet.** The New Site dialog filters by business type; at sixteen it still fits one screen of each type. It is in the window-fit checks either way.
7. **Pictures are the slow part of a template,** and S5's deferred question about stock licences applies to every new one.

## 7. Proposals

| ID   | Proposal                                                                                                                                                                                                                                                                                                                                           | Why                                                                                         | Cost                                                                                                                          |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| TC-1 | **Sixteen by v1.2, chosen by kind.** The catalogue grows to about twelve at v1.1 and sixteen at v1.2, in §6.2's order. Each stays a whole site with its own theme and passes the same checks. Not proposed: templates sold separately, or a gallery of hundreds                                                                                    | §6.1 and §3.3                                                                               | A decision; it sets S2's "2–4 per release" for two releases                                                                   |
| TC-2 | **A Community business type,** the eighth: clubs, societies, churches, charities and halls. With its **More precisely** list (a sports club, a place of worship, a charity), its three suggested pages (Events, Join us, Hire the hall) and its place in the quick start and the New Site dialog                                                   | §6.3 and §4.3. WO-5's template has nowhere to sit without it                                | About 1.5 days, as an estimate; to check what a new type touches                                                              |
| TC-3 | **Club, the Community type's first template** (WO-5): Home with the next event, What's on, About us and who's who, Join us, Contact. Marked examples for a welfare contact and a registered charity's line. Payments, fixtures from a league and members' pages are links out                                                                      | §4.3 and §5; adopted as WO-5                                                                | 2.5 days; v1.1, after TC-2                                                                                                    |
| TC-4 | **Garden and home services,** a template for a round: a gardener, a cleaner, a window cleaner, a dog walker. Home, What I do, Prices, Areas I cover, Contact. In the trades type, with those kinds added to **More precisely**                                                                                                                     | §4.1: over 290,000 self-employed people, and no rival's small catalogue has it              | 2.5 days; v1.1                                                                                                                |
| TC-5 | **Sessions, a template for someone who sells their own time:** a tutor, a driving instructor, a personal trainer, a coach. Home, What I offer, Prices and how to book, About me, Contact. In the services type                                                                                                                                     | §4.1: about 190,000 self-employed people                                                    | 2.5 days; v1.2                                                                                                                |
| TC-6 | **Practice, a template for a therapist or a clinic:** Home, How I can help, Fees, About me, Contact and how to find the room. Calm, with marked examples for a professional body's registration                                                                                                                                                    | §4.1 (about 57,000 therapists, 26,000 small health businesses) and §3.2: in every catalogue | 2.5 days; v1.2                                                                                                                |
| TC-7 | **The precise kind chooses the words.** In the Trades template first: when the owner says plumber, electrician, decorator, roofer or garage, the sample headings, services and example lines are that trade's, with the same pages and pictures. The same mechanism later gives Community a church and a charity without new templates             | §6.4 and §3.2. One mechanism in place of several templates                                  | About 3 days for the mechanism and five trades, as an estimate; v1.2; to check against how the quick start fills a site today |
| TC-8 | **The regulated kinds' lines as marked examples:** when a template or a precise kind is one of §5's, its sample content carries the lines that kind is expected to show (a registration number, a regulator's line, an allergens note), marked as examples so Site Check lists them until they are replaced. The help makes no claim about the law | §6.5                                                                                        | About half a day with each template or kind it touches; with TC-3, TC-6 and TC-7                                              |

**Together:** v1.1 gains Club and Garden and home services beside Restaurant and Repair, making twelve, for about 6.5 days new here (TC-2, TC-3, TC-4). v1.2 gains Sessions and Practice and the trade wordings, making fourteen templates and five wordings, for about 8 days (TC-5, TC-6, TC-7). Two places to sixteen are left for what the beta's testers turn out to be (WO-3).

**Not proposed:** an estate agent, a holiday let or a bed and breakfast, a takeaway and a taxi firm (§4.2: a platform does the job); a wedding and a pet shop (small everywhere); a solicitor and an accountant of their own (Consultant, with TC-7's wording and TC-8's lines); changing a site's template after it is made.

**Left open:** S5's review of stock-photo licences, which each new template adds to; whether Church and Charity are wordings of Club (TC-7) or templates of their own, to decide once Club exists.

## 8. Decisions

| ID   | Decision                              |
| ---- | ------------------------------------- |
| TC-1 | 🟡 Proposed; awaits the product owner |
| TC-2 | 🟡 Proposed; awaits the product owner |
| TC-3 | 🟡 Proposed; awaits the product owner |
| TC-4 | 🟡 Proposed; awaits the product owner |
| TC-5 | 🟡 Proposed; awaits the product owner |
| TC-6 | 🟡 Proposed; awaits the product owner |
| TC-7 | 🟡 Proposed; awaits the product owner |
| TC-8 | 🟡 Proposed; awaits the product owner |

## 9. Sources

All read on 27 Nov 2026.

- **Rivals' galleries (§3):** [Wix](https://www.wix.com/website/templates) and its [most popular](https://www.wix.com/website/templates/html/most-popular); [Squarespace](https://www.squarespace.com/templates); [Hostinger](https://www.hostinger.com/website-templates) and its [popular](https://www.hostinger.com/templates/website/popular); [GoDaddy](https://www.godaddy.com/en-uk/website-templates); [Webnode](https://www.webnode.com/templates/); [Carrd](https://carrd.com/); [Durable](https://durable.com/website-templates) and its [relaunch](https://durable.com/blog/launch); [Canva](https://www.canva.com/websites/templates/); [Mobirise](https://mobirise.com/extensions/kit/); [WebSite X5](https://market.websitex5.com/en/templates); [Nicepage](https://nicepage.com/website-templates); [RapidWeaver Elements](https://www.realmacsoftware.com/elements/); [Bootstrap Studio](https://bootstrapstudio.io/templates); [Publii](https://marketplace.getpublii.com/themes/); [EverWeb](https://www.everwebapp.com/templates.html); [WYSIWYG Web Builder](https://www.wysiwygwebbuilder.com/templates.html).
- **What users say (§3.3):** Wix's [request for switching a site's template](https://support.wix.com/en/article/wix-editor-request-switching-an-existing-sites-template-with-content); a [Squarespace forum thread](https://forum.squarespace.com/topic/166563-switch-template-from-flatiron-70-to-bergen-71/); Hostinger on [choosing a template](https://www.hostinger.com/support/6494671-website-builder-how-to-choose-a-website-template/); reviews of [Webnode](https://www.getapp.com/website-ecommerce-software/a/webnode/reviews/) and [Mobirise](https://www.websiteplanet.com/website-builders/mobirise); Publii's forum on [paid themes](https://forum.getpublii.com/topic/how-does-the-team-choose-if-a-theme-will-be-paid-or-not/).
- **How many of each kind (§4.1, §4.3):** ONS [UK Business Counts](https://www.nomisweb.co.uk/datasets/idbrent) and the [Annual Population Survey by occupation](https://www.nomisweb.co.uk/datasets/aps218), from Nomis; the [UK Business Data Survey 2026](https://www.gov.uk/government/statistics/uk-business-data-survey-2026/uk-business-data-survey-2026); the Charity Commission's [charities by income band](https://register-of-charities.charitycommission.gov.uk/sector-data/charities-by-income-band) (as an excerpt); the [National Churches Trust](https://www.nationalchurchestrust.org/research); [ACRE on village halls](https://acre.org.uk/vibrant-village-halls/); the [Scouts' annual report](https://scouts.org.uk/about-us/our-impacts-and-reports/scouts-annual-report-2023-24/our-members); [Parentkind](https://www.parentkind.org.uk/about-us/who-are-we); [Making Music](https://makingmusic.org.uk/node/21108); the [2013 count of sports clubs](https://www.healthclubmanagement.co.uk/health-club-management-news/Report-number-of-sports-clubs-in-the-UK-reaches-151000/307313).
- **Platforms (§4.2):** [Just Eat's UK partners](https://newsroom.justeattakeaway.com/en-GB/255173-did-somebody-say-100k-lola-s-cupcakes-sends-just-eat-to-new-milestone/) (as an excerpt); VisitBritain's count of short-term lets and Checkatrade's of its trades (as excerpts).
- **What sells (§4.4):** ThemeForest's [site templates](https://themeforest.net/category/site-templates?sort=sales) and [WordPress themes](https://themeforest.net/category/wordpress?sort=sales) by sales; Webflow's [template categories](https://templates.webflow.com/categories); the WordPress.org themes directory; [HTML5 UP](https://html5up.net/); One Page Love's [gallery](https://onepagelove.com/gallery).
- **What a kind's site must carry (§5):** the Food Standards Agency on [allergens when selling at a distance](https://www.food.gov.uk/business-guidance/allergen-information-for-non-prepacked-foods-best-practice-distance-selling-and-pre-ordering); the SRA's [transparency rules](https://www.sra.org.uk/solicitors/standards-regulations/transparency-rules/); the GDC's [guidance on advertising](https://gdc-uk.org/standards-guidance/standards-and-guidance/gdc-guidance-for-dental-professionals/guidance-on-advertising); ICAEW on [the services directive](https://www.icaew.com/technical/tas-helpsheets/practice/services-directive); NICEIC's [scheme rules](https://www.niceic.com/getmedia/4a3e6d39-6835-45f4-8f06-927075e9719f/AC-Scheme-Rules.pdf); the [Charities Act 2011, s. 39](https://www.legislation.gov.uk/ukpga/2011/25/section/39); the Diocese of London on [safeguarding information on parish websites](https://www.london.anglican.org/church-and-parish-support/communications-and-digital/church-websites/safeguarding-information-on-parish-websites); the [NSPCC's Child Protection in Sport Unit](https://thecpsu.org.uk/parents/what-should-clubs-be-doing/); [Pitchero's features](https://join.pitchero.com/clubhouse/what-does-pitchero-offer-my-club); Business Companion on [company and business names](https://www.businesscompanion.info/en/quick-guides/business-information-other/company-and-business-names).
- **How people choose a template (§2, not found):** the nearest study is [Nouraei and others, CHI 2024](https://research.adobe.com/publication/thinking-outside-the-box-non-designer-perspectives-and-recommendations-for-template-based-graphic-design-tools), on posters and not websites.
