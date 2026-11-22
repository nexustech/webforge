# Beta: watched sessions and a survey

How each beta round hears why people stop, as well as what they did (5.43, BD-4). The diagnostics reports' totals ([Adding up the reports](triage.md#adding-up-the-reports)) say what happened, but not why, and someone who gives up early sends nothing. So each round also has three watched sessions and one short survey: "A with C" in [note 22](../../research/product/22-beta-diagnostics.md) §3.

**Who runs them:** the product owner, or someone they choose.

## Three watched sessions in each round

In each beta round, three testers each have one session with someone watching, run to [the 5.4a usability test's script](../testing/usability-5.4a.md). Use the same task, the same words at the start, the same notes while they work, the same questions afterwards and the same results table.

How a beta session differs from 5.4a's:

- **Who:** three of the round's testers, asked by email. Choose people who haven't sent a report yet, or whose reports stop early (in Start a Site, the tour or publishing), since they are the ones the totals can't explain. Ask them in the first week of the round, before they've made much of their site.
- **Where:** on their own computer, with the beta version they already have, in person or over a video call where they share their screen. Their own computer shows what the test computer can't: their screen size, text size and web host.
- **Their own business:** use their own business rather than _Rosa's Bakery_, and their own web host if they want to publish for real. Otherwise use the test host on the card, as in 5.4a. They can carry on with a site they've started; note how far they were.
- **Recording:** as in 5.4a's privacy rules, nothing is recorded, by screen or voice, unless they agree in writing. A video call's own recording counts.

**Keeping the notes:**

- During the session, note by the person's number, never their name, as 5.4a says.
- Afterwards, add the session's row to the round's results table: _Published_, _Time to publish_, _Hints given_, _Tour_ and _Where they got stuck_.
- Post the table as a comment on the round's pinned issue, _Beta round N: weekly totals_, once the three sessions are done. Quote what the person said or did, by number.
- File each problem as an issue in the current milestone, labelled `beta` and as [the triage notes](triage.md#labels) say, quoting the session.
- Keep the paper notes until the round's issues are filed, then destroy them.

## One survey, two weeks into each round

Two weeks after a round's build goes out, email every tester in the round these five questions. Answers come back as a reply, so they stay in the team's mailbox; no survey service is used, and nothing is sent by Webforge.

> Thanks for testing Webforge. Five quick questions; a line or two each is plenty, and you can skip any.
>
> 1. **Did you publish your site?** Yes, to my web host / I exported it as files / Not yet.
> 2. **What stopped you, or slowed you down most?**
> 3. **What was missing** that you expected Webforge to do?
> 4. **Would you pay for Webforge** once it's finished? Yes / Maybe / No. What would decide it?
> 5. **Anything else** you'd like to tell us?

Send it once per round, with one reminder a week later to those who haven't answered. Never more than that.

**Reading the answers with the reports' totals:**

1. Copy each answer into a table by the tester's number, never their name or email address, and delete the emails once that's done.
2. Set the survey beside the round's latest totals, in the comment on the round's pinned issue:
   - **Did you publish:** compare with the totals' _Published_ share. More "Not yet" answers than installs that stopped short mean testers who never sent a report; their answers to question 2 are the reason the totals can't show.
   - **What stopped you:** match each answer to the totals' _Where do they stop?_ (Start a Site's steps, the tour, publishing) and _What breaks?_. An answer with no count behind it is something the summary doesn't count. A count with no answer behind it is worth a question in the next round's sessions.
   - **What was missing:** check against the totals' _What goes unused?_. A feature asked for that exists but goes unused is a wording or discovery problem, not a missing feature.
   - **Would you pay:** record the counts and the reasons. They go to the licensing decision (Phase 6), not to the fix list.
3. File what the survey finds as issues, as the sessions' are, quoting the answer by the tester's number.

## Each round, in order

1. **First week:** ask three testers for a watched session.
2. **During the round:** run the three sessions, and post their table and issues.
3. **Two weeks in:** send the survey, and the reminder a week later.
4. **Each week:** triage, and add up the reports ([triage notes](triage.md)).
5. **Before the next round's build:** post the survey's table beside that week's totals, and file what it finds.
