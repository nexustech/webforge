# @webforge/tools

Repository scripts. Each script is a single TypeScript file that Node 24 runs directly (type stripping). They have no relative imports, because Node does not map `./foo.js` to `foo.ts`.

| Script | Run with | What |
|---|---|---|
| `src/check-licences.ts` | `pnpm licence-check` | Fails if any installed dependency lacks a permissive licence (C1). Allow-list and reviewed exceptions live in the file; see [ADR 0002](../docs/adr/0002-licence-check.md) |
| `src/check-ui-strings.ts` | `pnpm ui-strings` | Fails on hard-coded user-facing text (JSX text, and literals in `aria-label`, `title`, `placeholder`, `alt` and props ending in `Text`, `Label`, `Title`…, including inside `?:`, `&&`, `??` and template literals) in the `.tsx` files of the desktop renderer, `editor-ui`, `engine` (Puck overrides) and `site-components`; tests and stories are skipped. Parses with swc (TypeScript 7 has no JavaScript compiler API). Fixtures in `test/fixtures/ui-strings/` |
| `src/build-font-catalogue.ts` | `pnpm font-catalogue` | Writes `packages/themes/src/fonts/catalogue.json` (2.2): the ~50 bundled families and their pairings, read from Fontsource's pinned API (v1). It refuses any licence but OFL-1.1, Apache-2.0 and UFL-1.0 (C1), and records each bundled file's npm package, version, size and SHA-256, staying within the installer's font budget. Needs the network; run it when the selection changes and commit the result |
| `src/visual-docker.ts` | `pnpm visual:docker` | Runs the Storybook axe and screenshot tests in CI's pinned Playwright container (Docker), on a copy of the working tree as git sees it, and copies new or (with `--update`) changed screenshots back to `e2e/visual/__screenshots__/`. The image follows `@playwright/test` in `e2e/package.json`; a test checks it matches CI's Storybook job. Downloads are cached in the Docker volume `webforge-visual-cache` |

Release and fixture-generation scripts (architecture §4) will join this workspace later.
