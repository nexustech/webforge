# A quick start for a new site

**Status:** ⏳ Proposed (QS-1…QS-8), 27 Oct 2026. The product owner's question: a wizard to create a site that asks for the site's name, a description, information about the business, the pages wanted and the preferred colours. This note compares how other builders run that first conversation, records where Webforge already stands and proposes a shape. No decision is recorded yet.

**Goal:** a first-time user answers a few questions and opens the editor on a site that is already theirs: their name, their pages, their colours, their phone number, instead of a template's sample business. Within F-SITE-1's limits (the editor opens in under three seconds) and the product's: no server, no account, nothing sent anywhere (C8, B2 deferred).

## 1. Method and limits

The flows were read from the vendors' own help pages and from hands-on reviews of 2024–2026 (sources in §7); none was run for this note, so wording, order and counts are as the sources report them and may have moved on. Bootstrap Studio, Pinegrow and RapidWeaver Elements were checked from the existing reviews ([bootstrap-studio/06](../bootstrap-studio/06-bootstrap-studio-9.md), [competitors/02](../competitors/02-pinegrow.md), [product/05](05-feature-gap-analysis.md)). The IP rule applies: patterns and the order of questions are copied, never another product's wording, screens or icons.

## 2. What others ask

| Builder | Questions, in order | What the answers become |
|---|---|---|
| **Squarespace Blueprint** | Site name; business type or "brand personality"; the home page's sections; extra pages (About, Contact and Services are suggested to everyone); a palette (four per personality); a font pairing | **Deterministic.** Each choice narrows the next, and the result is a template with the person's name on it. Nothing is written for them |
| **Jimdo Dolphin** | How to create the site (chooses the editor); business type from ten groups; up to three goals; the name; a style word (Modern, Minimal, Fresh, Dark, Natural, Elegant); favourite colours; optionally, details copied from a Google business listing | **Deterministic**, plus contact details prefilled from the listing |
| **Wix AI website builder** | A chat of four to five questions: type, name, goals, audience, products, selling point | **Generated** copy and layout, then template picks |
| **Hostinger AI builder** | Brand name; site type (store, personal, portfolio, blog); a description of up to 700 characters; optionally a colour scheme and style. Names of up to 20 characters also get a generated wordmark logo | **Generated.** The description is the prompt |
| **GoDaddy Airo** | Name; an industry inferred from it, which the person confirms; an optional description; a few follow-ups such as visual style | **Generated.** Reviewers report that skipping the description gives a site that is right for the industry and generic for the business |
| **Durable** | Business type, name, location | **Generated** in about 30 seconds. A tester found three answers too little input for a relevant site |
| **Framer, Mobirise AI** | One free-text prompt | **Generated** from a model, then edited in the tool |
| **Bootstrap Studio, Pinegrow, Elements** | Name and a template | No wizard. The desktop builders start where Webforge's New Site starts today |

**Patterns:**
- There are **two kinds of wizard.** In the *deterministic* kind (Squarespace, Jimdo) the answers pick a template, pages, a palette and fonts and fill known fields. In the *generative* kind (Wix, Hostinger, GoDaddy, Durable, Framer, Mobirise) the answers are a prompt and a model writes the copy. Reviewers praise the first for control and predictability, and fault the second when the copy comes out generic.
- **Business type comes first** everywhere, because it decides everything after it: the templates shown, the pages suggested, the palettes offered.
- **A description is only asked where something consumes it.** The generative builders feed it to a model; Squarespace and Jimdo don't ask for one at all. GoDaddy makes it optional and reviewers note what skipping it costs.
- **Pages are a ticked list** with a sensible default (Squarespace: About, Contact, Services), not a free question.
- **Colours are offered, not asked.** Squarespace shows four palettes per personality, Jimdo shows swatches; nobody asks for colours as text. Jimdo's style words stand in for taste when there are many templates to narrow.
- **Everything can be changed later**, and the flows say so (Squarespace: the name "can be changed later").
- **Short flows win.** Three answers (Durable) are too few to be specific; five or six screens (Squarespace) are the upper end that reviewers still describe as quick.

## 3. Where Webforge already stands

- **New Site** (2.14a, LF-11) already asks the site's name and theme, offers Blank and the templates filtered by business type (the seven chips of `TEMPLATE_CATEGORIES`), with a Details preview, and *Try an example* (PG-3) opens a finished café or trades site. It is the first screen of a wizard without the rest.
- **Site Settings** (1.17, F-SET-1) holds the name, a description, the language, the business name, email, phone, postal address, opening hours and social profiles. Components **bind** to these values, so a phone number typed once appears everywhere (X3). The description is the meta description, the share text and the summary in `llms.txt` (F-EX-5).
- **Theme Studio** proposes a palette from a logo or photo, computed locally (PG-2, 2.3b, merged).
- **The templates** (2.15) carry a sample business each: the café is "The Copper Kettle" with sample opening hours, a phone number and an address in its Site Settings. The sample name is **literal text** in its headings and footer (four places) rather than a bound value, so a person who creates a site from it today edits the name out by hand and retypes the contact details in Site Settings.
- **AI** is not in the MVP: a built-in assistant with the person's own account is v1.1 (GA2, GA9, BS9-10), approve-before-apply is its design rule (WF-2), and generating a starting site from a description is "Later" (G25c). Connecting AI apps over MCP (F-AI-1) is Phase 4 and reads and edits a site that already exists.
- **Onboarding** (5.4, Phase 5) plans a first-run welcome and a short guided tour: pick a template, edit text, change the theme, preview, publish.

