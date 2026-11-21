# Trial: Webforge's own website, built with Claude Code

Can Webforge, driven by Claude Code through [AI apps](../help/ai-apps.md), build Webforge's own website? This is the plan for trying it, and for writing down where it is hard. The friction found is the result, as much as the site.

**Who runs it:** the product owner.
**Where:** any computer with Webforge and Claude Code. Someone has to be at it: Webforge asks before changes that reach every page, and only a person can choose pictures.
**How long:** half a day, pictures included.
**Issue:** [#1230](https://github.com/nexustech/webforge/issues/1230): post the log there.

The gaps known before the trial are in [§6](#6-gaps-known-before-the-trial). Two of them have proposals of their own: [running AI apps unattended](../../research/product/19-ai-apps-unattended.md) (UA-1…UA-6) and [the Header and Footer](../../research/product/20-header-and-footer.md) (HF-1…HF-7).

## 1. The site

Five pages, in English, on a template close to a product site (choose in **Start a Site**; none is made for software).

| Page         | What it holds                                                                                                                                                                     | Sections to use                              | Where the content comes from                                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Home**     | What Webforge is in one line, a screenshot of the editor, three or four reasons to choose it, a button to Download                                                                | Hero, Features, Text + Image, Call to action | [MVP spec](../../spec/02-mvp-spec.md) §1; the product in one line in `CLAUDE.md`                                                                             |
| **Features** | The core features, each with a screenshot: templates and Start a Site, editing on the page, themes, Site Check, export and publish, AI apps                                       | Text + Image (several), Features, Gallery    | The help pages in [`docs/help/`](../help/README.md)                                                                                                          |
| **Compare**  | Webforge beside the hosted builders and the desktop tools, at a high level: who owns the site, what it costs over three years, whether it works offline, where the site is hosted | Text, Table, FAQ                             | [Where Webforge stands](../../research/competitors/03-comparison-2026-11.md), [What the competitors charge](../../research/product/10-competitor-pricing.md) |
| **Pricing**  | One licence, US $99, unlimited sites, a 7-day trial; what is included; questions                                                                                                  | Pricing (one plan), FAQ                      | [MVP spec §8](../../spec/02-mvp-spec.md#8-business--licensing-model-decided-2026-10-19)                                                                      |
| **Download** | A button each for Windows and macOS, and what the computer needs                                                                                                                  | Text, Call to action                         | [`docs/releasing.md`](../releasing.md)                                                                                                                       |

**Download buttons go nowhere yet.** Every "Download" button elsewhere links to the Download page. On the Download page itself, leave the two buttons without a link and note what Webforge and Site Check make of that (see the log, row 4).

**Comparison rules.** Name competitors by what they are and what they charge, with the month the price was read. No competitor's logo, screenshot or wording.

## 2. Before you start

1. **Webforge:** `main` as it is on the day (`pnpm install`, then `pnpm dev`), or the newest build. Write down the commit or version.
2. **Claude Code:** installed and signed in.
3. **Pictures, in one folder,** as PNG or JPEG:
   - the logo (from `apps/desktop/branding`);
   - six screenshots of the editor at 1600×1000 or larger, in the dark or the light look, not both: the start screen with the templates; a page being edited with the Edit panel open; Theme Studio; Site Check with findings; the Preview on Desktop and Mobile; the Export or Publish dialog.

   Take them from a site made from a template, not from a real customer's.
4. **A folder for the exported site,** outside the repository.

## 3. Connecting Claude Code

As [AI apps › Claude Code](../help/ai-apps.md#claude-code) says: **File › AI Apps…**, tick **Let AI apps connect**, **Add AI App**, **Claude Code**, run the copied command, set `WEBFORGE_KEY` in the same terminal, start Claude Code within 5 minutes. `/mcp` lists `webforge` as connected.

Start Claude Code in the repository's folder, so it can read the spec, the help pages and the research notes for the content.

## 4. The steps

Give Claude Code one step at a time, and stay at Webforge while it works. After each, note the time and what happened in the log.

1. **Start the site.** "Start a new site in Webforge for Webforge itself: a desktop website builder for small-business owners. Pages: Home, Features, Compare, Pricing, Download. Read `spec/02-mvp-spec.md` §1 and §8 first." Check **Start a Site**, then **Create Site**.
2. **Build the pages.** "Build out the five pages as one plan. Take the features from `docs/help/`, the comparison from `research/competitors/03-comparison-2026-11.md` and `research/product/10-competitor-pricing.md`, and the price from the MVP spec §8. Invent no facts, customers or quotes. Every Download button links to the Download page; the two buttons on the Download page have no link." Read what the plan says it will do before **Allow**.
3. **Pictures.** "Ask me for the logo and six screenshots, then place each where it belongs, with a description for people who can't see it." Choose them in **Add Files…**.
4. **Theme.** "Set the theme's colours to match the logo, and check the contrast."
5. **Header and Footer.** "Set the Header to the layout with a button, with Download as the button, and write the Footer's text." Note what you wanted here and couldn't have.
6. **Check.** "Run Site Check and fix what you can. List what is left for me."
7. **Look.** "Open the Preview." Look at every page on Desktop and Mobile.
8. **Export** yourself (**File › Export…**) to the folder from §2, and open `index.html` from disk.

## 5. The log

One row for each thing that slowed you down, surprised you or couldn't be done. Copy this table into a comment on the issue.

| #   | Step | What happened | What you expected | How bad (blocked / slow / cosmetic) |
| --- | ---- | ------------- | ----------------- | ----------------------------------- |
| 1   |      |               |                   |                                     |

Rows to fill in whatever else happens:

1. How many times Webforge asked **Allow**, and whether any question ran out (60 seconds) before you answered.
2. How long Claude Code waited after a question ran out or was declined.
3. Pictures: how many times you were asked, and whether each landed in the right place.
4. A button with no link: what the editor, Site Check and the exported page do with it.
5. Anything Claude Code asked for that AI apps has no tool for.
6. Anything it wrote that isn't true of Webforge.
7. The whole trial's time, and how much of it was yours.

## 6. Gaps known before the trial

Read from the code and the help pages on 2026-11-20; the app wasn't run.

| #   | Gap                                                                                                                                                                                                      | What to do in the trial                            | Proposal                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------- |
| 1   | **It can't run unattended.** Changes that reach every page wait for **Allow**; a question nobody answers in 60 seconds counts as a refusal, and the app must then wait 15 seconds, doubling to 5 minutes | Stay at the computer                               | UA-1…UA-3, adopted           |
| 2   | **Pictures need you each time.** An app can't add a file; it asks, and you choose in **Add Files…**                                                                                                      | Have the folder ready                              | UA-4                         |
| 3   | **No export or publish for an app**                                                                                                                                                                      | Export yourself                                    | UA-5                         |
| 4   | **The Header takes no logo and no element.** It shows the site's name as text, the menu, and in one layout the menu's last link as a button. The Footer is one text and the menu's links                 | Use the layout with a button; note what is missing | HF-1, HF-2 and HF-4, adopted |
| 5   | **A link must go somewhere.** `#` isn't a link, and an example address stops publishing                                                                                                                  | Buttons with no link on Download                   | none yet: see the log, row 4 |
| 6   | **No template for a software product**                                                                                                                                                                   | Choose the nearest                                 | none                         |
| 7   | **No Custom Code or stylesheet for an app**                                                                                                                                                              | Do without                                         | none: decided (F-AI-1)       |
| 8   | **No set of screenshots of the editor** kept for marketing                                                                                                                                               | Take the six in §2                                 | none                         |

## 7. Done when

- the exported site opens from disk, with all five pages, its pictures and working links between pages;
- Site Check shows no _Must fix_ other than what the missing download links cause;
- the log is on the issue, and each row that should become work has an issue of its own or a line saying why not.

## 8. The look to aim for

The product owner's reference, 2026-11-20: [pixelcrew.ai](https://pixelcrew.ai), for its look and feel, not to copy. Looked at in a browser that day; nothing of its code, pictures or wording is used.

**What makes that look:** one long page on black, off-white text and a single bright accent (used only for the main button, the highlighted plan and small marks); a very large, tight headline in a plain geometric sans; small labels, tags and file names in a monospaced font; thin borders and rounded corners on dark cards in place of shadows; a framed screenshot of the product under the headline; a fixed, see-through Header with a logo, five links and one button; and a Footer of labelled columns with a line below. No gradients and no animation.

| #   | Part of the look                                                                  | Webforge today                                                                                                                                                         | Gap                                                              |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Black page, one accent, thin borders, no shadows                                  | ✅ The Dark theme, with Brand, Surface, **Card style**, **Border width** and **Shadows** set in the theme                                                              | none expected; check black as Surface passes the contrast checks |
| 2   | Headline about 100 px, letters set tight                                          | 🟡 **Text sizes** and **letter spacing** for headings are theme settings                                                                                               | their largest size and tightest spacing aren't known: try it     |
| 3   | A plain geometric sans, with a monospaced font for labels                         | 🟡 Inter, Manrope and Figtree come with Webforge, and JetBrains Mono can be the theme's **Accent** font. Geist isn't among the fifty; **Browse All Fonts** may have it | none if a near font will do                                      |
| 4   | Small label above a title ("How it works")                                        | ❌ sections have a title and a text, no label above                                                                                                                    | **a label above a section's title**                              |
| 5   | Tags and status marks ("SaaS · Web app", "Runs second")                           | ❌ no tag or badge element; only Pricing's badge                                                                                                                       | **a Tag element**                                                |
| 6   | Header: logo, menu, one button, see-through and blurred                           | 🟡 fixed Header with a style change on scroll; no logo, the button is the menu's last link, no blur                                                                    | HF-1, HF-2 (adopted); HF-6 or a _Blurred_ scroll style           |
| 7   | A framed screenshot under a centred headline                                      | ✅ Hero, _Centred, image below_; the image takes a border and corners                                                                                                  | none expected                                                    |
| 8   | Cards of uneven size holding mixed content (a tall card beside two short ones)    | 🟡 Columns hold elements; Features has _Cards_                                                                                                                         | whether a column can be a card, and columns uneven: try it       |
| 9   | A heading that stays put while a numbered list scrolls beside it                  | 🟡 Steps, _Numbered_ or _Timeline_                                                                                                                                     | **the text beside, staying in view** (a Steps layout)            |
| 10  | Showcase cards: a large picture beside a title, text and tags, in a bordered card | 🟡 Text + Image, left or right                                                                                                                                         | a card frame around it, and tags (row 5)                         |
| 11  | Three plans, one outlined in the accent                                           | ✅ Pricing, _Cards_, **Highlight this plan**                                                                                                                           | highlighted as a border, not a fill: check the look              |
| 12  | Footer: logo and line, three labelled columns of links, a bottom line             | ❌ one text and the menu's links                                                                                                                                       | HF-4 (adopted); HF-5 (not taken) is the bottom line              |
| 13  | One page, the menu jumping to its sections                                        | ✅ one-page sites, with the section in view highlighted                                                                                                                | none; but §1 plans five pages: choose one                        |

**Three gaps that no adopted proposal covers:** the label above a title (4), the Tag element (5) and Steps with its text staying in view (9). They are proposals DP-1 to DP-3 in [Three small parts of a designed page](../../research/product/21-designed-page-parts.md), deferred to v1.1 or later, so the trial does without them.

**For the trial:** ask Claude Code for this look in step 4 ("black Surface, off-white text, one bright Brand colour, thin borders, no shadows, a monospaced Accent font"), and record rows 2, 8 and 11 in the log.
