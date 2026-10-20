---
description: Plan the next block of work from spec/04-implementation-plan.md and the live GitHub state
argument-hint: "[phase or item IDs, e.g. 'Phase 1' or '1.12-1.16'; empty = next 2 weeks]"
---

Plan the next block of Webforge work from the implementation plan, using the live state in GitHub.
Scope: $ARGUMENTS. If that is empty, plan the next 2 weeks (about 10 working days) of work.
Otherwise it is a phase ("Phase 1") or item IDs ("1.12-1.16").

## 1. Load context (read, don't skim)
- CLAUDE.md and spec/03-engineering-standards.md (hard rules, Definition of Done)
- spec/04-implementation-plan.md: the baseline. Item IDs are like "1.12"; each item is a GitHub issue titled "<ID> <title>"
- spec/01-architecture.md, spec/02-mvp-spec.md, and every ADR and research note that the selected items cite in their Refs
- The current code in the packages the items touch. Know what already exists before planning to build it.

## 2. Get the live state from GitHub
Use gh. If gh isn't authenticated, stop and ask me to run `gh auth login`: the repository is private, so nothing can be read without it. Collect:
- milestones with their open/closed counts and due dates
- open and closed issues in the current and next milestone
- the "Depends on" links, and the actual days of closed issues: a comment `Actual days: <n>` (spec/04 §10). Read only that format; count issues without one as unknown and say how many there are
- PRs merged since the last phase review
- any `type/bug` or `type/chore` issues added outside the plan

From that, work out:
- the current phase: the earliest milestone that is still open. If it has no open issues, its exit review is pending: do step 3 and plan nothing else until I approve closing it
- which items are done
- which items are ready (all dependencies closed)
- how actuals compare with estimates so far (ratio and trend)

## 3. Phase exit check
If the current milestone has no open issues:
- check each exit criterion from spec/04 §5 with evidence (tests, E2E, stories)
- list what's missing
- propose re-estimates and new milestone due dates for the remaining phases, based on the actuals ratio

Don't close milestones or change due dates until I approve.

## 4. Plan the selected items
Pick items in plan order whose dependencies are closed, until the scope is filled. For each item give:
- **Approach:** packages and files to create or change, public interfaces (TypeScript signatures), data/schema changes and migrations, IPC channels (zod schemas), and the undo labels for every document change
- **PR breakdown:** 1–3 PRs of at most about 400 changed lines each. Give each a Conventional Commit title and a branch named after the same commit type: `feat/`, `fix/`, `chore/`, `docs/` or `test/` + `<area>-<slug>` (a `type/chore` item gets `chore/…`)
- **Tests:** unit (Vitest), property (fast-check) for any history or model change, stories (Storybook + axe), E2E (`pnpm e2e` / `pnpm e2e:packaged` where CLAUDE.md requires them), with the coverage floors
- **Acceptance mapping:** each acceptance criterion in the issue → the test or check that proves it
- **Risks and unknowns:** anything that needs a spike, an ADR, or a product/design decision from me
- **Estimate check:** confirm or revise the plan's estimate, and say why

Then add a short schedule for the block (day by day), and the open questions from spec/04 §9 that are now due.

## 5. Present, then update GitHub
Present the plan in plan mode and wait for my approval. Don't write code or change GitHub before I approve. Once I approve:
- add an "Implementation plan" comment to each selected issue (approach, PRs, test mapping)
- split any item over 5 days into sub-issues linked to the parent
- create issues for new work you found, in the right milestone, with `area/*` and `type/*` labels
- if re-estimates move a phase end by more than 3 days, update the milestone due date and the item's estimate in the issue body

If my approval changes the baseline (new items, changed scope, new dates), update spec/04-implementation-plan.md in a docs PR.

## Rules
- Follow CLAUDE.md, including no AI attribution in commits, PRs, issues or comments.
- Don't invent scope. Every planned item must trace to an MVP feature ID, a decision ID or an ADR follow-up. The exception is out-of-plan `type/bug` and `type/chore` issues (spec/04 §10), which are planned as they stand.
- If you find the spec and plan disagree, report it rather than silently picking one.