So the deterministic wizard is almost assembled from parts that exist: New Site's first screen, Site Settings' fields and bindings, the templates' pages and the palette-from-an-image pass. What is missing is the conversation that joins them, page recipes for pages a template doesn't have, and binding or replacing the sample business in the templates. The generative wizard is not possible in the MVP without a server or a key, and the v1.1 assistant is where it belongs.

## 4. The product owner's five questions, one by one

| Asked for | Proposed reading | Why |
|---|---|---|
| **Name of website** | One field, *Business or site name*, filling Site Settings' site name and business name | Every builder asks it first or second; a small business has one name for both. Either can be changed later in Site Settings |
| **Description** | One line, *What you do*, written to Site Settings' description | It is consumed today (meta description, share text, `llms.txt`), so it earns its place. A longer description has nothing to feed until the v1.1 assistant (QS-7) |
| **Information about the business** | Business type (the existing chips) on the first screen; phone, email, address and opening hours as an optional last step | The type drives the templates and pages shown. The contact details flow into the bound values, so the footer, the Contact page and the Opening hours section are right from the first second |
| **Pages that you want** | The chosen template's pages, ticked, plus the common extras for that business type, unticked | Squarespace's pattern. A ticked list is faster and more honest than a free question: it shows what exists and what each page is for |
| **Favourite / preferred colours** | A few palettes derived from the theme presets, *From my logo* (PG-2), and a plain brand-colour picker | Colours as text can only be guessed at; colours as swatches are chosen in one click. The logo route gives the most personal result for the least typing |

## 5. Proposals

Effort is in ideal days against the current code. The target column says where the proposal would land if adopted; nothing is decided here.

| ID | Proposal | Effort | Target |
|---|---|---|---|
| QS-1 | **A four-step quick start, answers-drive-choices, no generated text.** *Your business* (type, name, what you do) → *A look* (the templates of that type as pictures, Try an example where one exists, the theme) → *Pages* (ticked list) → *Colours and details* (palettes, From my logo, brand colour; optional phone, email, address, opening hours). Every step can be skipped, every answer can be changed later, and the editor opens in under three seconds as F-SITE-1 asks. Built on the 2.21 form engine, as a dialog that follows New Site's layout (LF-11) and the start screen's reading density (SC-1) | 2.5 | MVP, a new Phase 3 item |
| QS-2 | **The sample business is replaced on creation.** Templates mark their sample business name, phone, email, address and hours; a new site gets the person's answers in those places, in the copy as well as in Site Settings, by binding the headings and footer text that carry the name to Site Settings' business name where the component allows it and substituting the rest when the site is made. Blank and the examples are unchanged (an example is meant to be someone else's finished site) | 1 | MVP, in the same item |
| QS-3 | **Page recipes per business type.** Each of the seven business types lists the pages it commonly adds beyond the template's (for the café: Menu, Gallery, Events; for trades: Services, Prices, Reviews, Areas we cover; for the consultant: Services, Testimonials, FAQ), each a short recipe of sections from the catalogue in the chosen theme, with placeholder copy in the glossary's voice. The Pages step builds them when ticked; the same recipes feed the Pages panel's *Add page* as suggestions later | 1.5 | MVP, in the same item |
| QS-4 | **The start screen's primary action opens the quick start.** SC-3's welcome keeps the three ways in; *Start a site* opens the quick start and New Site stays one link away (*Choose a template yourself*) for people who know what they want. Nothing is removed from New Site | 0.5 | MVP, in the same item |
| QS-5 | **The quick start never asks for anything the MVP can't use.** No long description, no goals, no audience, no selling point. These are the generative builders' questions and they have nothing to feed until QS-7 | – | Rule |
| QS-6 | **Opening hours and contact details are optional and last.** They are the one step a person may not have to hand (a new business, no premises yet). Skipping leaves the template's placeholders, which Site Check already flags where they would be published | – | Rule, in QS-1 |
| QS-7 | **The quick start grows a description when the assistant lands.** In v1.1, the first step gains *Tell us about your business* (a paragraph), and the assistant drafts the home page's and About page's copy from it with approve-before-apply (WF-2); G25c moves from "Later" to v1.1 as that step, not as a separate generator. Until then the field doesn't appear | – | v1.1 (replaces G25c's "Later") |
| QS-8 | **5.4's tour starts after the quick start.** The Phase 5 onboarding's guided tour drops "pick a template" and "change the theme" (the quick start did both) and starts at editing text, then preview and publish. Its estimate is reviewed when 5.4 is planned | – | Phase 5 |

