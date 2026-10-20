# CLAUDE.md: guidance for coding assistants

Read the specs before making changes:
- **Architecture:** `spec/01-architecture.md`
- **MVP spec:** `spec/02-mvp-spec.md`
- **Engineering standards:** `spec/03-engineering-standards.md` (authoritative)
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
- `pnpm check`: the static checks and unit tests CI runs (`lint`, `typecheck`, `deps`, `knip`, `licence-check`, `test`). Run it before opening a PR.
- `pnpm e2e`: builds the desktop app and runs the Playwright tests: the Electron app (`e2e/app/`) and the exported fixture site opened from disk in Chromium, Firefox and WebKit (`e2e/export/`). Also run in CI. Run it when touching main, preload, the renderer bootstrap, security settings, site components or the pipeline. First time: `pnpm --filter @webforge/e2e exec playwright install chromium firefox webkit`.
- `pnpm e2e:packaged`: packages the app (`electron-builder --dir`) and runs `e2e/packaged/` against it (CI on Windows + macOS). Run it when touching packaging, Fuses or native modules.
- `pnpm format`: apply Biome fixes. `pnpm build`: build all workspaces.
- Workspace packages are consumed from source (`exports` → `src/index.ts`). Import them as `@webforge/<name>`, never by path. Relative imports use `.js` extensions (`./foo.js` for `foo.ts`).

## Workflow
- Conventional Commits (`feat(history): …`), enforced by commitlint in a lefthook `commit-msg` hook.
- Short-lived branches, PRs into `main`, squash merge.
- **`main` is not branch-protected** (GitHub Free plan, private repo), so nothing technically stops a direct push. Always working through PRs with green CI is a **team convention**: never push or merge to `main` directly.
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
