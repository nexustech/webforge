# What the beta tells us: a report the tester sends, and sessions

**Status:** ✅ Decided 2026-11-21 ([§6](#6-decisions)): BD-1 to BD-5 are adopted (5 days); BD-6, an upload button, is not taken. Nothing is sent by Webforge itself ([§3](#3-direction)). Planned as PH5-6: Phase 5 items 5.40–5.43, before the closed beta.

**Date:** 2026-11-21

**The question,** from the product owner: what telemetry should we capture for the beta testing?

## 1. What is already decided

- **"No telemetry"** is the privacy line of the [MVP spec](../../spec/02-mvp-spec.md) §4, and §7 item 6 decided crash reports are kept on the computer and never uploaded (F-SITE-7). The spec names the future: "in-app review and optional user-initiated sharing".
- **Crash reports** ([architecture §9](../../spec/01-architecture.md)) hold versions, the kind of error and a stack with paths removed, never the error's message, site content or anything about the person. The newest 20 are kept for 30 days.
- **The log file** (`main.log`, 1 MB and one older copy) is written by the main process only.
- **Testers report** through two GitHub forms or by email ([testers' guide](../../docs/beta/testers-guide.md), [triage](../../docs/beta/triage.md)). The guide tells them a crash report is "never sent anywhere by itself".
- **A session with a person watching** is already written up for one question: [the usability test for 5.4a](../../docs/testing/usability-5.4a.md).

## 2. What the beta has to answer

| #   | Question                                                                                        | Why it matters                                                                |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **Do people finish?** Of those who start a site, how many reach a preview, an export, a publish | The product's one job, and 5.4a's criterion                                   |
| 2   | **Where do they stop?** The last step reached in Start a Site, the tour and publishing          | Says what to fix first                                                        |
| 3   | **What breaks?** Crashes; failed exports, publishes (by kind of host), autosaves and imports    | Stability before v1.0                                                         |
| 4   | **What goes unused?** Sections, panels, Theme Studio, Site Check, AI apps, the Assistant        | What to simplify, and what to explain better                                  |
| 5   | **Is it fast enough on their computers?** Start-up, opening a site, export, the preview's build | [Architecture §10](../../spec/01-architecture.md)'s budgets, on real machines |

## 3. Direction

Three ways were weighed on 2026-11-21:

|       | What it is                                                                                           | For                                                                       | Against                                                                                        |
| ----- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **A** | Webforge keeps counts and timings on the computer, shows them in full, and the tester sends the file | Keeps "no telemetry" exactly; it is the sharing the spec already foresees | Someone who gives up early sends nothing                                                       |
| **B** | Opt-in telemetry in beta builds                                                                      | Sees the people who leave                                                 | Changes a stated promise; needs somewhere to send to, and a privacy notice under UK and EU law |
| **C** | No engineering: watched sessions, a short survey, the issue tracker                                  | Explains why, which counts can't                                          | Small numbers                                                                                  |

**Decided by the product owner, 2026-11-21: "A with C".** Webforge sends nothing by itself, in the beta or after. B is not taken; if it is ever wanted, what A keeps is what B would send.

## 4. What the report may hold, and what it never does

**The rule that makes it safe: the report has no place for free text.** Every value is a number, a time, or a name from a fixed list in the code (a command's id, a component's type, a rule's id, an error code). A site's words, names and addresses can't be written to it because there is no field that would take them.

| Holds                           | Examples                                                                                                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The path to a finished site** | sites started (from a template, from a brief, blank), first edit, Preview opened, Site Check run, export done, publish done and by which kind of host (SFTP, FTP, Netlify…) |
| **Start a Site and the tour**   | the last step reached; the tour taken, skipped or closed, and at which step                                                                                                 |
| **What is used**                | a count for each command, and for each type of section and element added ("Hero", "Pricing")                                                                                |
| **What fails**                  | counts by error code for export, publish, autosave and adding files; the number of crash reports                                                                            |
| **Site Check**                  | how often each rule fired, by rule id and level                                                                                                                             |
| **AI apps and the Assistant**   | the kind of app connected, calls by tool name, questions asked, allowed, declined and run out                                                                               |
| **Timings**                     | start-up, opening a site, export, the preview's build, with the number of pages and pictures as the size                                                                    |
| **The computer**                | Webforge's version and channel, the operating system and its version, memory, display scale, the editor's language                                                          |

**Never:** a site's or page's name, text, file names, pictures, web addresses, host names, email addresses, anything typed, an AI app's request or answer, the computer's or the person's name, or paths.

## 5. Proposals

Sizes are rough ideal days.

| #        | Proposal                                                                                                                                                                                                                                                                                                                                | Why                                                                                                                             | Size                       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **BD-1** | **A usage summary kept on the computer:** one file beside the crash reports, holding §4's counts and timings, written by the main process from a fixed list of events. Its schema allows numbers, times and listed names only, and a test fails if a field of free text is added, as `publish-never-logged.test.ts` does for publishing | Answers questions 1 to 5 without sending anything                                                                               | 2                          |
| **BD-2** | **Help › Diagnostics…:** a window that shows what the summary holds, in words a tester can read, with **Save Report…** (one file: the summary and the newest crash reports), **Open the Folder** and **Clear**. Nothing is sent: the tester attaches the file to their report or email                                                  | The in-app review the spec foresees. A tester can see for themself that nothing private is in it                                | 1.5                        |
| **BD-3** | **The forms ask for the report, and a script adds reports up:** the two beta forms and the testers' guide say how to attach it; a tool reads the reports received and prints the totals for §2's questions                                                                                                                              | Without the adding up, each report is read once and forgotten                                                                   | 1                          |
| **BD-4** | **Sessions and a survey (C):** in each beta round, three watched sessions run to the 5.4a script, and one short survey after two weeks (did you publish; what stopped you; what was missing; would you pay; anything else). Written into `docs/beta/`                                                                                   | Reaches the people who stop early, and says why                                                                                 | 0.5, plus the owner's time |
| **BD-5** | **A random number for each install** in the report, made on first run and reset by **Clear**                                                                                                                                                                                                                                            | Two reports from one tester aren't counted twice. It names nobody, but it is an identifier, so it is a choice                   | with BD-1                  |
| **BD-6** | **Send to the Webforge team:** a button that uploads the report                                                                                                                                                                                                                                                                         | Fewer steps for the tester. Needs somewhere to receive it, and a privacy notice; it is the first thing Webforge would ever send | not proposed for the beta  |

**Recommended:** BD-1, BD-2, BD-3 and BD-4 (5 days), with BD-5. BD-1 and BD-2 belong together: a summary nobody can see is not better than telemetry. Not BD-6 for the beta: with a handful of testers, attaching a file is no burden, and the promise stays whole.

**What changes if adopted:** F-SITE-7 gains the summary and the window; the privacy line keeps "No telemetry" and adds that the summary stays on the computer until the person sends it; architecture §9 lists the summary's contents beside the crash report's; the testers' guide, triage notes and the help page on crash reports are updated in the same PRs.

**Risks.** A count can still say something about a person (someone who adds a Buy button sells things): the window shows every count, and **Clear** removes them. The summary could grow into a log: the fixed list of events and the test in BD-1 are the guard. Reports arrive through public GitHub issues: the guide already warns that everything there can be read by anyone, and the report holds nothing private.

## 6. Decisions

Product owner, 2026-11-21: "Beta diagnostics adopt BD-1 to BD-5".

| #    | Decision                                                                          |
| ---- | --------------------------------------------------------------------------------- |
| BD-1 | ✅ **Adopted:** a usage summary kept on the computer, with no place for free text |
| BD-2 | ✅ **Adopted:** Help › Diagnostics…, to read, save and clear it                   |
| BD-3 | ✅ **Adopted:** the forms ask for the report, and a script adds reports up        |
| BD-4 | ✅ **Adopted:** watched sessions and a survey in each beta round                  |
| BD-5 | ✅ **Adopted:** a random number for each install, reset by **Clear**              |
| BD-6 | ❌ **Not taken:** an upload button. Webforge sends nothing by itself              |

5 days in all. **Planned as PH5-6** (21 Nov 2026, [the plan's §3](../../spec/04-implementation-plan.md#3-timeline)): they join Phase 5 and land before testers get a build (5.7), with the dates unchanged (PH5-2).

| Item | Issue                                                      | Decisions  | Days | Stream                                          |
| ---- | ---------------------------------------------------------- | ---------- | ---- | ----------------------------------------------- |
| 5.40 | [#1263](https://github.com/nexustech/webforge/issues/1263) | BD-1, BD-5 | 2    | B, after 5.27 (#1217), before #1250             |
| 5.41 | [#1264](https://github.com/nexustech/webforge/issues/1264) | BD-2       | 1.5  | A, after #1252, before 5.33 (#1228); needs 5.40 |
| 5.42 | [#1265](https://github.com/nexustech/webforge/issues/1265) | BD-3       | 1    | A, after 5.41; needs 5.40                       |
| 5.43 | [#1266](https://github.com/nexustech/webforge/issues/1266) | BD-4       | 0.5  | A, after 5.42                                   |

If stream A reaches 5.41 before 5.40 has merged, it takes 5.33 (#1228) first.
