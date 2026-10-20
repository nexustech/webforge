# @webforge/tools

Repository scripts. Each script is a single TypeScript file that Node 24 runs directly (type stripping). They have no relative imports, because Node does not map `./foo.js` to `foo.ts`.

| Script | Run with | What |
|---|---|---|
| `src/check-licences.ts` | `pnpm licence-check` | Fails if any installed dependency lacks a permissive licence (C1). Allow-list and reviewed exceptions live in the file; see [ADR 0002](../docs/adr/0002-licence-check.md) |
| `src/check-ui-strings.ts` | `pnpm ui-strings` | Fails on hard-coded user-facing text (JSX text, and literals in `aria-label`, `title`, `placeholder`, `alt` and props ending in `Text`, `Label`, `Title`…, including inside `?:`, `&&`, `??` and template literals) in the `.tsx` files of the desktop renderer, `editor-ui`, `engine` (Puck overrides) and `site-components`; tests and stories are skipped. Parses with swc (TypeScript 7 has no JavaScript compiler API). Fixtures in `test/fixtures/ui-strings/` |

Release and fixture-generation scripts (architecture §4) will join this workspace later.
