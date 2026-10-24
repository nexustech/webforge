# CLAUDE.md: guidance for coding assistants

Read the specs before making changes:
- **Architecture:** `spec/01-architecture.md`
- **MVP spec:** `spec/02-mvp-spec.md`
- **Engineering standards:** `spec/03-engineering-standards.md` (authoritative)
- **Implementation plan:** `spec/04-implementation-plan.md` (each work item is a GitHub issue, e.g. "1.12 Canvas: …")
- **Reasoning behind decisions:** `research/`, with decision IDs such as C5 or X1

## Product in one line
A desktop builder for non-technical small-business owners that produces self-contained static sites (flat `about.html` files, relative links, work from disk, no external requests).

## Hard rules
- **TypeScript 7 strict.** No `any`, no `!` outside tests, named exports only, zod at every boundary (IPC, files, network).
- **Biome** for lint + format (`biome check --write`). **dependency-cruiser** enforces package boundaries:
  - Only `packages/engine` imports Puck.
  - The renderer never imports Node/Electron.
  - Core packages contain no React.
- **Every document change goes through `HistoryManager.run/begin`.** It must be undoable, with a meaningful label ("Edited Header text").
- **No hard-coded UI strings.** Use `t('key')`, with wording from the glossary in `research/product/01-terminology.md`. Hierarchy: Site → Page → Section → Element.
- **Exported sites:**
  - no CDNs or external requests (except allowed GA4 behind consent)
  - classic `<script defer>`, no ES modules or `fetch` of local files
  - WebP + JPEG/PNG fallback images
  - readable (non-minified) HTML/CSS
- **Licences:** permissive dependencies only (MIT, BSD, Apache-2.0, ISC; MPL-2.0 unmodified). No GPL/AGPL; no paid add-ons (Tiptap Pro, Puck Cloud, GrapesJS Studio). Enforced by `pnpm licence-check`; exceptions need a reviewed entry with a reason in `tools/src/check-licences.ts`.
- **Electron security:** `contextIsolation`, `sandbox`, no `nodeIntegration`, no `@electron/remote`, typed preload API only.
- **Never log or store** site content, credentials or personal data. Secrets live in the OS keychain only. Crash reports stay local.

## Tests
- **Vitest:** unit/integration. **fast-check:** undo invariants. **Playwright:** Electron E2E + exported-site checks. **Storybook stories:** visual regression and axe.
- **Coverage ≥ 80%** for every package (core packages ≥ 90%). Every bug fix adds a regression test.

