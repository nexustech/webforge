# Who the owner is: the people who will use Webforge

**Status:** ✅ Decided 2026-11-27: WO-1 to WO-6 adopted; WO-7 not adopted ([§8](#8-decisions))
**Date:** 2026-11-27
**Question:** The spec designs Webforge for Sam, who owns a small café, salon or trades business. Is Sam who will make sites with it, and what follows if not?

**Short answer:** Sam is real, but is one of four people, and probably not the first to arrive. In the forums and reviews of the desktop builders, the largest group builds sites for other people; owners building their own are about a quarter, and hobbyists, retired people and volunteers for clubs and churches are about as many again. Most small businesses already have a site, so the usual job is replacing one, not making a first. Among owners, the trades are the largest group and the one with the fewest sites; cafés are few. Keep designing for Sam, who is the hardest to serve, and name the other three so the licence, the templates and the beta account for them. Two of the spec's assumptions have no evidence either way: that Sam is comfortable with Canva and Word, and that Sam has a computer to hand. The beta is the cheapest place to find out.

## 1. What is decided already

- **The persona** ([MVP spec §1](../../spec/02-mvp-spec.md#1-product-goal)): Sam owns a small café, salon or trades business, is comfortable with Canva, Word and maybe Wix, wants a professional site, dislikes monthly builder fees, updates opening hours and prices alone, and doesn't know what HTML or hosting are. Nothing behind it is sourced.
- **The templates:** Blank, Café, Consultant, Personal, Photographer, Salon, Shop and Trades.
- **The licence:** one person, three computers, any number of sites (SL-1); someone the owner sends a copy to works on it without a licence of their own (SL-2, UC-4). Whether one licence covers sites made for other people is not written anywhere.
- **The doubt that prompted this note:** [product/27](27-launch-and-positioning.md) found one survey in which 9 % of US owners had built their own site, and [competitors/09](../competitors/09-what-users-complain-about.md) found freelancers and relatives among the people who complain about builders.
- **Beta testers:** 10 to 20 small businesses on both systems (item 5.7, [#82](https://github.com/nexustech/webforge/issues/82)).

## 2. Method and limits

- **Official statistics** for how many businesses there are and how many have a website: the UK's Business Population Estimates, Longitudinal Small Business Survey and Business Data Survey, the US Census, Eurostat and Spain's INE.
- **Surveys** for who builds and keeps a site. Nearly all are by companies that sell websites or hosting, with US samples; each is marked in §3 and §5.
- **The users of twelve desktop builders,** from what they say of themselves in the products' forums, on Trustpilot, in the Mac App Store and on SourceForge, read on 27 Nov 2026: Sitely, RapidWeaver and Elements, WYSIWYG Web Builder, Blocs, Mobirise, WebSite X5, EverWeb, Publii, and people who came from iWeb, WebPlus and Muse. About 48 people stated what they do; most people who post say nothing of themselves.
- **This is the weakest evidence in the note.** Forums and reviews hold the keen and the professional. The owner who made one site and never posted is not counted, and nothing found says how many of them there are.
- **Could not be read:** Capterra, G2 and GetApp, which show a reviewer's role and company size; Reddit; BaseKit's 2022 report on UK micro-businesses.
- **Not found at all:** what prompts an owner to make a site; how many hours it takes; who writes the words; the relative or friend who looks after sites for others, as a number; what computer a sole trader owns.
- Nobody was interviewed. Nothing here replaces talking to owners.

## 3. The businesses

### 3.1 How many, and in which trades

| Where | Figure                                                                                                                                                               | Year       |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| UK    | 5.59 million private businesses; 4.12 million (74 %) have no employees; 1.2 million employ one to nine                                                               | start 2026 |
| UK    | With no employees: construction 692,000; professional and scientific 632,500; other services, which includes hair and beauty, 307,800; accommodation and food 86,700 | 2025       |
| UK    | Working alone and self-employed: 4.2 million; construction trades 334,000; hairdressers and related 124,000                                                          | 2024       |
| EU    | 33.1 million enterprises, 99 % with under 50 people                                                                                                                  | 2023       |
| US    | 36.4 million businesses, 30.4 million of them with no employees; construction 2.9 million of those                                                                   | 2022–23    |

All official statistics. **The trades are the large group and cafés a small one:** among UK businesses with no employees there are eight in construction for every one in accommodation and food.

### 3.2 Who has a website

| Group                        | With a website                 | Source                                 |
| ---------------------------- | ------------------------------ | -------------------------------------- |
| UK sole traders              | 76 % (65 % two years earlier)  | UK Business Data Survey 2026, official |
| UK businesses of one to nine | 84 % (74 % two years earlier)  | the same                               |
| UK construction, every size  | 65 %, the lowest of any sector | the same                               |
| Spain, under ten staff       | 37 %                           | INE 2025, official                     |
| US small businesses          | 83 % (64 % in 2018)            | Clutch 2025, a vendor's survey of 406  |

- **Most already have a site, and the rest are closing fast** in the UK: ten points in two years. The usual job is to replace or take over a site.
- **A census of Google's listings in twelve UK towns** (8,426 listings, 2026) found a third of claimed businesses with no working site: hair salons 54 %, beauty salons 53 %, plumbers 41 %, electricians 38 %, hospitality 29 %, shops 26 %. Beauty businesses linked to a booking or social page in place of a site far more than the others.
- **Why not** (871 US owners, 2023, independent): no time or resources 48 %, social media does the job 41 %, don't know how 36 %, not relevant 23 %.
- An older UK figure (about 40 % of the smallest firms in 2019) comes from a different survey and can't be read as a trend.

### 3.3 The owner

- **UK, working alone:** average age 48; half are 40 to 59; 61 % men. Businesses with no employees: 66 % run from home; 31 % have traded for over 20 years.
- **Women lead 41 % of other services** (hair and beauty among them) and 4 % of construction.
- **Using software on the web to sell or manage:** 55 % of UK businesses with no employees; 26 % in other services, 86 % in accommodation and food.
- **US:** just over half the owners of firms with employees are 55 or older.
- **Skills:** 41 % of UK sole traders had low digital capability in 2018, the latest figure found.
- **The computer:** in two vendors' surveys (2018 and undated), UK owners named the smartphone as their main tool for the business, ahead of the laptop. Nothing says how many have no computer, or whether it is a Windows PC or a Mac.

## 4. The people who use desktop builders now

### 4.1 What they say they are

Of about 48 people who said what they do:

| Who                                                             | Share      |
| --------------------------------------------------------------- | ---------- |
| Designers, freelancers and small agencies, building for clients | about 44 % |
| Owners building their own business's site                       | about 23 % |
| Hobby, personal and family sites, and retired people            | about 23 % |
| Volunteers for a club, a church or a charity                    | about 5 %  |
| Teachers                                                        | about 4 %  |

- **The owners who appear are mostly professionals and makers:** an architect, a dentist, a bookkeeper, a guest house, a luthier, a photographer. No café, salon or tradesperson spoke for themselves in what was read; a freelancer spoke of making a small site for a very small bar.
- **Read with §2's warning:** this counts who posts. It shows that the other three groups exist and are served by these products, not how large each is.

### 4.2 What they make

In four showcases (about 180 sites that could be told apart), portfolios, personal sites and clubs together outnumber local businesses in every one. Publii's 101 sites: 20 portfolios, 19 personal, 15 companies, 11 local businesses (cafés, clinics, a tattoo studio), 4 parishes and charities.

### 4.3 Why a desktop tool

1. **It is easy without code:** nearly everyone, and true of every builder.
2. **Their old tool was discontinued:** about eleven people, from iWeb, WebPlus, Muse and older ones. Sitely markets to iWeb's users directly. WebPlus's independent forum is still active.
3. **No subscription,** or a fair price paid once: about seven. Complaints about renewals and rises at three of these products: about four.
4. **Their own hosting, or changing host easily:** about four.
5. **Working offline, files on their own computer, privacy:** about three.

Nobody in what was read said they had left Wix or Squarespace over price, though [competitors/09](../competitors/09-what-users-complain-about.md) found that complaint in those products' own forums.

### 4.4 How long, and how many sites

- **They stay for years:** "since 2007", "over ten years", and tools going back to the 1990s. Three said they are retired.
- **One site is usual:** about two thirds of those who listed their sites listed one. The rest listed two to six, for a second business, family, a club or clients; one listed fifteen.

## 5. How a site gets made and kept

- **Half give up.** Of US adults who had started a site (1,000 surveyed, 2025), 51 % stopped before finishing; 29 % finished later with someone's help; 22 % never came back. A quarter met no real problem. The hardest part named was design and layout (37 %).
- **No builder publishes how many sites that are started get published.** Wix reports 304 million registered users and 6.1 million paid subscriptions.
- **Time** is the first reason owners give for having no site (§3.2). Wix's own figures have a published site taking four days from start in 2026, down from fourteen in 2022; that counts only sites that were published.
- **Owners rewrite what AI drafts:** 91 % of the users of Wix's AI builder change the text, and 69 % the pictures.
- **Content is as hard as the tool:** 70 % of 871 US owners called writing new content a challenge, 68 % keeping it up to date, 68 % making the site work.
- **Who keeps it:** 56 % of those owners maintain their site themselves.
- **Sites go stale.** In the UK census, 9 % of links from a listing led to a dead or parked site, and about one site in five with a year in its footer showed 2024 or earlier.
- **What visitors want:** the phone number, the address and the opening hours, and they expect the website to be the most accurate source (500 US consumers, 2019). Out-of-date contact details would put off half.
- **By trade,** from vendors' surveys: diners look at the menu before trying a place; salon customers prefer to book online; tradespeople get work by word of mouth and social media.

## 6. What follows for Webforge

1. **Sam exists and is the right person to design for,** because a product Sam can use is one the other three can use. But Sam is the person least likely to find Webforge, to post about it or to recommend it.
2. **Four people, not one.** Beside Sam: **the person who makes sites for others** (a freelancer, or the relative who is good with computers), who brings several sites and tells other people; **the volunteer** who keeps a club's, a church's or a charity's site; and **the person with a site of their own** for a hobby, a portfolio or a family. The licence already suits all four: any number of sites, and a copy passed to someone else to edit.
3. **Replacing is the usual job.** Three quarters of UK sole traders have a site. They arrive with words, pictures and an address that must keep working. Importing a site is out of scope; what Webforge says to them is UC-5's help page ([#1526](https://github.com/nexustech/webforge/issues/1526)). This is the strongest case for researching importing next.
4. **Among owners, the trades come first.** They are the most numerous, the furthest behind, and have a template. Hair and beauty are next, but half of them use a booking page as their site, which Webforge doesn't provide. Cafés are few.
5. **There is no template for a club, a church or a charity,** though they appear in every showcase.
6. **People from discontinued tools are looking now.** They chose a desktop tool once already, and they stay for years.
7. **Finishing matters more than starting.** Half of people who start a site stop. Whether an owner can reach a published site in the first sitting, and find their place again a week later, is worth testing directly.
8. **Two assumptions are untested:** Canva and Word, and a computer to hand. A phone-first owner is outside what a desktop app can reach, and no figure says how many there are.

## 7. Proposals

| ID   | Proposal                                                                                                                                                                                                                                                                                                                                                                     | Why                                                                                                                            | Cost                                                                                                     |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| WO-1 | **Four people in the spec.** §1 keeps Sam as the person the app is designed for, with the trades named first, and adds three it must also serve: the person who makes sites for others, the volunteer, and the person with a site of their own. No feature is added for them by this                                                                                         | §6.1 and §6.2. Decisions about the licence, templates and wording keep meeting these people                                    | A decision; a paragraph in the spec                                                                      |
| WO-2 | **One licence covers sites made for other people,** paid or unpaid: for clients, family, a club. The person who receives the site needs no licence to have it; to edit it they use UC-4's copy or their own licence. Said on the Pricing page                                                                                                                                | §4.1: the largest group that posts. Rivals charge more for this; SL-1 already says any number of sites, and leaves this unsaid | A decision; a line in the licence agreement ([#1579](https://github.com/nexustech/webforge/issues/1579)) |
| WO-3 | **Ask the testers who they are.** The beta's sign-up asks five things: what kind of business or group; whether the site is their own or for someone else; who made the site they have now, if any; what computer they use; how many sites they expect to make. Recruit across the four people, with at least two tradespeople, a volunteer and someone who builds for others | §6.8 and §2: the only way to replace this note's weak evidence with real people                                                | Within 5.7 ([#82](https://github.com/nexustech/webforge/issues/82)); no days added                       |
| WO-4 | **Watch a tester finish a site.** Two or three testers who have never made one are watched, by video call, from opening Webforge to a published site, and again a week later when they change something. What stopped them is written up                                                                                                                                     | §5 and §6.7: half of people who start stop, and no figure says where                                                           | About 1 day of the product owner's time, in the beta                                                     |
| WO-5 | **A template for a club or community group:** a home page with the next event, a page of events or fixtures, who to contact, how to join                                                                                                                                                                                                                                     | §6.5: they appear in every showcase and have no template                                                                       | To be estimated when the templates catalogue is researched                                               |
| WO-6 | **Research importing an existing site next,** ahead of the other gaps                                                                                                                                                                                                                                                                                                        | §6.3: replacing a site is the usual job, and the spec has it out of scope                                                      | A research note                                                                                          |
| WO-7 | **Write for people from discontinued tools:** one page on the website for people coming from iWeb, WebPlus or Muse, among LP-8's fortnightly pages                                                                                                                                                                                                                           | §4.3 and §6.6: the second commonest reason given for choosing a desktop builder                                                | Within LP-8; no days added                                                                               |

**Together:** about a day of the product owner's time in the beta, and decisions. Nothing changes in the app.

**Left open:** how many owners have no computer; whether Sam uses Canva and Word; how large each of the four groups is. WO-3 and WO-4 are how these get answered.

## 8. Decisions

The product owner, 27 Nov 2026. Quoted words are the answers chosen.

| ID   | Decision                                                                                                                                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WO-1 | ✅ **"Yes, four":** the spec names Sam, with the trades first, and three more people the app must also serve                                                                                                                     |
| WO-2 | ✅ **"Yes, paid or unpaid":** one licence covers sites made for other people. On the Pricing page and in the licence agreement ([#1579](https://github.com/nexustech/webforge/issues/1579))                                      |
| WO-3 | ✅ **Adopted:** five questions at the beta's sign-up, and testers recruited across the four people (5.7, [#82](https://github.com/nexustech/webforge/issues/82))                                                                 |
| WO-4 | ✅ **"Yes, in the beta":** two or three testers watched from opening Webforge to a published site, and again a week later; about 1 day of the product owner's time (5.7, [#82](https://github.com/nexustech/webforge/issues/82)) |
| WO-5 | ✅ **Adopted:** a template for a club or community group, estimated when the templates catalogue is researched                                                                                                                   |
| WO-6 | ✅ **Adopted:** importing an existing site is researched next                                                                                                                                                                    |
| WO-7 | ❌ **Not adopted.** No page for people from discontinued tools                                                                                                                                                                   |

## 9. Sources

All read on 27 Nov 2026. Some figures could be read only as search excerpts and not on the source's own page: the 2018 figure for sole traders' skills and the US owners' ages in §3.3, the undated second survey of owners' phones, and the surveys by trade in §5's last line.

- **How many businesses (§3.1):** the UK's [Business Population Estimates 2026](https://www.gov.uk/government/statistics/business-population-estimates-2026/business-population-estimates-for-the-uk-and-regions-2026-statistical-release) and [Longitudinal Small Business Survey 2025, businesses with no employees](https://www.gov.uk/government/statistics/small-business-survey-2025-businesses-with-no-employees/longitudinal-small-business-survey-2025-businesses-with-no-employees); IPSE, [the self-employed landscape 2024](https://www.ipse.co.uk/campaigns/the-self-employed-landscape/self-employed-landscape-2024); [Eurostat](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20251013-2); the US Census on [business owners](https://www.census.gov/newsroom/press-releases/2025/business-owner-characteristics.html) and [the smallest businesses](https://www.census.gov/library/stories/2025/05/smallest-businesses.html).
- **Who has a website (§3.2):** the [UK Business Data Survey 2026](https://www.gov.uk/government/statistics/uk-business-data-survey-2026/uk-business-data-survey-2026); Spain's [INE](https://www.ine.es/dyngs/Prensa/ETICCE20241T2025.htm); the [Economics Observatory](https://www.economicsobservatory.com/?p=11993) on the 2019 UK figure; Clutch, [the state of small-business websites 2025](https://clutch.co/resources/state-of-small-business-websites-2025); the census of Google's listings, [as TechRadar reported it](https://www.techradar.com/pro/a-third-of-businesses-on-google-maps-have-no-working-website-and-many-of-those-that-do-are-struggling-to-keep-them-up-to-date); Small Business Majority, [obstacles and opportunities online](https://smallbusinessmajority.org/sites/default/files/research-reports/small-businesses-face-obstacles-opportunities-growing-online-presence.pdf).
- **The computer (§3.3):** [a 2018 survey of 1,000 UK owners](https://www.djsresearch.co.uk/TelecommunicationsMarketResearchInsightsAndFindings/article/Small-business-owners-use-smartphones-for-most-of-their-business-needs-survey-finds-04203).
- **Desktop builders' users (§4):** Sitely's forum on [why people like it](https://community.sitely.app/t/dont-you-just-love-sitely/9709), [their sites](https://community.sitely.app/t/mention-your-sparkle-website/393), [their sites in 2026](https://community.sitely.app/t/mention-your-sitely-website-2026/10485) and [a site for a very small bar](https://community.sitely.app/t/small-website-for-a-very-small-bar/10523), and [its page for iWeb's users](https://sitely.app/iweb-is-long-gone-sitely-is-the-best-replacement.html); Realmac's forum on [RapidWeaver](https://forums.realmacsoftware.com/t/why-people-walk-back-when-i-mentioned-rapidweaver/41971) and [why people moved to Elements](https://forums.realmacsoftware.com/t/why-did-you-switch-to-elements/49036); WYSIWYG Web Builder's forum, [a thread of introductions](https://www.wysiwygwebbuilder.com/forum/viewtopic.php?t=101689) and [its showcase](https://www.wysiwygwebbuilder.com/forum/viewforum.php?f=17); Trustpilot on [Mobirise](https://www.trustpilot.com/review/www.mobirise.com) and [Incomedia](https://www.trustpilot.com/review/www.incomedia.eu); [Sitely's Mac App Store reviews](https://apps.apple.com/us/app/sitely-ai-website-builder/id863015334?see-all=reviews); [EverWeb on SourceForge](https://sourceforge.net/software/product/EverWeb/); [Publii's showcase](https://getpublii.com/showcase/); [Built with Blocs](https://forum.blocsapp.com/c/built-with-blocs/7); [WebSite X5 for non-profits](https://www.websitex5.com/en/create-website-npo.php); UK Business Forums on [replacing WebPlus](https://www.ukbusinessforums.co.uk/threads/software-for-producing-websites-to-replace-serif-webplus.374232/); [the independent WebPlus forum](https://punster.me/serif/); [TidBITS Talk](https://talk.tidbits.com/t/user-friendly-website-building-application/33454).
- **Making and keeping a site (§5):** All About Cookies, [web builder statistics](https://allaboutcookies.org/web-builder-statistics); [Wix's annual report for 2025](https://www.sec.gov/Archives/edgar/data/1576789/000162828026015222/wix-20251231.htm) and its [state of websites](https://www.wix.com/data/state-of-websites); [Bluehost's survey of 201 owners](https://www.bluehost.com/blog/?p=280128); BrightLocal on [websites and Google's listings](https://www.brightlocal.com/research/local-business-websites-and-google-my-business-comparison/); Clutch on [what is hard for people who build their own](https://clutch.co/press-releases/choosing-web-builder-more-challenging-using-tool-diyers).
- **Not read:** [BaseKit's 2022 report on micro-businesses](https://www.basekit.com/wp-content/uploads/2022/10/BaseKit-2022-Micro-Business-Report-Crossing-the-digital-divide.pdf).
