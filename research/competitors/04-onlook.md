# Onlook: Competitor Review

**Status:** 🟡 Proposals for decision ([§7](#7-proposals-for-decision)). Nothing here changes the spec or the plan until the product owner decides.
**Date:** 2026-11-20
**Question:** Onlook is not in Webforge's niche. What does it do, how is it built, and which of its ideas (product, editor, AI, engineering) are worth borrowing?

Onlook is an open-source desktop app in which a designer works on a developer's real codebase: the running app appears in frames on an infinite canvas and an AI agent edits the code. It matters to Webforge for three reasons. It is another **Electron + React + TypeScript desktop editor**, so its engineering choices compare directly. Its whole product is an **AI assistant working on a canvas**, which is what plan items 6.9a–e built here. And its source is public (Apache-2.0), so the findings below come from the code, not from marketing. Siblings: the [Webflow](01-webflow.md) and [Pinegrow](02-pinegrow.md) reviews.

**Correction to an earlier note.** [`stack/04-canvas-engine.md`](../stack/04-canvas-engine.md) lists Onlook as "Next.js + Tailwind". That describes Onlook v1, the browser version, now on the repository's `v1` branch. The `main` branch is a different product: the desktop app reviewed here. The verdict there (not an embeddable canvas engine) still holds.

## 1. Method

- **Website and docs** (read 20 Nov 2026): the home, features, AI features, pricing, about and FAQ pages; the docs landing page, the architecture page and the quick start.
- **Source code:** a shallow clone of `onlook-dev/onlook` at commit `721de14` (20 Nov 2026), about 2,800 files. Read: the root guides (`README`, `AGENTS`, `CODING`, `GLOSSARY`, `ANTIPATTERNS`, `WRITING`, `ASSETS`), the renderer (`apps/studio/src/renderer`), the in-frame script (`preload/guest.ts`), the agent host (`main/agent-host`), the agent's instructions (`src/instructions`), the IPC table (`packages/events`), the string catalogue (`packages/i18n`), the check scripts (`scripts/`), the tests and the build configuration.
- **Not done:** the app was not installed or run (it ships for macOS only), so there are no screenshots, and behaviour is described from code, strings and comments. Large components were read for structure, not line by line. The `v1` branch and the older `onlook-dev/desktop` repository were not read.
- **Baseline:** Webforge `main` at `fef79e61` (version 0.2.0, Phase 5 in progress).

**Confidence:** high for the architecture, the tool list, the checks and the numbers quoted (counted in the clone). Medium for interaction details taken from comments. Low for pricing and for anything about collaboration or hosting: the website still carries text from the web version that contradicts the desktop docs.

**IP rule (unchanged from UI1):** we may copy interaction patterns, layout conventions and engineering practices. We never copy Onlook's code, CSS, icons, images, sounds or wording. Its code is Apache-2.0, but its icon set, brand and artwork are not licensed for reuse at all (its `ASSETS.md`), and the Claude Agent SDK it bundles is proprietary.

## 2. The product

| Aspect           | Onlook, November 2026                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Positioning**  | "The developer tool for designers": a free, local-first editor where designers and "visual engineers" shape a product in its real code. It names Figma, v0, Replit Agent and Webflow as the things it replaces. Not aimed at business owners                                                                                                                                    |
| **Company**      | On Off, Inc. Y Combinator W25, San Francisco. The site says 3 team members and about 100 contributors. About 27,500 GitHub stars, 2,160 forks. No funding figures published                                                                                                                                                                                                     |
| **Platform**     | Electron desktop app, **macOS only** (Apple silicon and Intel). Windows is "planned" with a waiting list (a Windows build script and a CI test job exist). Linux is not packaged                                                                                                                                                                                                |
| **History**      | Third rewrite in two years: a first Electron app (2024), then a browser version on cloud sandboxes (v1), now a desktop app again. Each kept the name and the star count                                                                                                                                                                                                         |
| **How it works** | The person points Onlook at a git repository. Onlook makes its own copy (a git worktree on a new branch), runs the project's own dev server there, and shows the running app in webview frames on a canvas. The agent edits the copy; changes reach the person's repository only through git, usually as a pull request. Onlook never writes to the folder the person connected |
| **AI**           | No model of its own and no key entry. The person signs in to a **Claude or ChatGPT subscription they already have**; Onlook drives Claude Code (through the Agent SDK) or Codex on the person's computer. MCP connectors for Figma and one other design library are behind flags                                                                                                |
| **Editing**      | Almost everything goes through the agent. Direct manipulation exists only for objects on the canvas (move, resize, rename frames) and for the text of an Artifact. There is no style panel, no layers tree of the page, no drag and drop of elements. The website's feature list (Tailwind controls, layers, theming) describes the old web version                             |
| **Artifacts**    | Standalone HTML sketches the agent draws on the canvas, stored outside the repository and shown in an isolated page with no network and no storage. They export as self-contained HTML, PDF, PNG (1× or 2×) or JPEG                                                                                                                                                             |
| **Pricing**      | Free to download; free to build from source with no account. "For Teams" is priced on request (templates, branching, SSO, audit logs). The person's AI cost is their own subscription                                                                                                                                                                                           |
| **Telemetry**    | PostHog usage events, error reports and masked session recordings, on by default in the official build; a source build asks first. Code, paths, prompts and repository names are never sent                                                                                                                                                                                     |
| **Languages**    | The app's own UI ships in English, Japanese and Simplified Chinese, translated by machine from a string catalogue                                                                                                                                                                                                                                                               |
| **Licence**      | Apache-2.0 for the source                                                                                                                                                                                                                                                                                                                                                       |

**What this means for Webforge.** Onlook is not a competitor for our customer: it needs a git repository, a dev server and a paid AI subscription before it shows anything, and its output is a pull request. It confirms two of our choices from the other side: a desktop app with the person's files on their own computer, and the person's own AI account instead of credits we sell (AIA-1, AIA-3). It also shows the cost of the opposite choice on editing: with no direct controls, even a colour change costs a prompt and a wait.

## 3. The editor

### 3.1 Canvas

- **Objects:** frames (the live app), Artifacts, text notes, images and named sections. A canvas has its own pages, each with its own camera.
- **Device frames side by side:** three presets, Mobile 402×874, Tablet 744×1133 and Desktop 1512×982, freely resizable from 320×240. Many frames of the same app run at once.
- **Keeping many live frames cheap:** a frame that is small on screen or scrolled out of view is swapped for a still thumbnail, with separate thresholds for going idle and waking (160×100 and 192×120 px) so it does not flicker. All frames share one browser session, and the code notes its limits (six connections per host) must be planned for the whole canvas, not for one frame.
- **Camera:** zoom 5%–400%. "Fit" on opening a document is instant, not animated (a comment says a fly-in reads as the app moving by itself). A "back to designs" pill appears when the person has panned away from everything, and marks at the window edge point to a selection that is off screen.
- **Tidy gestures:** snapping at 8 screen pixels whatever the zoom, with guide lines; arrow keys nudge by 1 px (10 with Shift), and a burst of presses is one undo step; one paste or drop of several images is one undo step.

### 3.2 Selecting an element in a live page

- The page is never changed. Outlines are drawn in an overlay that takes no pointer events: 1 px for hover, 2 px for the selection, scaled against the zoom so they stay hairlines. The selected element shows its margin and padding as hatched bands with numbers.
- Clicks are caught by a shield above the frame and relayed as coordinates, so the page's own hover and click handlers never fire while designing.
- **Design and Preview modes** (keys D and P): Preview removes the shield so the page behaves normally, and hides the side panels.
- A selected element is described to the agent by tag, a path of sibling positions, classes and a trimmed snippet, never a screenshot. Up to ten elements can be selected. After a reload the element is found again by its path, and marked stale when the match is uncertain.
- Picking an element opens a small chat box beside it, carrying the element as a chip.

### 3.3 Start, onboarding and tips

- **Start screen:** recent projects as cards with thumbnails, a "new draft" button, an archive and a library of Artifacts. Removing something states exactly what is deleted and what is kept.
- **A blank project** shows one sentence and a "give me some ideas" button that reveals three cards, each of which sends a starter prompt.
- **First run:** connect an AI account, then add a folder or start from scratch. A "check your computer" list (four rows, each with Fix or Check again) appears only when a check fails.
- **Tour:** seven steps in a dialog, played over a prepared still of the editor with the camera moving between steps. It does not point at the live interface. Skippable, and reopenable from Help.
- **Tips guide** (one shortcut opens it): a searchable dialog with two halves. "Prompts" are cards grouped by topic, each with a short animation, three example sentences and a "try it in chat" button that puts the sentence in the chat box. "Hotkeys" is the shortcut list.
- **Contextual tips have a budget.** Only for new users; one tip per sitting (a new sitting starts after two hours away); a tip removes itself after 45 seconds on screen; 5 seconds of quiet after opening a project and 6 seconds between tips. Settings has "Reset tips".
- **Shortcuts** are declared in one typed registry. Toolbar buttons show a preview popover with a small illustration and the key. Holding the command key overlays the key on each top-bar control.

### 3.4 The assistant

- **Two AI products behind one interface.** Everything either product emits is turned into one typed event log (turn started, text, tool started/ended, approval asked/answered, usage limits). The screen is a pure function of that log, so the chat survives a restart and can be replayed in tests.
- **About 40 tools,** each registered once with an approval class. Additive tools run without asking. Deleting a file or a canvas page, and undoing on the canvas, show an approval card. Force-push, branch deletion and hard reset always ask, whatever mode the person chose; the "approve everything" mode is deliberately not offered.
- **The instructions** (several pages, appended to the vendor's own) set the manner:
  - say in one line what is about to happen before the first action;
  - ask once before each "first" (first variations, first look), then stop asking;
  - every question puts the recommended answer first, with one-tap options and room for a note;
  - variations go beside the original, never over what the person is looking at, and only what was asked changes;
  - never report success because a file was written: look at the page (a screenshot tool and a read-the-page tool exist for this);
  - describe changes in the designer's words, not file names;
  - end each turn that changed a page with two or three "what next" cards.
- **A blank project gets one round of questions** (what is it, for whom, any references, light or dark, one page or several), then the agent builds.
- **Chat rows are quiet:** each tool call is one plain sentence with no card; runs of similar calls collapse to "+N more". The agent's own to-do list is hidden.
- **Errors are typed:** signed out, billing, limit reached, service down, each with at most two buttons (retry, retry when the limit resets, switch agent, open billing). A meter shows usage limits and how full the conversation is.
- **One held message:** a prompt typed while the agent works is held, can be edited or discarded, and is sent when the turn ends cleanly.
- **What the selection sends** is wrapped and labelled as data, not instructions, and stripped of anything secret-shaped.
- **Weak point:** there is no review-before-apply and no undo of a turn. Safety rests entirely on the separate copy and on git. Canvas actions do share one undo timeline between the person and the agent.

### 3.5 Errors and feedback

- Every refused action has a typed code and a worded reason. A gesture that cannot happen says why; nothing fails silently (`ANTIPATTERNS.md` bans swallowing a refusal).
- Failure dialogs have a title, a body, an optional plain-language explanation and the machine detail in a separate block. A frame that failed to load is covered with the cause and an action, including "ask the agent" with a prepared prompt.
- **Report a problem** is one form for both "issue" and "idea": one text field and an optional picture. If sending fails the text is kept and a "copy my message" button appears.
- Each open project is a tab with a status dot (working, done, waiting for you).

## 4. Engineering

### 4.1 What Onlook does that Webforge can learn from

| Area                       | Onlook                                                                                                                                                                                                                    | Webforge today                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Workflow security**      | A unit-tested script fails CI unless every GitHub Action is pinned to a 40-character commit SHA, top-level permissions are empty, jobs read only, no secrets, no `${{ }}` inside `run`, no `pull_request_target`          | `permissions` blocks exist, but all 54 `uses:` lines pin a tag, not a SHA. No check                                                                                                        |
| **Secret scan**            | A pinned, checksum-verified Gitleaks scans the tree and history in `verify` and in a pre-push hook                                                                                                                        | GitHub's secret scanning and push protection are on, for known providers' tokens. Generic patterns (passwords, private keys) are off, and nothing checks before a push leaves the computer |
| **Security as unit tests** | Fuses are re-read from the packaged binary and packaging fails if one did not stick; pinned versions of patched dependencies are asserted; both builder configs are validated against electron-builder's schema           | `pnpm e2e:packaged` covers Fuses. The other two: not checked                                                                                                                               |
| **Legacy violations**      | "A list that only shrinks": each boundary rule has a text file of today's exceptions; a new violation fails, and so does a line whose violation is gone                                                                   | dependency-cruiser with inline `pathNot` exceptions; no violations to carry. Useful only if a new rule ever lands with existing breaches                                                   |
| **Feature flags**          | Every flag must carry a `removeWhen` sentence                                                                                                                                                                             | No flag system. A rule to adopt if one appears                                                                                                                                             |
| **Machine-translated UI**  | One JSON file per area, translator notes per area, a lock file hashing the English each translation was made from, a per-language style guide, and a runtime fallback to English when a translation's placeholders differ | English only; CC-4 held (#1035). Input for that item                                                                                                                                       |
| **Pseudo-locale**          | `STUDIO_LOCALE=pseudo` shows every string accented and bracketed, so untranslated and clipped text is visible                                                                                                             | None                                                                                                                                                                                       |
| **Sentences from pieces**  | Banned: one key per sentence, every name, link or count a placeholder, because word order differs by language                                                                                                             | `pnpm ui-strings` catches hard-coded text, not a sentence assembled from two keys. Not checked how often we do it                                                                          |
| **AI tests**               | Real-model runs are recorded, scrubbed and replayed through the real tools in E2E; a drift check diffs the vendor's protocol against a pinned snapshot                                                                    | The Rapidfix E2E (AIB-9). Replay of recorded assistant sessions: nothing found                                                                                                             |
| **App in a named state**   | `scenario <name>` opens the app in a scripted first-run state; `showroom <name>` opens one component gallery inside the real app                                                                                          | Storybook and the test kit; no launcher that opens the app in a named state for a person                                                                                                   |
| **Contributor docs**       | `GLOSSARY.md` (one meaning per noun, with the code name and the on-screen name) and `ANTIPATTERNS.md` (mistakes no script catches, each with why it hurts here)                                                           | A glossary (T1–T5). No anti-patterns page; review findings live in `docs/reviews/`                                                                                                         |
| **State files**            | Each domain is a versioned JSON envelope; a file from a newer version is never overwritten; a corrupt file is renamed aside and reported                                                                                  | The site format handles newer versions (ADR 0012). Preferences and other app state: not checked                                                                                            |
| **Error ownership**        | Every captured error is tagged with an owner; only "ours" is reported, so offline and disk-full noise stays out                                                                                                           | No telemetry, so no reporting; the idea applies to what the local crash report shows                                                                                                       |

### 4.2 Where Webforge is ahead

- **IPC payloads are validated.** Onlook's single channel table (126 invoke, 41 send and 46 emit rows) is typed only: there is no runtime schema, and some handlers hand-check fields. Ours are zod-checked by main on every call. Onlook's table does carry two things worth noting: which view may call each channel, and a `scope` that makes main resolve the caller's project before the handler runs and refuse a request naming another project's path.
- **Tests in CI.** Onlook's CI runs static checks and unit tests on Linux, plus a Windows runtime job. Its 19 Playwright specs do not run in CI, and it has no visual, accessibility or coverage gate. We run all four.
- **Boundary checks** are a module graph (dependency-cruiser); theirs match text with regular expressions and carry 206 grandfathered layer breaches.
- **Platforms:** Windows and macOS against macOS only.
- **Privacy:** no telemetry at all against opt-out analytics with session recording.
- **Updates:** both use electron-updater; ours has a staged rollout, theirs does not.
- **Undo and review of AI changes:** one labelled undo step, a safety version and a review card (AIA-5) against nothing.
- **Release notes:** 148 unreleased changeset files sit in Onlook's tree; release-please from PR titles costs us nothing per PR.

## 5. Where Webforge already stands

| Onlook idea                          | Webforge                                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Own AI account, no credits sold      | ✅ AIA-1…3 (OpenRouter, local servers); also Claude Code and VS Code from outside (AIA-13)          |
| Assistant told what is selected      | ✅ selection and page are sent; "rewrite selected text" on the text toolbar (6.9d)                  |
| Review, undo, cost limits            | ✅ AIA-5, AIA-8. Onlook has none of the three                                                       |
| Prompt-injection defences            | ✅ AIA-9. Onlook's "label it as data" framing matches                                               |
| Tour and one-time tips               | ✅ OB-1…6 shipped: three steps anchored to real controls, five tips, "Show the tour and tips again" |
| Shortcut list                        | ✅ a help page and menu entry                                                                       |
| Per-panel error boundaries           | ✅ `PanelErrorBoundary`, `CanvasErrorBoundary`                                                      |
| Devices side by side                 | 🟡 WF-1 / PG-1, v1.1, waiting on a spike of several Puck frames                                     |
| Notes on the canvas                  | ✅ notes on elements (UX-17), never exported                                                        |
| Reference image                      | 🟡 palette from an image (PG-2) only                                                                |
| Export a page as a picture or PDF    | ❌ nothing; BS9-8 (share a preview link, v1.1) is the nearest                                       |
| Report a problem from inside the app | ❌ nothing; beta testers use the guide in `docs/beta/`                                              |
| The assistant asking questions       | ❌ nothing found: only consent and confirmation prompts                                             |
| "What next" suggestions              | ❌ nothing found                                                                                    |

## 6. Design note: an agent on code versus an assistant on a document

Onlook's agent can do anything because it edits files with a shell, and that is exactly why Onlook needs a private copy of the repository, a hand-written classifier for dangerous git commands, an acknowledged-porous rule against reading `.env` files, and several pages of instructions. Its code carries hundreds of ticket-tagged workarounds for quirks of the two vendor tools, and one of the two (Codex) cannot enforce the dangerous-command gate at all.

Webforge's assistant can only call the tool layer of plan item 4.9, and every call is a `HistoryManager` step. That is a smaller thing, and it is why AIA-5 could promise one undo step, a safety version and a review card with no sandbox. The lesson is to keep it that way: nothing in this review argues for giving the assistant a wider reach. What Onlook does better is the **manner** of the conversation: asking well, saying what it is doing, checking its work and suggesting the next step. Those are prompt and interface changes, not architecture, and they are the first four proposals below.

## 7. Proposals for decision

Sizes are rough ideal days, to be estimated properly if adopted. None is in the plan.

### 7.1 Assistant (builds on 6.9)

| #        | Proposal                                                                                                                                                                                                  | Why                                                                                                                                                                      | Size |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| **OL-1** | **The assistant may ask before it acts:** a question card with up to four one-tap answers, the recommended one first, and room for a note. Used once per topic, never for something it can see for itself | Our assistant can only act or reply in prose. A business owner who types "make it look more professional" gets a guess. One question costs less than an undo             | 2–3  |
| **OL-2** | **"What next" cards:** after a reply that changed the site, two or three short suggestions the person can tap                                                                                             | Non-technical people do not know what to ask for. Onlook ends every changing turn this way                                                                               | 1–2  |
| **OL-3** | **The assistant checks its work before it says "done":** it reads back the page it changed (and runs Site Check on it) and reports what it saw, never success by assumption                               | Onlook makes this a rule in its instructions and gives the agent tools for it. Ours has the tool layer; whether the instructions require the check was not verified here | 1    |
| **OL-4** | **One held message:** text sent while the assistant is working is held, editable, and sent when the reply finishes                                                                                        | Avoids a disabled box and lost text during a long reply                                                                                                                  | 1    |
| **OL-5** | **Typed assistant errors with one or two buttons** (not connected, out of credit, limit reached, service down): check ours against Onlook's list                                                          | Design lesson; may already be met by 6.9a                                                                                                                                | 0–1  |

### 7.2 Editor

| #         | Proposal                                                                                                                                                                                           | Why                                                                                                                                                                                                        | Size                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **OL-6**  | **Input for the WF-1 / PG-1 spike:** show idle or off-screen device views as still thumbnails with separate sleep and wake thresholds; presets as three named sizes; fit without animation on open | The spike's open question is the cost of several Puck frames. Onlook's answer is to keep only the frames being looked at alive                                                                             | 0 (note for the spike) |
| **OL-7**  | **A tip budget on top of OB-4:** one tip per sitting, a tip removes itself after about 45 seconds on screen, a few seconds of quiet after a site opens and between tips                            | OB-4 already shows its five tips once each and one at a time. It has no limit per sitting, no tip closes itself after a while on screen, and there are no quiet periods after a site opens or between tips | 1                      |
| **OL-8**  | **"Things you can ask the assistant":** a searchable list of example requests by topic with a "try it" button that fills the chat box, reachable from the Assistant panel and Help                 | Teaches by example; pairs with OL-2. Onlook's most reusable onboarding idea                                                                                                                                | 2                      |
| **OL-9**  | **Send a page as a picture or PDF:** "Save page as image" / "as PDF" from Preview                                                                                                                  | A business owner wants to show a draft to a partner without publishing. Electron draws both natively (`capturePage`, `printToPDF`), no server needed. A cheaper cousin of BS9-8                            | 2                      |
| **OL-10** | **Report a problem from Help:** one text field and an optional screenshot; with no server it prepares an email or a GitHub issue and never loses the text                                          | We have nothing in-app, and the beta is the moment feedback matters most. Must keep the no-telemetry rule: nothing is sent without the person pressing send in their own mail app or browser               | 2                      |
| **OL-11** | **Design rule: no silent refusal.** Every action that cannot happen says why, in words from the catalogue                                                                                          | Design lesson for reviews; no scope                                                                                                                                                                        | 0                      |

### 7.3 Engineering

| #         | Proposal                                                                                                                                                                                                           | Why                                                                                                                                                                                                                                              | Size                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| **OL-12** | **Pin GitHub Actions to commit SHAs and check it** in `pnpm check` (all 54 `uses:` lines pin tags today), with Renovate keeping the SHAs current                                                                   | A moved tag on a public repository's action runs in our CI with our token. The standard supply-chain hardening                                                                                                                                   | 1                         |
| **OL-13** | **Widen secret scanning to generic secrets.** Either turn on GitHub's non-provider patterns (a repository setting, no work), or add Gitleaks (pinned and checksum-verified) to the lefthook pre-push hook, or both | GitHub's scanning and push protection are already on, but only for known providers' tokens. Generic patterns add passwords and private keys; a local hook stops a secret before it leaves the computer, where push protection stops it at GitHub | 0 (setting) or 0.5 (hook) |
| **OL-14** | **A pseudo-locale for the editor** (`WEBFORGE_LOCALE=pseudo`): accented, lengthened strings                                                                                                                        | Finds clipped labels and strings that skipped `t()` now, at no translation cost, and prepares CC-4                                                                                                                                               | 1                         |
| **OL-15** | **Record for CC-4 (#1035):** lock file of English hashes, translator notes per area, one key per sentence, fall back to English when placeholders differ                                                           | Onlook ships three languages with one script and no translator on staff                                                                                                                                                                          | 0 (note on the issue)     |
| **OL-16** | **Replay of recorded assistant conversations in tests:** record a real run once, scrub it, replay it through the real tool layer                                                                                   | Tests the assistant's loop and the review card without spending tokens or depending on a model's mood                                                                                                                                            | 2–3                       |
| **OL-17** | **An anti-patterns page** (`docs/anti-patterns.md`): mistakes review keeps finding that no check catches, each with why it hurts here, seeded from `docs/reviews/`                                                 | Review findings are currently spread over review documents; coding assistants read one page more reliably than twelve                                                                                                                            | 0.5                       |

### 7.4 Not proposed

- **An infinite canvas with free-floating frames, sections and notes:** a design-exploration surface. Our user edits one page; WF-1 covers the useful part.
- **Editing through the assistant only:** direct controls are our product.
- **A subscription sign-in to Claude or ChatGPT inside the Assistant panel:** needs the vendors' proprietary command-line tools bundled or downloaded; AIA-14 already says "not now", and AIA-13 covers those users from outside.
- **A shell, file access or page scripting for the assistant:** see §6.
- **Telemetry, session recording, an account:** against spec/02 §4.
- **Margin and padding bands, Alt-to-measure:** tools for designers, noise for our audience.
- **Changesets:** release-please already does this from PR titles.
- **A single IPC table without schemas, regex boundary checks, StyleX/Astryx:** ours are stricter or already chosen.
- **Sounds when the assistant finishes, a task manager, tabs for several sites:** not asked for by anyone.

### 7.5 Suggested order

If only three are taken: **OL-12** (a day, the one real gap in the security of a public repository's CI), **OL-1** (the largest change to how the assistant feels) and **OL-2** (its natural pair). OL-13's setting costs nothing and can be switched on whenever it is decided; its hook is optional. OL-3 and OL-8 are the next group, and OL-9 and OL-10 are the two that add something a business owner would notice outside the assistant.

## Sources

- Onlook: [home](https://www.onlook.com/) · [features](https://www.onlook.com/features) · [AI features](https://www.onlook.com/features/ai) · [pricing](https://www.onlook.com/pricing) · [about](https://www.onlook.com/about) · [FAQ](https://www.onlook.com/faq)
- Docs: [landing](https://docs.onlook.com/) · [architecture](https://docs.onlook.com/developers/architecture.md) · [quick start](https://docs.onlook.com/start/quickstart-codebase.md)
- Source: [onlook-dev/onlook](https://github.com/onlook-dev/onlook) at `721de14` (20 Nov 2026). Files cited by area:
  - guides: `README.md`, `AGENTS.md`, `CODING.md`, `GLOSSARY.md`, `ANTIPATTERNS.md`, `WRITING.md`, `ASSETS.md`
  - canvas: `apps/studio/src/renderer/src/canvas/` (`frame/presets.ts`, `frame/idle.ts`, `camera.ts`, `snapping.ts`, `model.ts`), `apps/studio/src/preload/guest.ts`
  - tips and tour: `renderer/src/tips/` (`early.ts`, `moment.ts`, `lifetime.ts`), `renderer/src/tour/`, `renderer/src/shortcuts/registry.ts`
  - assistant: `apps/studio/src/main/agent-host/` (`backend.ts`, `tool-names.ts`, `studio-tools.ts`, `destructive-git.ts`, `pen.ts`), `apps/studio/src/instructions/`, `packages/events/src/events.ts`, `packages/chat-ui/src/`
  - IPC and security: `packages/events/src/channels.ts`, `apps/studio/src/main/ipc/`, `main/frames/`, `main/artifacts/`, `apps/studio/build/harden-electron.mjs`
  - checks: `scripts/check-imports.ts`, `scripts/workflow-security.ts`, `scripts/secrets.ts`, `scripts/third-party.ts`, `scripts/translate-strings.ts`, `packages/i18n/src/`
  - tests: `tests/apparatus/`, `tests/e2e/`, `tests/live/`, `scripts/scenario.ts`, `scripts/showroom.ts`
- Webforge: [assistant](../product/14-in-app-ai-assistant.md) (AIA-1…14) · [site from a brief](../product/16-ai-site-from-a-brief.md) · [onboarding and tour](../product/17-onboarding-and-tour.md) (OB-1…7) · [Webflow review](01-webflow.md) (WF-1, WF-2) · [Pinegrow review](02-pinegrow.md) (PG-1) · [canvas engine](../stack/04-canvas-engine.md)
