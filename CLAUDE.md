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
- **Licences:** permissive dependencies only (MIT, BSD, Apache-2.0, ISC; MPL-2.0 unmodified). No GPL/AGPL; no paid add-ons (Tiptap Pro, Puck Cloud, GrapesJS Studio).
- **Electron security:** `contextIsolation`, `sandbox`, no `nodeIntegration`, no `@electron/remote`, typed preload API only.
- **Never log or store** site content, credentials or personal data. Secrets live in the OS keychain only. Crash reports stay local.

## Tests
- **Vitest:** unit/integration. **fast-check:** undo invariants. **Playwright:** Electron E2E + exported-site checks. **Storybook stories:** visual regression and axe.
- **Coverage ≥ 80%** for every package (core packages ≥ 90%). Every bug fix adds a regression test.

## Workflow
- Conventional Commits (`feat(history): …`), short-lived branches, PRs into protected `main`, squash merge.
- Record new architectural decisions as ADRs in `docs/adr/`.
