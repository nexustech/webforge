# Plan review: Phase 1 and Phase 2

**Date:** 23 Oct 2026 · **Plan:** `spec/04-implementation-plan.md` at `main` c487982 · **GitHub:** the Phase 0–2 milestones as of 23 Oct 2026, 22:40 UTC

**Question:** Is the plan feasible, are there orphaned items, and is the order of work right?

**Short answer.** Phase 1 is nearly done and well inside its date. Phase 2 is feasible against its 11 Dec milestone, but only just, and only because the plan already assumes work runs at half the estimates. The plan has drifted from GitHub in four places: 14 days of architecture-review work sits in the Phase 2 milestone but in none of the stream queues; a feature with a PR in flight has no plan item; the effort headlines are stale; and two of today's additions (1.39 and the UI6 start screen) cross streams in a way the dependencies don't record. Eight corrections, C1–C8 below, put it right without changing scope.

## 1. Method
- Every plan row for Phases 0–2 was matched to its GitHub issue: state, estimate, dependencies, `Actual days` comment, labels and milestone.
- Pace: closed Phase 1 items with an `Actual days` comment, actual over estimate.
- Stream load: the Phase 2 stream tables, each item at its estimate (sub-issue estimates where the plan split an item), scaled as the plan says (0.5 for engineering, 0.7 for the content items 2.13 and 2.15).
- Working days from 27 Oct 2026, 5-day weeks, no bank holidays before 25 Dec.

