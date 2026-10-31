# Engineering Standards

**Version:** 1.0 draft, 2026-10-19
**Applies to:** all code in the Webforge monorepo ([architecture §4](01-architecture.md#4-package--module-structure-pnpm-monorepo))
**Legend:** **[Recommended]** = proposed default, confirm before repo setup (see §11)
Versions checked on npm on 2026-10-19.

## 1. Toolchain

| Concern | Tool | Version | Licence | Notes |
|---|---|---|---|---|
| Language | **TypeScript** (native compiler) | 7.0 | Apache-2.0 | Strict mode, project references |
| Runtime | Node (Electron's) | 24 | — | Local dev Node pinned via `.nvmrc` / `packageManager` |
| Package manager | **pnpm** workspaces | 12.x | MIT | `pnpm-lock.yaml` committed; `packageManager` field pinned |
| Task runner | **Turborepo** ✅ | 2.x | MIT | Cached `build/lint/test` across packages; remote cache optional later |
| Bundling (app) | **electron-vite** + Vite | 6 / 8 | MIT | Main, preload, renderer builds |
| Packaging | **electron-builder** + electron-updater ✅ | 26.x | MIT | NSIS (Win), DMG (macOS); mature (since 2015), actively released |
| Native modules | **better-sqlite3** ✅ | 13 | MIT | Node-API prebuilds load in Node and Electron as shipped: no rebuild; unpacked from asar ([ADR 0003](../docs/adr/0003-wforge-sqlite-storage.md)). `@electron/rebuild` only if a release drops prebuilds. Keep native modules to a minimum |
| Lint + format | **Biome** ✅ (single tool: linter + formatter) | 2.5 | MIT OR Apache-2.0 | Replaces ESLint + Prettier. Formatting is never debated in review. See §2a for rule set and known gaps |
| Architecture rules | **dependency-cruiser** | 18 | MIT | Enforces package boundaries (§3). Parses with swc (`@swc/core`, Apache-2.0) because TypeScript 7 has no JavaScript compiler API ([ADR 0001](../docs/adr/0001-monorepo-tooling.md)) |
| Dead code | **knip** | 6 | ISC | Unused files, exports, dependencies |
| Unit/integration tests | **Vitest** (+ coverage-v8, browser mode) | 5.0 | MIT | |
| Component tests | **@testing-library/react** in Vitest browser mode | 16 | MIT | |
| Property tests | **fast-check** | 4.10 | MIT | Undo/history invariants, migrations |
| E2E | **Playwright** (`_electron`) | 1.64 | Apache-2.0 | Electron app + exported sites in Chromium/Firefox/WebKit |
| Accessibility | **@axe-core/playwright** | 4.14 | MPL-2.0 | Dev-only, unmodified, OK under C1 |
| UI workshop | **Storybook** (react-vite) ✅ | 10.6 | MIT | Site components × themes × devices, editor UI states; stories reused by visual regression, a11y and interaction tests |
| Validation | **zod** | 4.6 | MIT | Document schema, IPC messages, settings |
| Logging | **electron-log** | 5.4 | MIT | File + console; no personal data in logs |
| Git hooks | **lefthook** | 2.2 | MIT | Pre-commit: `biome check --write` on staged files; commit-msg: commitlint |
| Commits | **commitlint** (Conventional Commits) | 21 | MIT | Drives changelog |
| Releases | **release-please** | 17 | Apache-2.0 | Version bumps + CHANGELOG from commits |
| Licence check | **`pnpm licenses list`** (built in) + `tools/src/check-licences.ts` | pnpm 12 | — | Allow-list from C1 with reviewed per-package exceptions; fails CI on every OS (`pnpm licence-check`). Replaces license-checker-rseidelsohn ([ADR 0002](../docs/adr/0002-licence-check.md)) |
| Mutation testing (later) | Stryker | 10 | Apache-2.0 | Optional, for `history`/`model` |

## 2. TypeScript rules
- `tsconfig.base.json`:
  - `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
  - `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`, `verbatimModuleSyntax: true`
  - `module`/`moduleResolution: "nodenext"` (Node code) / `"bundler"` (renderer)
- **No `any`** (Biome `noExplicitAny` error). Use `unknown` + zod parsing at boundaries (IPC, file loading, network responses).
- **No non-null assertions (`!`)** except in tests.
- **Types:** prefer `type` aliases and discriminated unions for domain types; `interface` for public contracts (e.g. `CanvasEngine`).
- **Exports:** named exports only. No default exports, except where a tool requires them (Storybook stories, Vite config).
- **IDs:** branded types for IDs (`type PageId = string & { __brand: 'PageId' }`).
- **Async:** `async`/`await`, no floating promises (convention + review, see §2a), `AbortSignal` for cancellable work (builds, publishing).
- **Enums:** use `as const` objects or union literals instead.

## 2a. Biome configuration
- One root `biome.json` with `formatter` (2-space indent, line width 100, double quotes) and `linter` (recommended rules + the rules below). `biome ci` runs in CI.
- **Rules enabled as errors** (Biome 2.5):
  - `noExplicitAny`
  - `noNonNullAssertion` (except tests)
  - `useExhaustiveDependencies`, `useHookAtTopLevel` (React)
  - the **a11y** group: `useAltText`, `useButtonType`, `useAnchorContent`, `useKeyWithClickEvents`, `useValidAnchor`…, plus nursery a11y rules once stable
  - `noRestrictedImports` / `useImportRestrictions` (nursery; enable and pin the Biome version)
- **Known gaps vs ESLint, and mitigations:**
  - ~~No floating-promise detection.~~ Biome 2.5 has nursery `noFloatingPromises` and `noMisusedPromises`; both are enabled as errors (Biome version pinned). Keep the convention "every promise is awaited, returned or passed to `void track()`"; Oxlint's type-aware rule remains a fallback if the nursery rules prove unreliable.
  - **No React Compiler-specific lint rules.** Mitigation: `pnpm react-compiler` (part of `pnpm check` and CI) runs the compiler over the renderer, editor UI and engine (the code it compiles) and fails on anything it can't compile or that turns it off ([ADR 0010](../docs/adr/0010-react-compiler.md)).
  - **Package boundaries** are enforced by **dependency-cruiser** (§3), not the linter.

## 3. Architecture & boundaries
Enforced in CI by dependency-cruiser:
- `model`, `history`, `storage`, `publish` and `pipeline` core logic: **no React, no Electron renderer APIs**.
- **Only `packages/engine` imports Puck.** **Only `editor-ui` + renderer import shadcn/ui.**
- Renderer code never imports Node built-ins or `electron` (only the typed `window.webforge` preload API).
- `site-components` must not import editor packages. Its components must render with `renderToStaticMarkup` without browser globals.
- **Document mutations only through `HistoryManager.run/begin`.** Direct store writes to the document are a lint error (custom rule or restricted-imports on the raw setter).
- **IPC contract:** one `ipc-contract.ts` defines channels with zod schemas. Main validates every incoming message. No string-typed ad-hoc channels.
- New architectural decisions are recorded as short **ADRs** in `docs/adr/NNNN-title.md` (context, decision, consequences), linking to research notes.

## 4. Code style & conventions
| Topic | Rule |
|---|---|
| Files & folders | `kebab-case.ts`; React components `PascalCase.tsx`; one component per file; tests next to code as `*.test.ts(x)` |
| Naming | `camelCase` values/functions, `PascalCase` types/components, `useX` hooks, `SCREAMING_SNAKE` only for true constants; stores `*.store.ts` |
| React | Function components only; React Compiler enabled for the editor (renderer, `editor-ui`, `engine`; [ADR 0010](../docs/adr/0010-react-compiler.md)), so no manual `useMemo`/`useCallback` unless measured, and nothing written to a ref or state while rendering. **`site-components` stay uncompiled on purpose:** compiled, they made `pnpm e2e:perf`'s 225-element page load in 2.1–2.3 s instead of 1.1–1.2 s and drag in 3.5–4.2 s instead of 1.3–1.5 s, and the export renders them uncompiled; measure before changing that. Correctness never depends on memoization (unit tests run uncompiled). No business logic in components (use hooks/stores); props typed explicitly |
| State | Document state in the document store (via history). UI state (selection, panels, zoom) in a separate UI store, never in history (U6). Server/async state in dedicated hooks |
| Styling (editor) | shadcn/ui components + Tailwind tokens only; `cn()` for class merging; no inline styles, no ad-hoc colours; dark/light via CSS variables |
| Styling (site components) | daisyUI + Tailwind utilities only; style props must map to **design tokens**, never free-form values (except Advanced classes) |
| UI text | **No hard-coded user-facing strings.** Use `t('key')` from `packages/i18n`, with wording from the glossary ([terminology](../research/product/01-terminology.md)). Undo labels built from glossary terms (D2) |
| Errors | Throw `WebforgeError` subclasses with a `code` and an i18n `messageKey`. Never show raw error text or stack traces to users. Log the details with electron-log |
| Logging | `log.info/warn/error` with structured context. **Never log** site content, credentials, tokens or personal data |
| Comments | Explain *why*, not *what*. TSDoc on all exported functions/types of packages |
| Dependencies | New runtime dependency needs: permissive licence (C1), active maintenance, a size check, and a note in the PR. Prefer small/pure-JS/WASM over native modules. **GSAP and libraries built on it are never a licence exception** (PG-6, 2026-10-24): since Webflow's acquisition its terms exclude competing no-code website builders, and Pinegrow's Interactions licence forbids the same. Site animations stay CSS presets with a small classic script (F-DS-5) |
| Security | No `eval`/`new Function`; no `shell.openExternal` with untrusted URLs without validation; no remote code loading; sanitise SVG and Custom HTML before canvas injection |
| Accessibility | Editor: all interactive elements reachable by keyboard, visible focus, labelled controls (Biome a11y rules). Site components: WCAG 2.1 AA (see §5) |

## 5. Testing strategy

### Test pyramid
| Level | Tool | What | Where |
|---|---|---|---|
| **Unit** | Vitest | Pure logic: model, migrations, history, patch coalescing, token→class mapping, pipeline steps, manifest diffing, Site Check rules | `packages/*/src/**/*.test.ts` |
| **Property-based** | fast-check + Vitest | **Undo invariant**: random action sequences → undo all = initial state, redo all = final state. Coalescing never loses data. Migrations: any vN fixture → latest is valid | `packages/history`, `packages/model` |
| **Integration** | Vitest (Node) | Storage against real SQLite (temp files): transactions, crash simulation, GC, versions. Pipeline: build fixture sites end-to-end in memory. Publishers against local test servers (FTP/SFTP containers, mocked Netlify API via msw) | `packages/*/test/` |
| **Component** | Vitest browser mode + Testing Library | Editor panels, dialogs, Edit panel fields; keyboard interaction | `packages/editor-ui` |
| **Golden output** | Vitest snapshots | Exported HTML/CSS for each template is **byte-stable** and readable (X4); changes reviewed in PRs | `packages/pipeline/test/golden/` |
| **Visual regression** | Playwright `toHaveScreenshot` over **Storybook stories** (in a pinned Linux container for stable fonts) | Every site component × 3 themes × Desktop/Mobile; templates' key pages | `e2e/visual/` |
| **Accessibility** | @axe-core/playwright | All templates and components exported: zero serious/critical violations | `e2e/a11y/` for exported sites and templates (Phase 3); Storybook stories (editor UI and site components) are checked in `e2e/visual/` |
| **E2E (app)** | Playwright `_electron` on Windows + macOS | Critical journeys: new site from template → edit text → change theme → undo/redo → add page → export → opens from disk; publish to a mocked Netlify; version restore; crash during save | `e2e/app/` |
| **Exported-site compatibility** | Playwright Chromium/Firefox/WebKit with `file://` | Fonts, scripts, links work from disk; **network blocked → zero external requests** (C8) | `e2e/export/` |
| **Performance** | `vitest bench` + Playwright traces | Budgets from [architecture §10](01-architecture.md#10-performance-targets); CI fails on >20% regression | `bench/` |

### Coverage targets (enforced per package)
**Minimum for every package: 80%** (lines, branches, functions, statements), enforced by Vitest coverage thresholds in CI.

| Package | Lines / branches |
|---|---|
| `model`, `history`, `storage`, `pipeline`, `publish` | **≥ 90% / ≥ 85%** (core logic, held higher) |
| All other packages (`engine`, `site-components`, `themes`, `editor-ui`, `apps/desktop`, `i18n`) | **≥ 80% / ≥ 80%** |

Coverage is a floor, not a goal. Every bug fix adds a regression test.

### Storybook conventions
- **Every site component** has stories for its main variants. A global toolbar switches **theme** and **device width** (Desktop/Tablet/Mobile).
- **Every editor-ui component** has stories for its states (default, hover/focus, disabled, error, loading, empty).
- **Stories are tests:**
  - Playwright screenshots stories for visual regression.
  - axe runs on every story.
  - `play` functions script keyboard and mouse interactions (e.g. open the FAQ accordion with the keyboard).
- Stories live next to components as `*.stories.tsx`. Storybook builds in CI; a broken story fails the build.

### Test conventions
- **Naming and structure:** `describe('<unit>')` + `it('does X when Y')`; Arrange-Act-Assert; no test interdependence.
- **Fixtures:** `packages/test-utils/fixtures/`: sample sites and **one `.wforge` file per released format version** (never deleted, guaranteeing old files open).
- **Mocking:** don't mock what you own; mock only boundaries (network via msw, clock via fake timers, filesystem via temp dirs).
- **Flakiness:** no flaky tests on `main`. A flaky test is quarantined within 24 h with an issue, and fixed or deleted within a week.
- **Time in tests** ([ADR 0014](../docs/adr/0014-time-budgets-under-load.md)): measure the work itself where a clock isn't the point (CPU time, what was read or encoded). An E2E budget is a CPU budget set from CI's runners plus a loose wall-clock backstop (`measureWork`, `expectWorkWithin`), never retried; the spec's own targets, such as opening a site in under 3 s (F-SITE-1), are checked by `pnpm e2e:perf` on a quiet machine. Wait generously (`OPEN_WAIT`, `BACKGROUND_WAIT`), and scale unit timeouts to the run's workers (`vitest.load.ts`). Never a bare `Date.now()` comparison against a target from the spec.

## 6. Git workflow
- **Trunk-based:** short-lived branches (`feat/…`, `fix/…`, `chore/…`), PRs into `main`, **squash merge**.
- **Clean up after merging:** delete the branch locally and on GitHub once its PR is merged, and remove worktrees that are no longer in use, so merged branches don't linger. Keep a merged branch only while another open PR targets it as its base.
- **`main` is branch-protected** (the repository is public, so GitHub Free includes it): changes arrive only through PRs, and a PR merges only when the "CI passed" check passes on a branch that is up to date with `main`.
- **Auto-merge:** a PR stays in draft until it's ready (§7), then is marked ready. A high-effort code review of its full diff comes before every merge (product owner, 2026-10-23); auto-merge is turned on once that review passes, and GitHub squash-merges the PR, with its title and description as the commit message, once CI passes. The `Merge queue` workflow brings waiting PRs up to date with `main` one at a time, and the PR's author (its stream) resolves conflicts and fixes CI failures, through PR Auto-fix.
- **Conventional Commits** (`feat(history): coalesce text sessions`), enforced by commitlint. release-please generates versions and the CHANGELOG.
- **PR requirements:** green CI, 1 review, description with *what/why/how tested*, screenshots or GIFs for UI changes, ADR link for architectural changes.
- **Versioning:** SemVer for the app. `format_version` for `.wforge` is independent and bumped with a migration + fixture.
- **AI-assisted development:** keep a concise `CLAUDE.md` / `AGENTS.md` at the repo root summarising these standards, commands and boundaries, so coding assistants follow them. Assistant-made changes follow the same rules as human ones, plus:
  - no AI attribution lines in commits or PR descriptions
  - problems are auto-fixed rather than reported (formatting, review findings, CI failures through PR Auto-fix)
  - every PR gets a code review of its full diff, with the fixes applied, before it is handed over for review and merge

## 7. Continuous integration (GitHub Actions ✅)
| Job | Runs on | When |
|---|---|---|
| Install + cache (pnpm, Turborepo) | all | every push/PR |
| `biome ci` (format + lint), typecheck (`tsc -b`), dependency-cruiser, knip | Linux | every PR |
| Unit + property + integration tests with coverage gates | Linux; Windows, macOS | Linux: every PR + nightly; Windows, macOS: nightly and manual runs (since 31 Oct 2026, research/stack/09 CI-2) |
| Licence check (C1 allow-list) + vulnerability audit (`pnpm audit` / OSV) | Linux; the licence check also on Windows + macOS, in the packaged-app job | every PR + nightly |
| Golden output + visual regression + a11y | Linux container | PRs that change the editor UI or what its stories render + nightly |
| E2E app + exported-site compatibility | Linux, Windows, macOS | every PR except unit-test-only ones (app + Chromium; Firefox and WebKit when the exported site can change, Firefox on Linux only) / nightly (full) |
| Packaged app (electron-builder, Fuses, native modules) | Windows + macOS | every PR + nightly |
| Performance benchmarks | macOS + Windows | nightly; PR when labelled |
| Release build: sign (Windows code signing, macOS Developer ID + notarisation), publish update feed | Windows + macOS | on release tag |

- **Cost (public repository, since 2026-10-23):** GitHub's standard runners are free for public repositories, Windows and macOS included, so every ready PR runs on all three. The Free plan runs at most 20 jobs at once, 5 of them on macOS, so macOS jobs can queue when several PRs run together. A `changes` job still skips what a PR can't affect (see `.github/workflows/ci.yml`), to keep runs short: docs-only PRs (`docs/`, `spec/`, `research/`, Markdown) run nothing else. Draft PRs don't run CI: keep a PR in draft until `pnpm check` passes locally and its review is done.
- **The required check:** "CI passed" always runs and fails if any job failed or was cancelled, or if the PR is a draft, so `main` can require one check whatever the `changes` job skipped. With the up-to-date requirement, PRs that pass alone but clash are caught before they merge, not by the nightly run.
- **Merge queue:** GitHub's own merge queue needs an organisation-owned repository, so `.github/workflows/merge-queue.yml` stands in for it. After each merge (and each finished CI run), it merges `main` into the next waiting PR that is behind and starts its CI, one PR at a time: docs-only PRs first, as their CI takes seconds, then the oldest. It compares each PR's head with `main` rather than trusting GitHub's merge state, which reads "unknown" for a while after a merge. PRs with conflicts or failing CI wait for their author to push a fix or re-run a flaky job.
- **Run length:** a full PR run took about 7.5 minutes on 24 Oct 2026 (#328), down from 13–15. By 28–31 Oct the Storybook job alone took 17–18 minutes and Linux's E2E 11–12, so since 31 Oct both run in two shards, as Windows' and macOS' E2E do. The Firefox and WebKit export tests wait only for Linux's E2E, the static checks run on Linux only, and on a PR the unit tests do too (Windows and macOS run them nightly). A PR run uses 3 macOS jobs of the Free plan's 5 (two E2E shards and the packaged app), down from 4.
- **Windows/macOS switch:** those jobs run only while the repository variable `FULL_CI_ENABLED` is `true` (it is). Unset it to make CI Linux-only if the repository goes private again and minutes are billed (Windows minutes count 2× and macOS 10× on private repositories).
- **Dependency updates:** Renovate (`renovate.json`), weekly, grouped, pnpm catalog included. Every minor and patch in one pull request a week, each major on its own, with groups of their own for Electron, Playwright (its package and CI's container together), Puck and the workflows' actions. **Electron upgraded at least quarterly** (01). A new Electron major waits for approval on Renovate's Dependency Dashboard, to land at a phase boundary (risk R7).
- **Vulnerability check:** Dependabot alerts, plus CI's "Dependency audit" job on every PR that changes a manifest, the lockfile or `pnpm-workspace.yaml`, and every night, whether or not `main` changed. It fails on a high or critical finding in any dependency (`pnpm audit --audit-level=high`), and on a moderate one in production dependencies (`pnpm audit --prod --audit-level=moderate`). Dependabot reads versions from the manifests, so it can't see packages taken from the pnpm catalog (`"catalog:"`); the audit reads the lockfile and covers them. A package with an open advisory is pinned in each manifest until it is fixed, so Dependabot can close its alert (happy-dom, #332).
- **Secrets** (signing certificates, notarisation credentials) only in CI secret storage, never in the repo.

## 8. Definition of Done
A change is done when:
- [ ] Code follows these standards; `biome ci`, typecheck and boundaries pass
- [ ] Tests added/updated at the right level; coverage floors met
- [ ] User-facing text uses i18n keys and glossary terms; undo labels are meaningful
- [ ] Undoable if it changes the site (D-rules); confirmation rule respected (D7)
- [ ] Accessible (keyboard, labels; axe clean for site output)
- [ ] No new external requests in exported sites (C8) unless explicitly allowed
- [ ] Performance budgets not regressed
- [ ] Docs/ADR updated when behaviour or architecture changes
- [ ] Reviewed and merged via PR with green CI

## 9. Documentation
- `spec/`: architecture, MVP spec, these standards (living documents, versioned with the code).
- `research/`: background and rationale (frozen unless decisions change).
- `docs/adr/`: decisions taken during implementation.
- **Package READMEs:** purpose, public API, example.
- **User help** content written in glossary language, stored with the app.

## 10. Release & support policy
- **Channels:** *Beta* (opt-in) and *Stable*. Staged rollout via the update feed.
- **Crash reporting:** **local only, never uploaded automatically.** Timestamped JSON reports (+ native minidumps) in the user's crash-reports folder ([architecture §9](01-architecture.md#9-security--privacy), MVP F-SITE-7). Code must route uncaught errors through the shared crash handler. Reports must pass the same "no personal data" rule as logs (§4). Future: in-app review and user-initiated sharing.
- **Backwards compatibility:** every release opens every older `.wforge` (fixture tests). Files from a *newer* version open read-only with an "Update Webforge" message.

## 11. Decisions to confirm
1. ~~ESLint + Prettier vs Biome~~ → ✅ **Decided: Biome** (see §2a for gaps and mitigations).
2. ~~Turborepo~~ → ✅ **Decided: Turborepo** on pnpm workspaces.
3. ~~GitHub~~ → ✅ **Decided: GitHub** for the repository, PRs and Actions CI, on the GitHub Free plan. Public since 2026-10-23 (product owner's decision), which brings free Windows and macOS runners, branch protection on `main` and auto-merge (§6, §7). It may go private again later.
4. ~~Storybook~~ → ✅ **Decided: Storybook** for site components (every component × themes × Desktop/Tablet/Mobile) and editor UI components. Stories feed visual regression, a11y and interaction tests.
5. ~~Coverage floors~~ → ✅ **Decided: minimum 80% for every package**; core packages held at 90%/85%.
