# 0001. Monorepo tooling setup

- Status: Accepted
- Date: 2026-10-19
- Related: [engineering standards §1–3, §5](../../spec/03-engineering-standards.md), [architecture §4](../../spec/01-architecture.md#4-package--module-structure-pnpm-monorepo)

## Context
Setting up the pnpm + Turborepo skeleton showed a few places where the standards needed a concrete choice, or where the toolchain differs from what the standards assumed.

## Decision
1. **Packages are consumed from source.** Each package's `exports` points at `src/index.ts`. electron-vite/Vite bundle them into the app and Vitest runs them directly, so libraries have no build step. `tsc -b` (project references, declaration-only output to `dist/types`) does the type checking.
2. **One root Vitest run with per-package thresholds.** `vitest.config.ts` uses `projects: ["apps/*", "packages/*"]` and sets a coverage threshold glob for every workspace: 90/85/90/90 (lines/branches/functions/statements) for `model`, `history`, `storage`, `pipeline` and `publish`, and 80 elsewhere. Thresholds stay in one place instead of being copied into twelve configs. The trade-off: tests are not cached per package by Turborepo.
3. **dependency-cruiser parses with swc.** TypeScript 7 ships only the native compiler and no JavaScript compiler API, and dependency-cruiser 18 supports `typescript` < 7 only. `@swc/core` (Apache-2.0) is used as its parser.
4. **Floating promises are linted.** Biome 2.5's nursery `noFloatingPromises` and `noMisusedPromises` are enabled as errors, which closes the gap noted in standards §2a.
5. **CSP lives in code.** The editor's Content-Security-Policy is built by `apps/desktop/src/shared/content-security-policy.ts` and filled into `index.html` at build time. In development, a per-run nonce admits Vite's inline HMR and React Refresh scripts, so neither mode needs `'unsafe-inline'`.
6. **pnpm supply-chain defaults stay on.** pnpm 12 blocks dependency build scripts unless approved in `allowBuilds`, and rejects versions younger than `minimumReleaseAge`. Only `@swc/core` and `lefthook` may run install scripts. Electron 44 downloads its binary on first use and needs no approval.

## Consequences
- Adding a package means adding it to the root `tsconfig.json` references and to the `references` of every workspace that imports it. Coverage thresholds and Vitest projects pick it up automatically.
- Revisit item 3 when dependency-cruiser supports TypeScript 7's API, and item 4 if the nursery rules prove noisy.
- Process entry points (`src/main/index.ts`, `src/preload/index.ts`, `src/renderer/main.tsx`) are excluded from unit coverage; the Playwright Electron smoke test (`e2e/app/smoke.spec.ts`) covers them.
