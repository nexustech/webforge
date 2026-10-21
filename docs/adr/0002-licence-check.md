# 0002. Licence check with pnpm's built-in report

- Status: Accepted
- Date: 2026-10-19
- Related: C1 ([canvas engine research](../../research/stack/04-canvas-engine.md)), [engineering standards §1, §7](../../spec/03-engineering-standards.md), [ADR 0001](0001-monorepo-tooling.md)

## Context
Webforge is a paid, closed-source product, so every dependency must have a permissive licence (C1). The standards named license-checker-rseidelsohn for the CI check. pnpm 12 already reports licences for every installed package (`pnpm licenses list -r --json`), which reads pnpm's own layout and needs no extra dependency.

## Decision
1. **Data:** `pnpm licenses list -r --json` (all workspaces, dev dependencies included). The desktop app bundles its devDependencies, so dev dependencies count too.
2. **Check:** `tools/src/check-licences.ts` validates the report with zod and evaluates each package's SPDX expression. `A OR B` passes if either side is allowed, `A AND B` needs both, and `A WITH exception` is judged by `A`. Anything else ("UNLICENSED", "SEE LICENSE IN …") fails.
3. **Allow-list:** MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, 0BSD, BlueOak-1.0.0, CC0-1.0, MPL-2.0 (allowed only unmodified: we patch only permissively licensed packages, currently @puckeditor/core (MIT, see ADR 0007), and the check fails if a package in `patchedDependencies` has a licence other than the allowed ones without MPL-2.0) and OFL-1.1 (added by ADR 0005 for the Fontsource fonts that exported sites bundle; it allows embedding and redistribution, only not selling the fonts on their own).
4. **Exceptions** are named per package and pinned to the exact licence string that was reviewed, each with a reason. If the package's licence changes, it is checked again. Current exceptions are all build-time only:
   | Package | Licence | Pulled in by |
   |---|---|---|
   | argparse | Python-2.0 (permissive PSF licence) | electron-builder → js-yaml |
   | caniuse-lite | CC-BY-4.0 (data) | browserslist |
   | truncate-utf8-bytes | WTFPL | electron-builder → sanitize-filename |
5. **Running it:** root script `pnpm licence-check`. It can't be named `licences`, because pnpm treats `pnpm licences` as its built-in `licenses` command. The script is part of `pnpm check` and runs in CI on ubuntu and windows, because each OS installs different platform-specific binary packages. The report is piped into the script, which fails on empty or malformed input, so a broken `pnpm licenses` call can't pass by accident.

## Consequences
- One fewer dependency. The check depends on the shape of pnpm's JSON output; zod fails loudly if a pnpm upgrade changes it.
- The macOS-only binary packages are not checked until a macOS CI job exists.
- Adding a dependency with a new licence needs either a policy change here or a reviewed exception in `tools/src/check-licences.ts`.
- Not covered yet: the in-app "Open-source licences" screen (MVP §4) and a vulnerability audit (standards §7).
