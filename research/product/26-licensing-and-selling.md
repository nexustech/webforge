# Licensing and selling: how the licence works and who takes the money

**Status:** ✅ Decided 2026-11-27: SL-1 to SL-10 all adopted, SL-5 as 14 calendar days in place of the days of use proposed ([§8](#8-decisions))
**Date:** 2026-11-27
**Question:** The price, the updates and the trial's end are decided. What is still open before licensing can be built: how many computers, how long a trial, what v1.0's users get, how a key is checked, who takes the payment, and whether a store is worth selling through?

**Short answer:** Sell one licence to a person, for three computers, with a key the app can check without a server. Give a 14-day trial and a 30-day refund. Take payment through Paddle as the seller of record, and keep the keys Webforge's own, so the payment company can be changed: Lemon Squeezy, one of the three named in the spec, is closing. Tell v1.0's users from the first day what v1.1 will ask of them. Leave the Mac App Store alone; look at the Microsoft Store as a second door.

## 1. What is decided already

Not reopened here ([MVP §8](../../spec/02-mvp-spec.md#8-business--licensing-model-decided-2026-10-19), [competitors/09](../competitors/09-what-users-complain-about.md) UC-1, plan Q10):

- **Price:** one licence, US $99, unlimited sites, no subscription and no tiers.
- **Updates:** "All updates, for good". Nothing is renewed.
- **When the trial ends, or a licence can't be checked:** "Open, export, publish; no editing".
- **Selling starts at v1.1.** The beta and v1.0 have no licence check.
- **Privacy:** the licence service gets an email, a key and an anonymous device ID, never site content.

Still open: plan Q8 (computers, the trial's length, what v1.0's users get), the provider and the licence service (the ADR in 6.0b, [#861](https://github.com/nexustech/webforge/issues/861)), and whether one licence covers the second person in UC-4's **Send a Copy to Edit…**.

## 2. Method and limits

- **Three passes on 27 Nov 2026,** all from the web; nothing was bought or installed.
  - The licence terms of eight desktop website builders (Bootstrap Studio, Pinegrow, RapidWeaver Elements, Blocs, Mobirise, Nicepage, Sitely, Publii) and seven well-liked independent desktop apps (Sublime Text, Sketch, Affinity, Nova, TablePlus, Obsidian, Scrivener), from their pricing pages, licence texts, help and forums.
  - Payment companies, licence-key services, the two desktop stores and Setapp, from their own pricing and documentation, with UK and EU rules from gov.uk, legislation.gov.uk and europa.eu.
  - Trials, refunds and what buyers say about how software is sold, from vendors' pages, forums, Trustpilot, Hacker News and press.
- **Checked again by hand:** Lemon Squeezy's closing notice, Paddle's fee and Stripe Managed Payments' fee, each on the company's own page.
- **Limits.**
  - Black Friday sales were running, so some prices are sale prices; prices are not this note's subject ([product/10](10-competitor-pricing.md) has them).
  - Several pages would not load (Affinity's pricing, TablePlus's licence help, Webflow's and GoDaddy's refund pages, Apple's sandbox page). What rests on a search summary or a third party is marked _unconfirmed_.
  - Complaints are what people chose to post, counted by separate sources read, not by users.
  - FastSpring publishes no fees. Fees change; the figures are those of the day.
  - §6 is background for a product decision, not legal or tax advice. An accountant should confirm the points it lists.

## 3. How desktop apps are licensed

### 3.1 Who and how many computers

| Product          | A licence covers                                               | Moving to another computer                            | Checking the key                                           |
| ---------------- | -------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| Bootstrap Studio | One person, three computers; Windows, macOS and Linux on a key | In the app, or a _Manage Devices_ page for a lost one | Online once at first start, then works offline for good    |
| Pinegrow         | One person, three computers                                    | Not stated                                            | Not stated                                                 |
| Elements         | One person, three Macs (raised from two)                       | In the app, a lost Mac included                       | Needs the internet to activate; re-checks not stated       |
| Blocs 7          | One, two or three Macs by tier                                 | Sign a device out from the account                    | Signing in to an account, once on each device              |
| Mobirise         | Two computers to an account                                    | Not stated                                            | An account and a code                                      |
| Nicepage         | One desktop and one laptop; a second desktop is signed out     | By signing in elsewhere                               | An account; offline after one sign-in                      |
| Sitely           | "All your Macs"                                                | Not stated                                            | A code by email, or the Apple ID                           |
| Sublime Text     | One person, every computer and system they use                 | Nothing to move                                       | A key                                                      |
| Nova             | One person, any number of Macs                                 | Not stated                                            | An account made at purchase                                |
| TablePlus        | One or two devices by tier, any system                         | A licence manager page                                | A key                                                      |
| Sketch (Mac key) | A seat                                                         | Unlink in the app or on a page                        | Must reach Sketch's servers to register and at times after |
| Scrivener        | A household: the buyer and family living with them; one system | In the app (from its forum, _unconfirmed_)            | A key; internet to activate (_unconfirmed_)                |

- **Per person, with two or three computers, is the norm.** Only Blocs, TablePlus and Sketch count devices one by one.
- **Releasing a computer without writing to anyone is common:** Bootstrap Studio, Elements, Blocs, Sketch and TablePlus all have it, and three of them cover a computer that is lost or dead.
- **The best-liked check once and then leave the buyer alone.** Bootstrap Studio says so in as many words.

### 3.2 What the money buys, and what happens after

- **Every one-off licence keeps working** when its updates end. Only pure subscriptions and paid content lock (Pinegrow's subscription, Sketch's workspace, Mobirise's and Nicepage's premium parts).
- **Most one-off licences include a period of updates:** a year (Bootstrap Studio Standard, Pinegrow, Elements, Nicepage, Sketch's Mac key, Nova, TablePlus), three years (Sublime Text) or one major version (Blocs, Sitely, Scrivener).
- **Updates for good, as Webforge has decided, is rare:** Bootstrap Studio's Lifetime tier at $59 is the one other example among the builders, and it is the tier its users praise.
- **Discounts:** students get 25 to 50 % off or a free copy at most; non-profits less often. Sublime Text and Mobirise give none.

### 3.3 Where they sell

- **Their own websites,** all of them. Paddle takes the payment for six (Bootstrap Studio, Pinegrow, Blocs, Sitely, TablePlus, Scrivener), FastSpring for Elements, Stripe for Sketch, 2Checkout for Mobirise.
- **The Mac App Store as well** for Sitely, Scrivener and Sketch's subscription. No builder was found in the Microsoft Store.

## 4. Trials and refunds

### 4.1 The kinds of trial

| Kind                                | Who uses it                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| Every feature for a number of days  | Pinegrow 14 (longer on request), Sitely 14, Nicepage 7, Nova 30, Sketch 30         |
| Days of use, not days on a calendar | Scrivener: 30 days on which the app was opened                                     |
| Free for good with limits           | Mobirise (free blocks), Nicepage Starter (two projects), TablePlus (two tabs)      |
| Build freely, but no export         | Blocs (no end date; it now gives a sample exported site), Elements (_unconfirmed_) |
| No limit, with a reminder           | Sublime Text                                                                       |
| No trial; a refund in its place     | Bootstrap Studio (30 days)                                                         |

None of the trials above is known to ask for a card. Blocs asks for an email address and consent to marketing before the download.

### 4.2 What the evidence says, and doesn't

- **Nothing published settles the length or the kind** for desktop software sold once. The one survey of desktop sellers (92 small vendors, 2009, self-reported) found no clear difference between a time limit and a feature limit.
- **Very short trials do worse** in a large set of mobile subscription apps: four days or fewer converted least, and five to 32 days about the same. Those apps hold a card and bill monthly, so it is a hint at most.
- **Sellers' own accounts** (one seller each): with a 30-day trial most sales come after it ends; well under half of those who download ever run the app; a days-of-use trial suits work done in bursts.

Webforge's owner builds a site over several evenings or weekends, then leaves it for weeks. That is the case a days-of-use trial is argued for. It is an argument, not a measurement.

### 4.3 What hosted builders have taught owners to expect

- **Free to start, no card:** Wix, Webflow, Framer and Carrd have a free plan; Squarespace gives 14 days; Hostinger a trial that can't publish.
- **What is held back until paying** is publishing or the owner's own domain, never the editing.
- **Refunds:** 14 days at Wix and, for yearly plans, at Squarespace (_unconfirmed_ for today); 30 at Hostinger and, for yearly plans, GoDaddy.

### 4.4 Refunds among the desktop apps

30 days at Bootstrap Studio, Pinegrow, Realmac and Sublime Text; 14 at Blocs, Mobirise and Nicepage; 7 at TablePlus. UK and EU buyers have 14 days by law unless they waive it for a download (§6).

## 5. What buyers complain about and praise

Ranked by the number of separate sources read.

1. **A subscription taking the place of a one-off price** (seven sources): Realmac's yearly price and its later rise, Sketch's 2021 split, a Mac mail app whose free beta ended in a subscription, Affinity's move to a free app that needs an account.
2. **Activation limits, dead computers and dead servers** (five): activation counts that support won't reset, a writing app that fell back to its trial when its licence provider's check failed, licences that stopped when a server was retired or a company closed.
3. **Refunds refused or a narrow window** (four): about a third of one builder's low reviews on Trustpilot.
4. **"Free" that isn't, and features moved behind payment** (four).
5. **Paid major upgrades** (four, with as many defending them).
6. **Add-ons, kits and templates sold beside a one-off price** (four).
7. **Renewals and price rises** (three).
8. **"Lifetime" that turns out to mean less** (three).

Three smaller lessons, one source each: Blocs cutting a licence to one Mac in 2022 was still being raised a year later; Sublime Text's anger in 2021 was at an update that installed itself and then asked for an upgrade, not at the price; an auto-renewing year of updates was called a hidden subscription.

**Praised:** keeping the version paid for, for good; one licence across computers and systems; releasing a computer and finding a lost key without writing to support; a held price for existing customers.

**When a free product starts charging** (five cases): a deadline with a day's notice and a change of model drew anger (the mail app above); a low one-off price drew grumbling that passed (Typora); a larger discount for beta testers in a short window drew none found (Affinity Publisher, 30 % against 20 %); a five-month notice for a change that spared small users still drew noise (Docker Desktop).

## 6. Who takes the money

### 6.1 Seller of record, or not

A **seller of record** (the trade calls it a merchant of record) is the company the buyer legally buys from. It charges and pays over VAT and sales tax in each country, sends the invoice, handles card disputes and answers billing questions. Without one, a UK business selling a download to EU consumers must register for VAT in the EU (one registration under the non-Union scheme, with a return every quarter), keep evidence of where each buyer lives, and deal with other countries' and US states' rules itself.

### 6.2 The companies

What the seller keeps is worked for a $99 sale with no tax added, a US buyer and a UK seller. Tax-inclusive sales keep less, since some fees are taken on the total.

| Company                     | Seller of record | Fee on a one-off sale                                             | Keeps of $99 | Licence keys                                | Notes                                                                                                                                                     |
| --------------------------- | ---------------- | ----------------------------------------------------------------- | ------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Paddle**                  | Yes              | 5 % + 50¢                                                         | about $93.55 | None: issued from its purchase webhook      | Cards, PayPal, Apple Pay, Google Pay and local methods; a price for each country; paid monthly, £100 least; reviews the seller's website before approving |
| **Stripe Managed Payments** | Yes              | 3.5 % on the total with tax, plus card fees (3.15 % + 20p abroad) | about $92.15 | None                                        | Open to all since April 2026. No PayPal; the buyer sees "Sold through Onelink"; Stripe may refund without asking                                          |
| **Stripe with Stripe Tax**  | No               | Card fees, plus 0.5 % where registered                            | about $95    | None                                        | The VAT is the seller's to register for, file and pay                                                                                                     |
| **Polar**                   | Yes              | 5 % + 50¢, plus 1.5 % on non-US cards, plus payout fees           | about $93    | Built in, with limits and a customer's page | No PayPal; holds new money seven days; a young company                                                                                                    |
| **Dodo Payments**           | Yes              | 4 % + 40¢, plus 1.5 % outside the US                              | about $94    | Built in                                    | PayPal costs 3 % more; fees on payouts, refunds and disputes; a young company                                                                             |
| **Gumroad**                 | Yes              | 10 % + 50¢, plus card fees                                        | about $85    | Keys with a use count, no device limit      | Its own shop page                                                                                                                                         |
| **FastSpring**              | Yes              | Not published                                                     | Not known    | Key lists or a script; no activation        |                                                                                                                                                           |
| **Lemon Squeezy**           | Closing          |                                                                   |              |                                             | Closed to new sellers on 16 Nov 2026; stops taking payments on 31 Mar 2027. Stripe, its owner, points to Managed Payments                                 |

- **The spec names "Paddle, Lemon Squeezy, or Stripe with tax handling".** The second is gone and the third leaves the VAT with the seller, so the choice is Paddle or Stripe Managed Payments.
- **No company offers a trial for a one-off product.** The trial lives in the app.
- **Keys built into a payment company tie the licence to it.** Lemon Squeezy's sellers who used its keys now have four months to move both.

### 6.3 Licence-key services, or Webforge's own

| Route               | Cost                                            | Works offline              | Notes                                                                                           |
| ------------------- | ----------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| **Keygen** (hosted) | Free to 100 users, then $299 a month for 10,000 | Yes, signed keys and files | The server can be self-hosted under a licence that is not open source; nothing ships in the app |
| **Cryptlex**        | From $100 a month                               | Yes                        | Its client library's licence is _unconfirmed_                                                   |
| **LicenseSpring**   | Free to 100 licences, then $199 a month         | Yes                        |                                                                                                 |
| **Keyforge**        | $199 once for 2,000 licences, or $39 a month    | Yes, signed tokens         | Works with Stripe and Polar; Paddle isn't listed                                                |
| **Webforge's own**  | A small service on a host with a free tier      | Yes, by design             | A key signed by Webforge and checked in the app with a public key; no dependency to license     |

A monthly fee of $100 to $300 is one to three sales a month before the first sale is made. The service 6.0b already describes is small: make a key when the payment company says a sale happened, count the computers, mark a refund.

### 6.4 The stores

- **Microsoft Store.** An app that takes its own payment keeps all of it; Microsoft's payment costs 15 %. An app packaged as MSIX is signed and delivered by the Store at no cost, which bears on risk R1 and question Q3 (Windows signing). An ordinary installer listed in the Store must still be signed by the seller. How a Store copy would update, and whether MSIX suits an app that keeps files anywhere and runs a preview server, is not established here.
- **Mac App Store.** 15 % under the small business programme. Apps must be sandboxed, update only through the store, and may not use licence keys or their own unlock. That is a second build of the app with its own licensing.
- **Setapp.** macOS only; pays by use among subscribers, or 75 % of a one-off sale.

### 6.5 Law and tax, in brief

- **The right to cancel.** A UK or EU consumer buying at a distance has 14 days to cancel. For a download it ends at once only if the buyer agreed to that and acknowledged losing the right, and the confirmation repeats both. A seller of record puts this in its own checkout.
- **A refund promise longer than 14 days** is the seller's own, on top of the law.
- **For an accountant to confirm:** how the sale from Webforge to the seller of record is treated for UK VAT, whether to register for UK VAT, the wording of the refund terms, and whether a small business buying for itself counts as a consumer.

## 7. Proposals

| ID    | Proposal                                                                                                                                                                                                                                                                                                                                                        | Why                                                                                                                                                                                                               |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SL-1  | **A licence is for one person, on up to three computers at a time,** Windows and macOS on the same key. Nothing is counted but computers in use                                                                                                                                                                                                                 | What Bootstrap Studio, Pinegrow and Elements give. Fewer drew a year of complaints at Blocs; unlimited leaves a key shared freely                                                                                 |
| SL-2  | **The second person works on the same licence.** Someone the owner sends a copy to (UC-4) uses one of the three computers. The licence is the business's, as Scrivener's is a household's                                                                                                                                                                       | An owner and the person who helps with the site are the commonest pair. A second $99 for a helper would be the add-on the complaints are about                                                                    |
| SL-3  | **Release a computer and find a key without writing to anyone.** _Use the licence on another computer_ in the app; a page that lists the computers and releases one that is lost; _Send my key again_ by email                                                                                                                                                  | The second-largest complaint, and what is praised where it exists. It also keeps support near nothing for one person                                                                                              |
| SL-4  | **The app checks the key by itself.** A key signed by Webforge, checked in the app. The internet is needed once, to count the computer. After that nothing can turn a paid app back into a trial: a later check only learns of a refund, and failing to reach the service changes nothing. If the service ever closes, a last version needs no check            | Replaces §8's "re-check with a 30-day grace period". A check that fails has locked paying users elsewhere, and a server that closes has ended licences                                                            |
| SL-5  | **A 14-day trial counted in days of use,** every feature, no card, no account and no email asked. The app shows how many days are left                                                                                                                                                                                                                          | Seven days is the shortest found; 14 is what Pinegrow, Sitely and Squarespace give. Days of use suits a site built over several weekends. The evidence does not settle it                                         |
| SL-6  | **A 30-day refund, no reason asked,** in the same words on the website, at the checkout and in the help                                                                                                                                                                                                                                                         | Four of the best-regarded give 30. Refusals are the third-largest complaint. With "open, export, publish" kept after a refund's key is marked, the cost of abuse is small                                         |
| SL-7  | **Paddle takes the payment, as seller of record; the keys stay Webforge's.** Stripe Managed Payments is the second choice. The ADR in 6.0b records it. Apply as soon as the website has its pricing, terms and refund pages, since Paddle reviews them                                                                                                          | Six of the desktop rivals use Paddle; it takes PayPal, and prices by country. Owning the keys means the payment company can be changed, which Lemon Squeezy's closing shows is needed                             |
| SL-8  | **Webforge's own small licence service,** as 6.0b describes, not a key service with a monthly fee                                                                                                                                                                                                                                                               | $100 to $300 a month is one to three sales before any are made, for a service that makes a key, counts three computers and marks a refund                                                                         |
| SL-9  | **v1.0's users are told from the start, and nothing they have is taken.** v1.0 says in its About and on the website that it is free until v1.1 and what v1.1 will cost. v1.0 never stops working. The update to v1.1 says, before it installs, that it starts a trial. Beta testers who sent feedback get a licence; other v1.0 users a lower price for 60 days | The cases that went badly gave a day's notice or changed the deal; the one that went quietly gave early users more than everyone else. An update that installs and then asks for money was Sublime Text's mistake |
| SL-10 | **Stores: not the Mac App Store; look at the Microsoft Store.** A half-day look at whether an MSIX copy in the Microsoft Store, taking payment through Webforge's own checkout, would give Windows signing and a second place to be found                                                                                                                       | The Mac App Store forbids licence keys and the app's own updates. The Microsoft Store takes nothing from an app with its own payment, and signs MSIX packages, which is risk R1                                   |

### 7.1 What the proposals leave for the product owner

- **The discount for v1.0's users in SL-9,** if any. Affinity gave beta testers 30 % against 20 % for everyone.
- **Whether the price includes tax.** UK and EU consumers must be shown a price with VAT in it. Either $99 is the price before tax, and a UK buyer pays about a fifth more, or one round price includes it and Webforge keeps about a sixth less there.
- **Discounts for students and charities.** Most rivals give one; "one number" argues for none. Not proposed.

### 7.2 What it would change in the plan

- **6.0a ([#860](https://github.com/nexustech/webforge/issues/860)), 4 days:** the 14-day trial, the signed key checked in the app, and _Use the licence on another computer_. Its "quiet re-check with a 30-day grace period" goes. About the same size.
- **6.0b ([#861](https://github.com/nexustech/webforge/issues/861)), 4 days:** adds the page that lists and releases computers and _Send my key again_. About one day more.
- **A new lead-time item:** Webforge's website with its pricing, terms and refund pages, which Paddle's review needs before the first sale. No note covers the website yet.
- **v1.0, in Phase 5:** nothing. The line in About that SL-9 asked for was withdrawn (§8): the app gives no price.
- **The help** says nothing of licences until licensing is built (product owner, 26 Nov 2026).

## 8. Decisions

Product owner, 2026-11-27: all ten adopted, with the choices below. Recorded in `spec/02` §8 and §7 (item 74) and in the plan (`spec/04` §3's scope-change line, §4, Phase 6 and Q8).

| ID    | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SL-1  | ✅ **"Three":** one person, up to three computers at a time, Windows and macOS on the same key                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| SL-2  | ✅ **"No, same licence":** the person an owner sends a copy to works on the owner's licence, on one of the three computers                                                                                                                                                                                                                                                                                                                                                                                                     |
| SL-3  | ✅ **Adopted:** releasing a computer in the app and on a page, a lost one included, and _Send my key again_ by email. In 6.0a ([#860](https://github.com/nexustech/webforge/issues/860)) and 6.0b ([#861](https://github.com/nexustech/webforge/issues/861))                                                                                                                                                                                                                                                                   |
| SL-4  | ✅ **Adopted:** a signed key the app checks itself; the internet once; no check that can turn a paid app into a trial. Replaces §8's re-check with a 30-day grace period                                                                                                                                                                                                                                                                                                                                                       |
| SL-5  | ✅ **"14 calendar days",** not the days of use proposed: every feature, no card, no account. Seven days until now                                                                                                                                                                                                                                                                                                                                                                                                              |
| SL-6  | ✅ **"30 days":** a refund with no reason asked                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| SL-7  | ✅ **"Paddle"** as seller of record, the keys Webforge's own; Stripe Managed Payments the second choice. The ADR is 6.0b's                                                                                                                                                                                                                                                                                                                                                                                                     |
| SL-8  | ✅ **Adopted:** Webforge's own licence service                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| SL-9  | ✅ **"Testers free, others discount", at "30% off"** for 60 days, and v1.0 never stops working. **Not said in the app:** the product owner then ruled that the app and its help give no price and make no claim about one, as these could change before selling starts (product owner, 2026-11-27). So the notice to v1.0's users goes on the website, and [#1554](https://github.com/nexustech/webforge/issues/1554) (About and the README) is withdrawn. The warning before the update to v1.1 is 6.0a's, and names no price |
| SL-10 | ✅ **Adopted:** not the Mac App Store; a half-day look at the Microsoft Store ([#1555](https://github.com/nexustech/webforge/issues/1555), Phase 5)                                                                                                                                                                                                                                                                                                                                                                            |

Also decided the same day:

- **Tax:** "$99 before tax". A buyer in the UK or the EU is shown one price with VAT in it, about a fifth more.
- **Students, teachers and charities:** "None". One price for everyone.
- **Nothing about price in the app or its help.** No price, discount, trial length or refund term is written into the app's wording or the help pages, and neither makes a claim about them, as these could change before selling starts (product owner, 2026-11-27). They live on the website and at the checkout, which can change without a release; the app links there.

Still to do, and not an item yet: Webforge's own website with its pricing, terms and refund pages, which Paddle reviews before approving a seller (`spec/04` §4).

## 9. Sources

All read on 27 Nov 2026.

- **Desktop builders' terms:** Bootstrap Studio ([licence](https://bootstrapstudio.io/pages/license), [questions](https://bootstrapstudio.io/contact-us)); Pinegrow ([trial](https://pinegrow.com/docs/licensing-questions/how-to-try-pinegrow-for-free-for-14-days/), [refunds](https://pinegrow.com/docs/licensing-questions/money-back-policy/), [EULA](https://pinegrow.com/Pinegrow_EULA.pdf)); Realmac ([licensing](https://docs.realmacsoftware.com/buying-and-billing/licensing.md), [before buying](https://docs.realmacsoftware.com/buying-and-billing/pre-sales.md)); Blocs ([pricing](https://blocsapp.com/pricing/), [activating](https://help.blocsapp.com/knowledge-base/activate-blocs/), [releasing a device](https://help.blocsapp.com/knowledge-base/deactivate-device/)); Mobirise ([kit](https://mobirise.com/extensions/kit/), [terms](https://mobirise.com/terms.html)); Nicepage ([plans](https://nicepage.com/premium), [trial limits](https://nicepage.com/doc/4720/trial-limitations)); Sitely ([store](https://sitely.app/store/)); Publii ([licence](https://getpublii.com/license/)).
- **Other desktop apps:** Sublime Text ([sales questions](https://www.sublimehq.com/sales_faq)); Sketch ([pricing](https://www.sketch.com/pricing/), [restricted networks](https://www.sketch.com/support/mac-only-licenses/restrictive-network/)); Nova ([buying](https://nova.app/buy/), [questions](https://help.nova.app/faqs/purchasing/)); TablePlus ([pricing](https://tableplus.com/pricing)); Obsidian ([licence](https://obsidian.md/help/teams/license)); Scrivener ([how its licensing works](https://www.literatureandlatte.com/how-our-licensing-works)).
- **Trials and what converts:** [Types of free trial for software](https://successfulsoftware.net/2011/09/19/types-of-free-trial-for-software/) (the 2009 survey); [RevenueCat on trial length](https://www.revenuecat.com/blog/growth/free-trial-length) (mobile subscriptions).
- **Complaints and praise:** Realmac's forum on [its pricing poll](https://forums.realmacsoftware.com/t/rapidweaver-elements-pricing-poll/43466) and [its price rise](https://forums.realmacsoftware.com/t/rapidweaver-elements-pricing-update/47367); Blocs's forum on [one Mac per licence](https://forum.blocsapp.com/t/blocs-5-two-macs/18642); [Sketch's 2021 change](https://www.theregister.com/2021/05/12/sketch_mac_updates/); Scrivener's forum on [a failed licence check](https://forum.literatureandlatte.com/t/unable-to-verify-your-activation-for-more-then-two-months/46913); Trustpilot on [Nicepage](https://www.trustpilot.com/review/nicepage.com?stars=1&stars=2) and [Mobirise](https://www.trustpilot.com/review/mobirise.com); a [Hacker News thread of desktop sellers](https://news.ycombinator.com/item?id=42764185).
- **Free, then charged:** [Mimestream's launch](https://www.mimestream.com/pricing); [Typora 1.0](https://support.typora.io/What's-New-1.0/); [Affinity Publisher's beta discount](https://www.creativebloq.com/news/serif-gives-beta-testers-30-off-affinity-publisher); [Docker Desktop](https://www.docker.com/press-release/docker-updates-product-subscriptions/).
- **Payment companies:** [Paddle's pricing](https://www.paddle.com/pricing), [payouts](https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid) and [digital products](https://developer.paddle.com/get-started/how-paddle-works/digital-products); [Lemon Squeezy's closing notice](https://www.lemonsqueezy.com/blog/saying-goodbye-to-lemon-squeezy); Stripe Managed Payments ([how it works](https://docs.stripe.com/payments/managed-payments/how-it-works), [fees](https://support.stripe.com/questions/managed-payments-pricing?locale=en-GB)) and [Stripe's UK pricing](https://stripe.com/gb/pricing); Polar ([fees](https://polar.sh/docs/merchant-of-record/fees), [licence keys](https://polar.sh/docs/features/benefits/license-keys)); Dodo Payments ([pricing](https://dodopayments.com/pricing)); Gumroad ([fees](https://gumroad.com/help/article/66-gumroads-fees)); [FastSpring](https://fastspring.com/pricing/).
- **Licence-key services:** [Keygen](https://keygen.sh/pricing/) and [its licence](https://keygen.sh/license/); [Cryptlex](https://cryptlex.com/pricing); [LicenseSpring](https://licensespring.com/pricing); [Keyforge](https://keyforge.dev).
- **Stores:** Microsoft ([why the Store](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/why-distribute-through-store), [installer requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-package-requirements)); Apple ([small business programme](https://developer.apple.com/app-store/small-business-program/), [review guidelines](https://developer.apple.com/app-store/review/guidelines/)); [Setapp](https://docs.setapp.com/docs/setapp-marketplace-overview).
- **Law and tax:** [the UK's cancellation rule for downloads](https://www.legislation.gov.uk/uksi/2013/3134/regulation/37); [gov.uk on online selling](https://www.gov.uk/online-and-distance-selling-for-businesses/online-selling); [gov.uk on VAT for digital services](https://www.gov.uk/guidance/the-vat-rules-if-you-supply-digital-services-to-private-consumers); [the EU's one-stop shop](https://vat-one-stop-shop.ec.europa.eu/one-stop-shop/declare-and-pay-oss_en).
