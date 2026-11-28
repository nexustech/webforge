# The weekly look back

Each Monday the coordinating session reports to the product owner on the week before (product owner, 2026-11-26; the rule is in `CLAUDE.md`, under _Working the plan_). The report comes from GitHub and covers:

- estimates against `Actual days`, by type and size;
- bugs by `found-by/*` label, and those `Introduced by` a recent PR;
- for each PR, commits after its merge review, CI re-runs, failures on one system only, and the time from ready to merged;
- CI runs that a merge to `main` cancelled or left behind it, and which merges did so (#1529);
- PRs that waited: the pinned issue **Stuck pull requests**, which the Merge queue workflow rewrites each hour (#1523), and any PR that stayed on it for more than a day;
- tests that passed on a re-run, and those still quarantined;
- faults found a second time;
- the week ahead (product owner, 2026-11-28): each stream's next two or three items, with each one's `Implementation plan` read again against the week's merges, and any whose plan no longer holds, or that now needs a piece another open issue needs;
- until 7 Dec 2026, the quick check's trial (#1472): ready PRs' CI failures in unit tests and coverage, against one in the two weeks to 26 Nov.

It proposes one or two changes from them. Those the product owner adopts go into `CLAUDE.md`, and a mistake found a second time goes into `docs/anti-patterns.md`.