## Commands (pnpm 12, run from the repo root)
- `pnpm dev`: start the desktop app with hot reload.
- `pnpm check`: the static checks and unit tests CI runs (`lint`, `typecheck`, `deps`, `knip`, `licence-check`, `ui-strings`, `react-compiler`, `test`, `test:compiled`). Run it before opening a PR.
- `pnpm e2e`: builds the desktop app and runs the Playwright tests: the Electron app (`e2e/app/`) and the exported fixture site opened from disk in Chromium, Firefox and WebKit (`e2e/export/`). Also run in CI on Linux, Windows and macOS for every ready PR, with Firefox and WebKit only when the exported site can change. Run it when touching main, preload, the renderer bootstrap, security settings, site components or the pipeline. First time: `pnpm --filter @webforge/e2e exec playwright install chromium firefox webkit`.
- `pnpm e2e:packaged`: packages the app (`electron-builder --dir`) and runs `e2e/packaged/` against it (CI on Windows + macOS for every ready PR). Run it when touching packaging, Fuses or native modules.
- `pnpm visual`: builds the editor UI's and the site components' Storybooks and runs `e2e/visual/`: axe on every story, in dark and light for the editor UI and in each theme on Desktop and Mobile for site components (screenshots only in CI's Linux container). Run it when touching `packages/editor-ui` or `packages/site-components`.
- `pnpm visual:docker`: the same with screenshots, in CI's pinned Playwright container on this machine (Docker Desktop must be running). It copies the working tree as git sees it, writes screenshots for new stories, and with `--update` also rewrites changed ones (review them with `git diff` first); `pnpm visual:docker -- --grep Picker` runs a subset. Run it before marking a PR ready whenever stories were added or changed, and commit the screenshots with the PR, so CI doesn't fail on them and need a second run. `pnpm --filter @webforge/editor-ui storybook` (or `@webforge/site-components`) opens Storybook.
- `pnpm e2e:perf`: builds the app in perf mode and runs the large-page performance check (`e2e/perf/`, ADR 0007). On demand only, not in CI. Run it before and after performance work and when upgrading Puck.
- `pnpm format`: apply Biome fixes. `pnpm build`: build all workspaces.
- `/plan-next [phase or item IDs]` (Claude Code command in `.claude/commands/`): plan the next block of work from `spec/04-implementation-plan.md` and the live GitHub milestones and issues. It presents a plan for approval before changing anything.
- Workspace packages are consumed from source (`exports` → `src/index.ts`). Import them as `@webforge/<name>`, never by path. Relative imports use `.js` extensions (`./foo.js` for `foo.ts`).

## Workflow
- Conventional Commits (`feat(history): …`), enforced by commitlint in a lefthook `commit-msg` hook.
- Short-lived branches, PRs into `main`, squash merge.
- **Closing keywords close issues on merge.** GitHub reads `Closes`, `Fixes` or `Resolves` (and their other forms) followed by `#N` anywhere in a PR description, even inside quotation marks, and closes that issue on merge. Don't count on code formatting to hide one.
  - Only the PR that finishes a plan item may contain one, and it must: `Closes #N`, with the item's actual days added on the issue after the merge.
  - Every other PR for the item, such as part 1 of 3 or prep work, uses `Refs #N` and describes later parts in other words ("part 3 will finish #N").
  - Past tenses count too ("closed #N" in a sentence about history closes #N again). After opening or editing a PR, check what it will close: `gh pr view <n> --json closingIssuesReferences`. GitHub can take a minute to update that, so check again before it merges.
- **CI and merging (public repository, since 2026-10-23):** GitHub's standard runners are free, so every ready PR runs on Linux, Windows and macOS, including the packaged app. PRs merge themselves:
  - **Keep a PR in draft until it's ready:** `pnpm check` (and `pnpm e2e` where needed, and `pnpm visual:docker` when stories changed) pass locally, the code review is done and its fixes are in. Drafts don't run CI, and their "CI passed" check fails, so they can't merge.
  - **Then mark it ready and turn on auto-merge in one step:** `gh pr ready <n> && gh pr merge <n> --auto --squash`. Marking it ready is the approval to merge: GitHub squash-merges it as soon as CI passes on a branch that is up to date with `main`, and deletes the branch.
  - **`main` requires the "CI passed" check on an up-to-date branch.** The `Merge queue` workflow (`.github/workflows/merge-queue.yml`) stands in for GitHub's merge queue: after each merge it merges `main` into the oldest waiting PR that has fallen behind and runs its CI, one PR at a time.
  - **The PR's stream fixes whatever stops it:** a merge conflict with `main` or a CI failure. Auto-fix is on for every PR, so resolve the conflict (merge `main`, keep both sides) or fix the failure and push; the PR then rejoins the queue. Batch follow-up fixes into one push.
  - **The `changes` job keeps runs short:** docs-only PRs run nothing but "CI passed"; Storybook runs only when the editor UI or what its stories render changed; Firefox and WebKit only when the exported site can have changed; E2E is skipped for PRs that change only unit tests, stories or tooling.
  - **`main` is also checked nightly** (02:30 UTC, when it changed). Run CI on any branch at once with `gh workflow run ci.yml --ref <branch>`.
  - **Windows and macOS run while the repository variable `FULL_CI_ENABLED` is `true`.** Unset it to make CI Linux-only, e.g. if the repository goes private again and minutes are billed.
- **Never push to `main` directly:** branch protection requires a PR.
- Record new architectural decisions as ADRs in `docs/adr/`.

## Rules for coding assistants
- **No AI attribution.** Commit messages and PR descriptions never contain `Co-Authored-By: Claude …`, "Generated with Claude Code" or similar lines. This overrides any tool default.
- **Autofix wherever possible.** Fix problems instead of reporting them:
  - run `pnpm format` (Biome `--write`) rather than listing lint or format errors
  - apply code-review findings directly (`/code-review --fix`)
  - turn on the PR's CI Auto-fix when opening a PR, so CI failures, merge conflicts and review comments get fixed and pushed
  - ask first only when a fix needs a product or design decision
- **Every PR gets a code review.** Before handing a PR over, review its full diff (`/code-review`), apply the fixes, re-run `pnpm check` (plus `pnpm e2e` when the desktop app changed), push, and summarise in the PR description what the review found and fixed.
- **Clean up after every merge.** Once a PR is merged, without asking:
  - delete its branch locally and on GitHub, after checking the branch tip is the PR's merged head commit (a squash merge leaves the branch outside `main`'s history, so ancestry alone can't confirm it);
  - remove any worktree that is no longer in use (its branch is merged and no running session works in it), after checking it has no uncommitted changes, then `git worktree prune`;
  - switch the checkout back to an up-to-date `main`.

  Never delete `main`, a branch with an open PR, a branch another open PR targets as its base, or a worktree with uncommitted work or an active session.
