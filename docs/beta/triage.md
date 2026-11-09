# Beta triage

How the team handles what beta testers send (5.7). Testers read [the testers' guide](testers-guide.md).

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

Crash reports never hold site content or personal data (architecture §9). If a report or a screenshot shows something private anyway, edit it out of the issue at once.
