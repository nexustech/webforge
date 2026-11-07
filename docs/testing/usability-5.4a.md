# Usability test: a first site in one session (5.4a)

Plan item 5.4a's acceptance criterion: "A new user can publish a template-based site in one session". Only people can show that, so this test closes [#79](https://github.com/nexustech/webforge/issues/79) (OB-7, [product/17](../../research/product/17-onboarding-and-tour.md)).

**Who runs it:** the product owner, or someone they choose.
**With whom:** three people who haven't used Webforge, one at a time. Ideally they run a small business or would make a site for one, and haven't made a website before.
**How long:** about an hour each, including a few minutes before and after.

## Before each session

1. **Install the build** under test on the computer the person will use (Windows or a Mac), signed in as a user who has never run Webforge, so the tour is offered as it would be to them. Or delete Webforge's settings folder first: on Windows `%APPDATA%\Webforge`, on a Mac `~/Library/Application Support/Webforge`.
2. **Set up a test web host** the person can publish to:
   - an SFTP account on a test server, or a folder on a test FTP server, that nobody else uses;
   - its address, user name and password written on a card for the person to type in when asked, as their web host would have given them.
   It must not be a real site anyone visits.
3. **Have ready:**
   - a business the person can pretend to run, if they don't have one (*Rosa's Bakery, a bakery in Leeds, open 8 till 4 Tuesday to Saturday*);
   - a phone with a browser, on the same Wi-Fi as the computer, for Preview on Phone;
   - something to write notes on, and a clock.
4. **Close everything else** on the computer.

## What to say at the start

Read this out, in your own words:

> "Thanks for helping. We're testing Webforge, not you: if something is hard, that's what we need to find out. Please think aloud as you go: say what you're looking for, what you expect to happen, and what surprises you. I'll stay quiet and won't help unless you're completely stuck, because I need to see what happens when nobody's there to ask. You can stop at any time."

## The task

Hand the person this, on paper:

> "You run a small business and want a website for it. Using Webforge, make a site for your business and put it online on the web host on this card. Change at least the business name, one heading and one picture so the site is yours. Tell me when you think it's live."

Start the clock when Webforge opens.

## While they work

- **Don't help,** unless they've been stuck on the same thing for five minutes, or ask to stop. When you do, give the smallest hint that gets them moving ("Is there a menu that might help?"), and note that you did.
- **Note, with the time:**
  - whether they take the tour, skip it or choose *Not now*, and at which step they leave it;
  - each time they hesitate, go the wrong way, or say they're confused, and what they were looking for;
  - each first-time tip they see, and whether they read it;
  - when they open Help (F1, a **?** button, *Learn more*), and whether it answered their question;
  - each error message, and what they did next;
  - when they first preview the site, and when they first publish.
- **Stop at 60 minutes** whether or not they've published.

## Afterwards

Ask, and note the answers:
1. "What was the hardest part?"
2. "Was there a point where you didn't know what to do next?"
3. "Did the tour help? Was there anything it should have shown you?"
4. "How sure are you that your site is live? How would you check?"
5. "Is there anything you expected Webforge to do that it didn't?"

Then check the test host: is the site there, with their changes, and does it open in a browser?

## Results

For each person, record:

| | Person 1 | Person 2 | Person 3 |
|---|---|---|---|
| Published, with the site live on the host | | | |
| Time to publish (minutes) | | | |
| Hints given | | | |
| Tour: taken, skipped, or left at step… | | | |
| Where they got stuck (each) | | | |

**The criterion is met** if at least two of the three publish a site with their own name, heading and picture within the hour, with no more than one hint each.

**File each problem** as an issue in the current milestone (`type/bug`, or `type/chore` for wording), quoting what the person said or did, with the person's number, never their name. Then comment on #79 with the table, the issues filed and whether the criterion is met; #79 closes once that's done.

## Privacy

Don't record the screen or the person's voice unless they agree to it in writing. Keep notes by number, never by name. Delete the test host's files after the last session.