**Total if QS-1…QS-4 are adopted:** 5.5 days, a new Phase 3 item (the templates and New Site are merged, 2.21 is merged, 2.3b is merged; nothing it needs is open). Phase 3's goal (preview, export and Site Check) is where the first complete sites appear, and a quick start is what turns a template into one.

**What this leaves out, and why:**
- **Style words** (Jimdo's Modern, Minimal, Fresh…) narrow a hundred templates; Webforge has eight, shown as pictures. The business type is enough of a filter.
- **A font step.** Squarespace asks; the theme already pairs fonts, and the Theme tab changes them in one click. A fifth step for a choice most small businesses won't make is not worth the time.
- **A generated logo** (Hostinger's wordmark). A logo is brand work, and generating one would need a server or a model; the logo question runs the other way in Webforge: *From my logo* takes the colours from theirs.
- **Importing a business listing** (Jimdo's Google listing). It would be the fastest way to fill the contact step, and it is a network request to a third party at the first start, against C8 and the no-external-requests promise. Not proposed.
- **A chat** (Wix). Without a model the chat is a form in costume.

## 6. Decisions

| ID | Decision |
|---|---|
| – | None yet. QS-1…QS-8 await the product owner's decision. |

Open points for the decision: whether the quick start is the start screen's primary action with New Site one link away (QS-4), or a second door beside it; how far the last step goes (palette only, or the contact details too); and whether 5.4 changes now or when it is planned (QS-8).

## 7. Sources

Squarespace:
- [Squarespace: Starting a website with Squarespace Blueprint](https://www.squarespace.com/blog/starting-a-website-with-squarespace-blueprint)
- [Website Builder Expert: I used Squarespace Blueprint AI to build a website in minutes](https://www.websitebuilderexpert.com/website-builders/squarespace-blueprint-ai/)
- [ecommerce-platforms: I created an online store with Squarespace Blueprint AI](https://ecommerce-platforms.com/?p=105677)

Jimdo:
- [TRUiC: How to make a Jimdo website](https://www.howtostartanllc.com/how-to-build-a-website/how-to-make-a-jimdo-website)
- [Tom's Guide: Jimdo website builder review](https://www.tomsguide.com/reviews/jimdo-review)
- [Website Planet: Setting up a Jimdo website](https://www.websiteplanet.com/blog/set-jimdo-website/)

Wix:
- [TechRadar: I just tried Wix's new AI website builder](https://www.techradar.com/pro/website-building/i-just-tried-wixs-new-ai-website-builder-heres-what-i-think)
- [Website Builder Expert: How to use Wix's AI website builder](https://www.websitebuilderexpert.com/website-builders/how-use-wix-ai/)

Hostinger:
- [Hostinger support: How to use Hostinger AI website builder](https://support.hostinger.com/en/articles/7266945-how-to-use-hostinger-ai-website-builder)
- [Hostinger blog: Describe your business and the AI website builder will create your site](https://hostinger.com/blog/?p=5646)

GoDaddy:
- [GoDaddy help: Airo](https://www.godaddy.com/help/airo-42245)
- [HostAdvice: How to use GoDaddy Airo (2026)](https://hostadvice.com/blog/website-builders/website-building-with-ai/how-to-use-godaddy-airo/)
- [business.com: GoDaddy Airo AI builder review](https://www.business.com/reviews/godaddy-airo-ai-builder/)

Durable, Framer, Mobirise:
- [TechRadar: Durable AI website builder review](https://www.techradar.com/pro/software-services/durable)
- [Themeisle: How to generate a website with AI](https://themeisle.com/blog/generate-a-website-with-ai/)
- [TechRadar: Framer website builder review](https://www.techradar.com/reviews/framer-website-builder)
- [Fritz.ai: Framer AI review](https://fritz.ai/framer-ai-review/)
- [CSS Weekly: Single prompt to fully functional websites using Mobirise AI](https://css-weekly.com/videos/single-prompt-to-fully-functional-websites-using-mobirise-ai)

Webforge:
- [New Site and the start screen](08-start-screen-comparison.md) (SC-1…SC-4), [the look-and-feel pass](07-look-and-feel-pass.md) (LF-10, LF-11), [the gap analysis](05-feature-gap-analysis.md) (G25a–d, GA2, GA9), [the Webflow review](../competitors/01-webflow.md) (WF-2), [the Pinegrow review](../competitors/02-pinegrow.md) (PG-2, PG-3), and [the MVP spec](../../spec/02-mvp-spec.md) (F-SITE-1, F-SET-1, F-EX-5, §5 v1.1).
