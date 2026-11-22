# Beta triage

How the team handles what beta testers send (5.7). Testers read [the testers' guide](testers-guide.md). Each round also has three watched sessions and a short survey, which say why people stop: [Watched sessions and a survey](sessions-and-survey.md) (5.43).

## Where reports come from

- **The two forms**, in `.github/ISSUE_TEMPLATE/`:
  - `beta-bug.yml` (_Beta – something went wrong_) opens an issue labelled `beta` and `type/bug`;
  - `beta-feedback.yml` (_Beta – feedback or an idea_) opens one labelled `beta`.
- **Email replies** from testers who'd rather not use GitHub: open an issue with the form's fields for them, labelled `beta`, without their name or email address.

## Labels

| Label                   | Means                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `beta`                  | Sent by a beta tester, or opened for one.                                                                                              |
| `severity/must-fix`     | Stops someone making, saving or publishing a site, loses work, or breaks a promise (privacy, no external requests). Fixed before v1.0. |
| `severity/should-fix`   | Slows people down or needs a way round it. Fixed before v1.0 if there's time, otherwise early in v1.1.                                 |
| `severity/nice-to-have` | An improvement or an idea. Goes to the v1.1 list.                                                                                      |

A `type/*` label says what kind of work it is, and an `area/*` label where it is, as for any issue.

## Each week

1. **Read** every open `beta` issue without a `severity/*` label.
2. **Label** each with one `severity/*`, a `type/*` and an `area/*`. A `must-fix` goes into the current milestone.
3. **Reply** on each, so the tester knows it was read: what happens next, or a question.
4. **Close** duplicates, pointing to the issue they repeat.
5. **When a fix ships** in a beta build, say so on its issue.
6. **Add up the diagnostics reports** (5.42, BD-3): see below.

## Adding up the reports

Each week of the beta, after triage:

1. Download every diagnostics report attached to a `beta` issue (or sent by email) that week or before into one folder. Name each after its issue, such as `1412.json`, so a refused one can be followed up.
2. Run `pnpm report-totals <folder>`. It checks each report against the usage summary's schema and names any it refuses: not JSON, or a count the schema doesn't allow. A refused report is never counted. Of several reports from one install (the same install number), it counts only the newest.
3. It prints the totals for [note 22](../../research/product/22-beta-diagnostics.md) §2's five questions:
   - how many installs started a site and reached a preview, an export and a publish;
   - where they stop in Start a Site and the tour;
   - what breaks;
   - what goes unused;
   - the timings against architecture §10's budgets.
4. Paste the output, in a code block, as a comment on the beta round's pinned `beta` issue, _Beta round N: weekly totals_, with a line on what changed since last week. Open an issue for anything the totals show that no report has, labelled as above.

Read the totals beside the round's watched sessions and survey, as [Watched sessions and a survey](sessions-and-survey.md#one-survey-two-weeks-into-each-round) describes.

The totals are counts from many testers, never one tester's: they hold no install number, and nothing in a report names anyone.

Crash reports never hold site content or personal data (architecture §9). If a report or a screenshot shows something private anyway, edit it out of the issue at once.
