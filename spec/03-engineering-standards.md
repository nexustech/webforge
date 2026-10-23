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
  - **No React Compiler-specific lint rules.** Mitigation: `pnpm react-compiler` (part of `pnpm check` and CI) runs the compiler over the renderer, editor UI, engine and site components and fails on anything it can't compile or that turns it off ([ADR 0010](../docs/adr/0010-react-compiler.md)).
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
| React | Function components only; React Compiler enabled ([ADR 0010](../docs/adr/0010-react-compiler.md)), so no manual `useMemo`/`useCallback` unless measured, and nothing written to a ref or state while rendering; no business logic in components (use hooks/stores); props typed explicitly |
| State | Document state in the document store (via history). UI state (selection, panels, zoom) in a separate UI store, never in history (U6). Server/async state in dedicated hooks |
| Styling (editor) | shadcn/ui components + Tailwind tokens only; `cn()` for class merging; no inline styles, no ad-hoc colours; dark/light via CSS variables |
| Styling (site components) | daisyUI + Tailwind utilities only; style props must map to **design tokens**, never free-form values (except Advanced classes) |
| UI text | **No hard-coded user-facing strings.** Use `t('key')` from `packages/i18n`, with wording from the glossary ([terminology](../research/product/01-terminology.md)). Undo labels built from glossary terms (D2) |
| Errors | Throw `WebforgeError` subclasses with a `code` and an i18n `messageKey`. Never show raw error text or stack traces to users. Log the details with electron-log |
| Logging | `log.info/warn/error` with structured context. **Never log** site content, credentials, tokens or personal data |
| Comments | Explain *why*, not *what*. TSDoc on all exported functions/types of packages |
| Dependencies | New runtime dependency needs: permissive licence (C1), active maintenance, a size check, and a note in the PR. Prefer small/pure-JS/WASM over native modules |
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

## 6. Git workflow
- **Trunk-based:** short-lived branches (`feat/…`, `fix/…`, `chore/…`), PRs into `main`, **squash merge**.
- **Clean up after merging:** delete the branch locally and on GitHub once its PR is merged, and remove worktrees that are no longer in use, so merged branches don't linger. Keep a merged branch only while another open PR targets it as its base.
- **`main` is not branch-protected.** Branch protection and rulesets for private repositories need a paid GitHub plan, and the repository is on GitHub Free. "Always work through PRs" is therefore a **team convention**, not a technical guard: never push or merge to `main` directly, and merge only with green CI. Revisit if the plan changes.
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
| Unit + property + integration tests with coverage gates | Linux (PRs); + Windows, macOS (nightly, `full-ci` PRs) | every PR + nightly |
| Licence check (C1 allow-list) + vulnerability audit (`pnpm audit` / OSV) | Linux | every PR + nightly |
| Golden output + visual regression + a11y | Linux container | PRs that change the editor UI or what its stories render + nightly |
| E2E app + exported-site compatibility | Linux (PRs); + Windows (nightly, `full-ci` PRs) | every PR except unit-test-only ones (app + Chromium; Firefox and WebKit when the exported site can change) / nightly (full) |
| Performance benchmarks | macOS + Windows | nightly; PR when labelled |
| Release build: sign (Windows code signing, macOS Developer ID + notarisation), publish update feed | Windows + macOS | on release tag |

- **CI cost (GitHub Free, private repository):** every job is billed in whole minutes, Windows minutes count 2× and macOS 10×. **Pull requests run Linux jobs only,** and a `changes` job skips what a PR can't affect (see `.github/workflows/ci.yml`). **`main` is checked by a nightly run** (02:30 UTC, only when it changed), not after every merge; "Run workflow" runs it at once. Windows and macOS jobs, including the packaged-app check, run nightly, from "Run workflow", and on PRs labelled **`full-ci`**. Use the label for packaging, Fuses, native modules and OS-specific code. Docs-only PRs (`docs/`, `spec/`, `research/`, Markdown) and draft PRs skip CI: keep a PR in draft until `pnpm check` passes locally and its review is done, so CI runs once per ready version rather than on every push. A failure from two PRs that pass alone but clash, or a Windows- or macOS-only failure, can therefore first show in the nightly run; fix it with a follow-up PR straight away.
- **Windows/macOS switch:** those jobs run only while the repository variable `FULL_CI_ENABLED` is `true`. **Paused since 2026-10-20** to stay within the billing cycle; resume with `gh variable set FULL_CI_ENABLED --body true`.
- **Dependency updates:** Renovate or Dependabot, weekly, grouped. **Electron upgraded at least quarterly** (01).
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
3. ~~GitHub~~ → ✅ **Decided: GitHub** for the repository, PRs and Actions CI. Private repository on the GitHub Free plan, so no branch protection on `main`; PR-only merges are a team convention (§6).
4. ~~Storybook~~ → ✅ **Decided: Storybook** for site components (every component × themes × Desktop/Tablet/Mobile) and editor UI components. Stories feed visual regression, a11y and interaction tests.
5. ~~Coverage floors~~ → ✅ **Decided: minimum 80% for every package**; core packages held at 90%/85%.
