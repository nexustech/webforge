# Styling a site with AI

**Status:** 🟡 For decision (AS-1…AS-12). Nothing here is decided or in the plan.

**Date:** 2026-11-21

**The question,** from the product owner: "When developing a website using AI themes and styling is likely to be something that the user relies on AI for what enhancements can we make here".

**The short answer:** an AI styles a Webforge site almost blind today, and with the theme's raw values as its only words. Styling with AI is a loop of five parts: a brief, a proposal, seeing the result, a nudge, and keeping it. Webforge has the last part and little of the first four.

## 1. How this was reached

From the tools an AI has (`packages/commands/src/queries.ts` and `commands.ts`), the help pages [AI apps](../../docs/help/ai-apps.md) and [The assistant](../../docs/help/assistant.md), the [trial of Webforge's own website](../../docs/testing/own-website-with-claude-code.md) and its log on [#1230](https://github.com/nexustech/webforge/issues/1230), and the notes on [AI apps unattended](19-ai-apps-unattended.md) and [Theme Studio](23-theme-studio-from-scratch.md). No AI was asked to style a site for this note, so the proposals are a view to test.

The assistant uses the same tools as an AI app, so each proposal serves both unless it says otherwise.

## 2. What an AI can do with the look today

- **Read** the theme's values (`theme`), and one element's fields with where each value comes from: its own, the theme's look for its kind, or the default (`fields`).
- **Change** the theme's values (`setThemeTokens`), which asks the person first because every page changes, and one element's fields.
- **Not found** in `packages/commands`: a list of the themes to choose from with what each is for, a command that switches to another theme, or one that sets the look of every item of a kind.
- **It can't see the page.** It learns that a colour is hard to read only when Site Check runs afterwards.
- **The person answers Allow or Cancel.** The assistant's card then lists what changed, with **Undo These Changes**, and with **Review changes before they're made** it works on a copy until **Apply Changes**.

In the trial, the dark look took hand work and the large headline couldn't be reached (log row 12).

## 3. The loop, and what is missing

| Part        | What it needs                                     | Today                                                                                                           |
| ----------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Brief**   | What the site should feel like, and for whom      | The assistant is told about the business once, when the site starts, and that isn't saved                       |
| **Propose** | Taste to choose from, and more than one answer    | The AI invents from the theme's values; Webforge's fifteen themes and tested font pairings aren't offered to it |
| **See**     | The result, for the AI and for the person         | Neither sees it before the change is allowed                                                                    |
| **Nudge**   | A way to say "not quite" without the words for it | Free text only                                                                                                  |
| **Keep**    | One thing to keep or undo                         | The assistant's card; an AI app's changes are steps in Undo History                                             |

## 4. Proposals

Sizes are rough ideal days.

| #         | Proposal                                                                                                                                                                                                                                                                            | Builds on, or needs                                  | Size |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---- |
| **AS-1**  | **A style brief kept with the site.** A few lines in Site Settings: the mood, who the site is for, and what to avoid. Every request, from the assistant or any app, starts from it, so a site styled over several sittings stays one site                                           | Changes "what you said isn't saved" in Start a Site  | 1.5  |
| **AS-2**  | **The themes and font pairings, for an AI to choose from.** A list an AI can read, each with words for its mood and who it suits, and a command that switches the site to one. The AI chooses and adjusts what Webforge has tested, in place of inventing                           | The fifteen themes; font pairings                    | 2    |
| **AS-3**  | **Choose from three.** An AI proposes up to three looks; Webforge shows them side by side on the person's own page, and the person takes one or none. A choice, in place of Allow or Cancel                                                                                         | The assistant's copy of the site; the Allow question | 3    |
| **AS-4**  | **A look report.** Facts Webforge works out and an AI can read: pairs of colours that are hard to read, text too small on Mobile, sections in a row that look alike, how many items carry a look of their own. It works with a model that can't see pictures, and sends no pictures | Site Check's contrast checks                         | 2.5  |
| **AS-5**  | **A picture of the page,** on Desktop or Mobile, for a model that can see. Asked for once for each site, saying that the page's pictures are sent                                                                                                                                   | The preview; "Each site asks first"                  | 2    |
| **AS-6**  | **Contrast in the answer, and a dry run.** Changing the theme answers with what fails and the nearest colour that passes; the same command can be asked what it would change, without changing it                                                                                   | `setThemeTokens`; TS-6                               | 1    |
| **AS-7**  | **The feel as a tool.** _Plain to bold_, _tight to airy_, _sharp to soft_ and _quiet to colourful_ as four values an AI can move, in place of the settings under them                                                                                                               | Needs TS-3                                           | 1    |
| **AS-8**  | **The same three scopes as a person.** One command styles the whole site, every item of a kind, or one item. When an AI gives several items of a kind the same look one by one, Webforge answers that the look for every one of them is the way                                     | The theme's looks (CT-1); TS-10's scopes             | 2    |
| **AS-9**  | **Nudges as buttons.** After a styling change, the card offers _Warmer_, _Calmer_, _Bolder_ and _More space_; each is one move of the feel                                                                                                                                          | Needs TS-3 and AS-7. The assistant only              | 1.5  |
| **AS-10** | **Ask, in the Design panel.** A box where the scope is: "warmer" for _This Button_, _Every Button_ or the _Whole site_. The scope answers what an AI most often gets wrong: this one, or all of them                                                                                | Needs TS-10. The assistant only                      | 1.5  |
| **AS-11** | **A styling change is one thing.** However many steps it took, the card shows it as one, with **Before**, **After** and **Undo These Changes**; for an AI app, the same in "While you were away"                                                                                    | The assistant's card; UA-3 (5.36)                    | 1    |
| **AS-12** | **Count what was refused.** When an AI asks for a value the theme can't hold, such as a larger headline, the usage summary counts which setting it was. No content is kept                                                                                                          | BD-1                                                 | 0.5  |

About 19.5 days for all of it.

**What I'd take first:** AS-4, AS-6 and AS-8. They need nothing that is undecided, and they give an AI sight, a correction in the same step, and the theme as the place a change lands. **Then** AS-1 and AS-3, which change what the person does. AS-7, AS-9 and AS-10 wait on Theme Studio's TS-3 and TS-10, which are undecided.

## 5. What isn't known

- **Whether an AI styles better with fewer words.** AS-7 assumes four values serve it better than the theme's settings. Running one step of the trial both ways would show it.
- **Whether owners judge by choosing and nudging, not by describing.** AS-3 and AS-9 assume so. Two or three people restyling a site in the beta's sessions (BD-4) would show it.
- **What a picture costs.** AS-5 sends the page's pictures to the model, and each one counts towards the assistant's monthly limit.
- **What a brief may hold.** AS-1 keeps a person's words in the site file, where today they are used once and dropped.

## 6. What this note does not propose

- An AI that makes pictures, or a look made outside the theme's values.
- Raw CSS written by an AI as the way to style; Custom Code keeps its own rules.
- Anything already decided for AI apps: a question that waits, working without asking, and "While you were away" (UA-1…UA-3).

## 7. Decisions

None yet.
