# Three small parts of a designed page

**Status:** ✅ Decided 2026-11-20 ([§4](#4-decisions)): DP-1, DP-2 and DP-3 are wanted, deferred to v1.1 or later. Recorded in [`spec/04`](../../spec/04-implementation-plan.md)'s list of v1.1 work that isn't yet items, and in [MVP spec §7](../../spec/02-mvp-spec.md#7-open-items-to-confirm) item 60.

**Date:** 2026-11-20

**The question:** the product owner's reference for Webforge's own website is a dark, one-page product site ([the trial plan, §9](../../docs/testing/own-website-with-claude-code.md#9-the-look-to-aim-for)). Of the parts that make its look, three are covered by no proposal. What would each be in Webforge?

## 1. The three parts

Seen on the reference site; all three are plain HTML and CSS, with no script.

| Part                                      | What it is                                                                                                 | Where it is seen                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **A label above a title**                 | A short line in small capitals or a monospaced font over a section's title: "How it works", "Pricing"      | Above nearly every section title on the reference site  |
| **A tag**                                 | A small rounded mark holding a word or two: a category ("SaaS · Web app"), a status ("Coming soon", "New") | On cards, beside names and prices, under showcase items |
| **A title that stays while steps scroll** | The section's title and text stay in view on one side while a numbered list scrolls past on the other      | "How it works" sections with more than four steps       |

## 2. What we have

Read from `packages/site-components/src/catalogue-data.json` and the help pages on 2026-11-20.

- **Titles.** Sections with a title share one set of title settings (the catalogue's `titled` group): a title, a subtitle below it, and their colour and size. Nothing sits above the title.
- **Tags.** Two places draw one: a highlighted Pricing plan's **Badge**, and a blog post's tags (`PostTags`). Neither can be placed anywhere else.
- **Steps.** Two layouts, _Numbered_ and _Timeline_, both with the title above the list.

## 3. Proposals

Sizes are rough ideal days.

| #        | Proposal                                                                                                                                                                                                                                                                                                                                                                                                                | Why                                                                                                                      | Size |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---- |
| **DP-1** | **A label above a section's title.** One more text in the shared title settings, so every section with a title gets it at once: empty by default, shown above the title in the theme's **Accent** font, small, in the Brand colour. Its look (capitals, colour, size) is a theme setting with the other title settings. It is not a heading, so the page's outline for screen readers and search engines doesn't change | Costs one field and reaches every section. With a monospaced Accent font it gives most of the "designed" look on its own | 1    |
| **DP-2** | **A Tag element:** a word or two in a small rounded mark, in three styles (_Outlined_, _Soft_, _Filled_) and any theme colour, with an optional link. Several in a row wrap. Pricing's Badge and a post's tags are drawn by the same part, so all three look alike                                                                                                                                                      | A status or a category has no home today except bold text. One part in place of two                                      | 1    |
| **DP-3** | **A Steps layout, _Beside the text_:** the title and text on one side, staying in view while the steps scroll past on the other. On phones the title goes above, as now. Stats already has a layout of this name                                                                                                                                                                                                        | Long lists of steps read better, and the page gets one section that isn't centred                                        | 1    |

3 days in all. Each needs its strings, a story, a help-page line and the catalogue data for AI apps regenerated; DP-1 also touches every template that should use it.

**Not proposed:** a blurred Header (HF-6 covers a see-through Header; blur is one more scroll style if it is taken); cards of uneven size and an outlined highlighted plan, which the [trial](../../docs/testing/own-website-with-claude-code.md) checks first.

## 4. Decisions

Product owner, 2026-11-20: "Write up uncovered gaps but they should be deferred until 1.1 or later".

| #    | Decision                                                          |
| ---- | ----------------------------------------------------------------- |
| DP-1 | 🕒 **Deferred to v1.1 or later:** a label above a section's title |
| DP-2 | 🕒 **Deferred to v1.1 or later:** a Tag element                   |
| DP-3 | 🕒 **Deferred to v1.1 or later:** Steps, _Beside the text_        |

None joins Phase 5. Webforge's own website is built without them for now.