## 2. Where Phase 1 stands
| | |
|---|---|
| Issues | 48 of 50 closed. Open: **1.36** ([#184](https://github.com/nexustech/webforge/issues/184), PR [#273](https://github.com/nexustech/webforge/pull/273) ready for review) and **1.39** ([#278](https://github.com/nexustech/webforge/issues/278), added today, 7 days) |
| Pace | 37 closed items with actuals: **118 estimated days done in 44.5 actual, 0.38 of estimates** (the plan's 0.39 holds) |
| Remaining | 11 estimated days, about 4–6 actual. Phase 1 milestone due 13 Nov; exit review about 9 Nov as planned |
| Exit criteria | Two of three are met by merged work. The third, "Shell matches UI1 in dark and light", is now out of date: UI6 amended UI1 today (blue selection, flat canvas), and 1.39 is the item that makes the shell match. The criterion should read "matches UI1 as amended by UI6" |

**Phase 0 is not finished** and is on the critical path for Phase 5, not Phase 2: 0.1 (signing enrolment), 0.2 and 0.3 (publish spikes, needed by 4.1), 0.5 and 0.6 are open; only 0.4 closed. The plan's lead-time table says enrolment starts on day 1, **26 Oct 2026**, which is Monday. Nothing in Phases 1–2 waits on it, so it is a reminder, not a correction.

## 3. Feasibility of Phase 2
### 3.1 Load per stream as planned
Stream order from the plan, with 1.39 now at the end of stream A's Phase 1 queue:

| Stream | Queue (estimate) | Raw days | At pace |
|---|---|---|---|
| A | 2.9 (7) → **1.39 (7)** → 2.3 (6) → 2.11 (5) → 2.12 (2) → 2.13a (5) → 2.15a (7.5) | 39.5 | 22.2 |
| B | 2.4 (1) → 2.8 (5) → 2.7 (8) → 2.14 (5) → 2.13b (5) → 2.15b (7.5) | 31.5 | 18.2 |
| C | 2.6 (8) → 2.10 (6) → 2.17 (4) → 2.13c (4) → 2.16 (3) → 2.15c (5) | 30 | 16.8 |

2.1, 2.2 and 2.5 are already closed. Stream A is the long pole by eight raw days because 1.39 landed on it today.

### 3.2 Work in the milestone that no queue holds
| What | Days | Where it should run |
|---|---|---|
| **R7–R14** ([#240](https://github.com/nexustech/webforge/issues/240)–[#247](https://github.com/nexustech/webforge/issues/247)), the architecture review's Phase 2 items | 14 | The review assigned them to streams and marked R7 and R8 as blocking 2.6–2.11, and R9 and R10 as blocking 2.3, 2.7 and 2.9. The plan's §10.6 puts such work in contingency, which is fine for the effort total, but the stream queues must sequence them or stream C starts 2.6 on top of code R7 and R8 are meant to change first |
| **CSS class autocomplete and browser** ([#276](https://github.com/nexustech/webforge/issues/276)) | about 3 (no estimate on the issue) | A `type/feature` in the Phase 2 milestone with PR [#285](https://github.com/nexustech/webforge/pull/285) (part 1 of 2) in flight, and no plan item. It needs a row, an estimate and a stream, or it is invisible to the dates |
| Chores and bugs #271, #281, #287, #290 | about 2 | Contingency, as §10.6 says. Fine |

With R7–R14 and #276 placed, the three queues come to about 38–39 raw days each (§4, C2), or **22–25 working days at pace**. From 27 Oct that is code-complete about **1–2 Dec**, and about **8–9 Dec with +25%**, against the milestone's **11 Dec**. Feasible, with two or three days of slack.

### 3.3 What eats the slack
- **The 0.5 pace is an assumption.** Phase 1 ran at 0.38 on editor and data work. Phase 2 is different work: each component needs stories × 3 themes × 2 devices, axe, and visual screenshots, and the content items (2.13, 2.15) are judged by eye. The plan already scales those at 0.7. If component work runs at 0.6 rather than 0.5, the long stream adds about four days and the +25% date moves past 11 Dec.
- **The template sync point.** Every 2.15 batch waits on 2.14 (stream B's fifth item), 2.10 (C's second), 2.11 and 2.12, plus its own theme batch; 2.16 waits on all three theme batches. Streams A and C will idle for a few days before their templates unless 2.14 moves earlier in B's queue. C2 does that.
- **Phase 2 has its own fast-track options** (§11: 4 templates instead of 8 saves 10 days, 6 themes instead of 10–12 saves 7). They remain the lever if the first component batch comes in slow.

## 4. Orphans, drift and order problems
| # | Finding | Evidence | Fix |
|---|---|---|---|
| O1 | **R7–R14 are scheduled nowhere in the plan.** They are in the Phase 2 milestone, assigned to streams in `docs/reviews/2026-10-23-architecture-review.md`, with blocks links on GitHub, but absent from the plan's stream tables and from any date | 14 days; R7 and R8 block 2.6, the first item of stream C | C2 |
| O2 | **#276 has no plan item** although its first PR is open | `type/feature`, no estimate, Phase 2 milestone | C5 |
| O3 | **1.39 and 2.14 both rebuild the start screen.** LF-10 (card grid of recent sites, Help tab, search) is in 1.39 on stream A; 2.14 on stream B builds the template gallery on the same screen, with LF-11 | No dependency between them; two streams would edit the start screen | C3: LF-10 moves to 2.14; 1.39 drops to 6 days, 2.14 rises to 6 |
| O4 | **2.3 would be built on the old field layout.** LF-7 (two-column field rows) is in 1.39; 2.3's Theme panel is stream A's second Phase 2 item and builds many fields | Both on stream A, 2.3 before 1.39 in the queue | C2: 2.9 → 1.39 → 2.3 |
| O5 | **1.39 depends on 1.36, which is stream C's PR**, so stream A cannot start 1.39 until #273 merges | #278 depends on #184 | C2: stream A starts 2.9 (its dependencies are met) and takes 1.39 second |
| O6 | **Effort headlines are stale.** The tables sum to Phase 1 **129** (header 122), Phase 2 **104** (header 102), total **344** (header 335) | Today's +3 and +6 were logged in the scope-change lines but not in the totals | C1 |
| O7 | **§7 critical-path chains predate 1.39 and 2.17** and their lengths no longer match the tables | Chain 1 lists 1.21 → 2.6 → 2.13 at 70 days | C6 |
| O8 | **Phase 1 exit criterion names UI1 only** | UI6 amended UI1 today | C4 |
| O9 | 2.11 shares the form-field module and `embed` behaviour that 2.8 builds, but 2.11 is on stream A and 2.8 on stream B | Plan §Phase 2 streams text | C2: 2.11 moves to B after 2.8 |
| O10 | The Gantt still puts 1.36 after 1.34 (stream A's old slot) although 1.36 moved to stream C; the Phase 2 bars are baseline 2027 dates by design | Cosmetic | Leave until the Phase 1 exit re-plan, as the plan says |
| O11 | Stream A's Phase 2 queue starts with 2.9, whose back-to-top option adds Site Settings fields (stream B's model), and 1.39's LF-12 merges Site Settings into one Settings dialog | Same stream, 2.9 first, so no conflict | None |

No plan item lacks an issue, no issue in the two milestones lacks a plan row except #276, and no dependency points at an open item that is not in a queue. The closed Phase 1 items all have actuals except the bug fixes, which is as the plan asks.

## 5. Corrections
| # | Change | Where |
|---|---|---|
| C1 | Effort headlines: Phase 1 129 and Phase 2 104 as the tables stood (344 in all); after C3 and C5, **128, 108 and 347** | Plan §3 table and Phase headers |
| C2 | **Phase 2 stream queues**, with the review items sequenced where their blocks say and the loads levelled:<br>**A:** R9 → R10 → 2.9 → 1.39 → 2.3 (with R11) → 2.18 → 2.13a → 2.15a (39 raw)<br>**B:** R12 → R14 → 2.4 → 2.8 → 2.7b → 2.11 → R13 → 2.14 → 2.13b → 2.15b (40 raw)<br>**C:** R7 → R8 → 2.6 → 2.10 → 2.7a → 2.17 → 2.12 → 2.13c → 2.16 → 2.15c (40 raw)<br>2.11 moves A → B (it extends 2.8's modules), 2.7a (Gallery and lightbox) and 2.12 move to C, 2.14 moves one place earlier in B, 2.18 (C5) joins A. R items stay in contingency for the effort total but are listed in the queues | Plan Phase 2 streams table and its notes; the R issues' stream labels already match |
| C3 | LF-10 (start screen card grid, Help tab, search) moves from 1.39 to 2.14: 1.39 becomes 6 days, 2.14 becomes 6 days; the UI6 note and both issues updated | Plan rows and entries, product/07 §3, #278, #56 |
| C4 | Phase 1 exit criterion: "Shell matches UI1 **as amended by UI6** in dark and light (Storybook screenshots)" | Plan §3 table |
| C5 | New plan item **2.18 Advanced mode: CSS class autocomplete and browser** for #276, 3 days, stream A after 2.3 (the field renderer it extends lands with 1.39 and 2.3); estimate added to the issue | Plan table and entry, #276 |
| C6 | §7 chains recomputed: Editor → components → templates → exported-site checks now runs 1.1 → 1.2 → 1.12 → 1.14 → 1.19 → 1.21 → 2.6 → 2.13 → 2.14 → 2.15 → 3.10 at 74 days (2.6 +1 and 2.14 +3 since the baseline); the editor → pipeline chain is unchanged at 44 | Plan §7 |
| C7 | Note under the Phase 2 streams that the three queues are 39–40 raw days each, code-complete about 26 Nov at pace and 4 Dec with +25%, and that §11's template and theme cuts are the lever if the first component batch runs slower than 0.5 | Plan Phase 2 re-plan paragraph |
| C8 | Phase 0 reminder: 0.1's enrolment starts Monday 26 Oct; 0.2 and 0.3 are needed by 4.1, not Phase 2 | No plan change; a note to the product owner |

None of these changes scope or the milestone dates. C2 and C3 change who does what; the rest are bookkeeping.

**Applied 23 Oct 2026** to the plan, the UI6 note and issues #278, #56 and #276 (C8 needs no change).
