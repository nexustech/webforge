# Onboarding: the first-run tour and first-time tips

**Status:** Proposed (OB-1…OB-7, §6), for the product owner. Plan item 5.4a ([#79](https://github.com/nexustech/webforge/issues/79), 4 days), pulled forward from Phase 5 on 7 Nov 2026.

**The question:** what does a small-business owner see the first time they use {appName}, so they get from a new site to a published one without help from anyone?

**Goal:** a new user can publish a template-based site in one session (#79's acceptance criterion), and never meets the same explanation twice.

## 1. What exists today

Read against `main` on 7 Nov 2026.

- **The start screen's welcome** (2.14b, SC-3): on a first start, three ways in, each with a line saying what it does. The quick start is the primary action (QS-4).
- **The quick start** (3.11): it picks the template and sets the theme from a few questions, then opens the new site in the editor. So the tour starts at editing text (QS-8).
- **Help** (5.4b, HP-6, HP-10): the Help window (F1), the **?** links, *Help for This Element*, and the start screen's Help tab with *Getting started*, *The editor* and *Keyboard shortcuts*.
- **The keyboard shortcuts sheet** (`?`, Help › Keyboard Shortcuts): done in Phase 1, built from the shortcut standard.
- **Inline hints** under fields, empty states and Site Check's one-line verdicts (product/15 §2).
- **Nothing remembers what a person has seen.** Preferences hold the look, the editor level, the panel layout, the canvas, the Add panel's favourites and the Edit panel's closed groups. There's no tour, no tips, and no "seen" state.

## 2. What a new user needs, in order

After the quick start, the editor opens on a finished-looking site that isn't theirs yet. The three things they must learn, in the order they need them (QS-8):
1. **Change the words and pictures:** click an element, type, or use the Edit panel. Most of the session goes here.
2. **See it as visitors will:** Preview, on this computer or a phone.
3. **Put it online:** Publish, which first needs a publish destination (their web host), or Export to hand the files to someone.

Everything else (sections, themes, pages, Site Check, Version History) can wait until they go looking. Help, the **?** links and the inline hints answer those when they do.

## 3. Patterns elsewhere

How site builders and design tools show a newcomer around (patterns only, not their wording or look):
- **A short, skippable tour** of three to five steps, each a small card pointing at the real control, with *Next* and *Skip*. The tour is short because people skip long ones.
- **A checklist** of first tasks (*add your logo*, *publish*) that stays until each is done. It's useful for long setups, but our quick start already does most of that work.
- **One-time tips** that appear the first time someone reaches a place (*this is where…*), each once, with a way to turn them all off.
- **A video or slideshow** before the editor. It's cheap to make, but people skip it and it goes stale with every UI change.

The tour and the tips fit what's left after the quick start. A checklist mostly repeats it.

## 4. Proposal

### The tour (OB-1…OB-3)

- **When:** the first time the editor opens a site made by the quick start, a small card offers *Show me around* or *Not now*. Choosing either is remembered; it never offers again by itself. Help › *Take the Tour* starts it at any time.
- **What:** three steps, each a small card anchored to the real control, with *Back*, *Next*, *Skip tour* and a *Learn more* link that opens its help page in the Help window (5.4b's `openHelp`):
  1. **Change your words:** it points at the first heading on the page. "Click any text on your page, then press Enter or **Edit** on its bar, and type. Its options are in the Edit panel." It moves on by itself once they've edited some text, or with *Next*. *Learn more*: [Editing on the page](../../docs/help/editing-on-the-page.md).
  2. **See it as visitors will:** it points at **Preview**. "Preview shows your site in your browser, and on your phone." *Learn more*: [Preview](../../docs/help/preview.md).
  3. **Put it online:** it points at **Publish…**. "When you're ready, Publish puts your site on your web host. Site Check tells you first if anything needs fixing." *Learn more*: [Publish](../../docs/help/publish.md).

  A last card says where help is (F1, the **?** buttons) and closes the tour.
- **How it behaves:**
  - It never blocks the editor: the card sits beside its control, and the person can keep working.
  - Esc skips, and the card is a labelled dialog that takes the focus, so it works with a keyboard and a screen reader.
  - If a step's control isn't on screen (the left panels hidden, Content mode), the card shows centred instead.

### First-time tips (OB-4, OB-5)

- **What:** a few one-time tips, each shown the first time a person reaches its place, at most one at a time, each closed with *Got it*. A proposed set of five:
  1. **The first selection:** "Press Enter, or **Edit** on its bar, to change its text. The bar also moves, hides, copies and deletes it."
  2. **The first switch to Content mode:** "Content mode locks the layout, so you can change the words and pictures without moving anything."
  3. **The first *Must fix* in Site Check:** "A *Must fix* stops Export and Publish until it's fixed. Click it to go there."
  4. **The first export:** "Your website is a folder of files. Upload all of it to your web host, keeping the folders as they are."
  5. **The first Theme Studio:** "A theme changes every page at once. Undo takes it back."
- **Off switch:** Settings › Interface gains *Show tips*, on by default, and *Show the tour and tips again*, which clears what's been seen.

### Where it's remembered (OB-6)

- In the person's preferences, not in the site, so it follows the person on this computer and every site they make: a new `onboarding` group with the tour's state (`new`, `skipped` or `done`), the tips seen, and *Show tips*.
- Nothing about it goes in the site's file or its undo history.

### The usability test (OB-7)

- #79's acceptance criterion is a usability test: "a new user can publish a template-based site in one session". A session can build what makes that likely, but only people can show it.
- **Proposal:**
  - The product owner, or someone they choose, runs it with three people who haven't used {appName}, each publishing to a test folder the owner sets up.
  - It uses a short script in `docs/testing/usability-5.4a.md`, written with this item.
  - The PRs for 5.4a say `Refs #79`, and #79 closes when the test has run, with its findings as issues.
  - If the test is to wait for the beta recruits (5.7), #79's criterion moves to 5.7's pre-beta checks instead, and the last code PR closes #79.

## 5. Effort

Within 5.4a's 4 days:
- **The tour, 1.5 days:** the card component, which places itself beside a control, falls back to the centre, traps the focus and takes Esc; the steps; the offer; and Help › *Take the Tour*.
- **The tips and their switches, 1 day:** five tips, the preferences group, and Settings' two controls.
- **Tests, 1 day:** stories (axe, dark and light), unit tests, E2E (the tour from the quick start to Publish's card, a tip shown once), and the help pages for the tour and tips (HP-4).
- **The usability test's script, 0.5 day.**

## 6. Proposals

| ID | Proposal | Alternatives |
|---|---|---|
| OB-1 | **The tour is offered, not started**, the first time the editor opens a site made by the quick start. *Show me around* or *Not now*, remembered either way; Help › *Take the Tour* starts it any time | Start it by itself; only from the Help menu |
| OB-2 | **Three steps** (QS-8): change your words, see it as visitors will, put it online. Then a card saying where help is | Five steps with themes and pages; one card only |
| OB-3 | **Cards anchored to the real controls**, never blocking the editor, with *Back*, *Next*, *Skip tour* and *Learn more* (its help page); the first step moves on once text is edited | A slideshow before the editor; a video |
| OB-4 | **Five one-time tips** (§4), each shown once, one at a time, closed with *Got it* | No tips (help pages only, −1 day); more tips |
| OB-5 | **Settings › Interface** gains *Show tips* (on) and *Show the tour and tips again* | Tips can't be turned off |
| OB-6 | **Remembered in the person's preferences**, never in the site | Per site |
| OB-7 | **The usability test** is run by the product owner with three newcomers and a script written with 5.4a; #79 closes after it, with its findings as issues | Move the criterion to 5.7's pre-beta checks |
