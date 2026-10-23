# 0010. The React Compiler memoizes the editor, and a check keeps everything compilable

- Status: Accepted
- Date: 2026-10-23
- Related: R2 (#235) of the [architecture review of 23 Oct 2026](../reviews/2026-10-23-architecture-review.md), [standards §2a and §4](../../spec/03-engineering-standards.md), [research/stack/02](../../research/stack/02-react-vs-svelte.md), [ADR 0007](0007-large-page-performance.md)

## Context
The standards said "React Compiler enabled, so no manual `useMemo`/`useCallback`", and treated its warnings as CI errors, but no build used it. Code that the compiler would get wrong had crept in: a ref written while rendering (Layers), state set while rendering (the box field), and components that read the engine's mutable state while drawing. The product owner chose to switch it on (option A of R2) rather than relax the standard.

## Decision
1. **The compiler runs wherever React code is built to run:** the desktop renderer and both Storybooks (editor UI and site components). It runs through Babel: `@vitejs/plugin-react`'s `reactCompilerPreset` with `@rolldown/plugin-babel`, `@babel/core` 7 and `babel-plugin-react-compiler` 1.0, all MIT and pinned in the workspace catalog. Babel 7, not 8: the compiler is built against Babel 7's types. `@vitejs/plugin-react`'s own `compiler` option (oxc) is marked experimental, so it isn't used.
2. **It compiles every component and hook (`infer` mode) from the start.** R2 suggested starting in `annotation` mode; once the problems below were fixed the whole codebase compiled, so there was nothing to stage.
3. **`pnpm react-compiler` keeps it that way.** `tools/src/check-react-compiler.ts` runs the compiler over the four React source folders (stories included, tests not) and fails on any function it can't compile, any compiler crash and any `"use no memo"`. It is part of `pnpm check` and a CI step, standing in for the lint rules Biome lacks. A function the build can't compile is left unmemoized without a word, so the check, not the build, is what notices.
4. **Unit tests run the source uncompiled.** Coverage would count the compiler's memo-cache checks as branches of our code (editor-ui went from 292 branches to 1,279, and from 89 % to 66 % covered), and Vitest can't leave them out. The compiled code is exercised by `pnpm e2e`, `pnpm e2e:perf` and the Storybooks' visual checks. So **correctness never depends on memoization**, which is a speed-up the compiler may also skip: an effect must not loop or misbehave when a value it depends on is new on every render. Values an effect needs are made inside it (the Add panel's previews), and functions handed upward go through a state setter, which is stable (the title bar's `undoTo`).
5. **Code follows the compiler's rules** (the Rules of React):
   - Nothing is written to a ref or to state while rendering. Values kept "from the last render" belong in an effect (Layers' latest rows) or in the store that has them (the site-wide confirmation remembers its last question for the closing dialog).
   - A component doesn't read mutable state outside React while drawing. The engine's canvas chrome reads the page through Puck's store (`usePuck`), and the action bar's helpers are made once per page shown, so a new page gives them new identities.
   - Components and hooks aren't defined inside effects; render functions passed as props become components (`LayersPanel`'s `menu`).
   - Syntax the compiler doesn't handle yet is written another way: no arrow functions as default parameter values, no `import()` inside a component, no optional chaining in a logical test.
6. **No manual `useMemo` or `useCallback`** unless a measurement says the compiler's memoization isn't enough; the eight there were are gone.

## Consequences
- Components re-render less: the compiler skips a child whose props didn't change, which a hand-written `memo` would have needed. The flip side is that a component may no longer re-render just because its parent did. Anything that relied on that (a dependency-less effect re-reading the DOM, a render that read a mutable variable) now needs a real input. The canvas chrome's action bars were changed for this reason.
- Builds take longer: every React file goes through Babel. The PR has the numbers (renderer build, and the per-file transform cost that hot reload pays).
- A violation is caught by `pnpm check` with the file, the line and the compiler's reason, rather than as a subtle stale value at run time.
- Puck itself (`node_modules`) isn't compiled; only our overrides of its UI are.
- The compiler's diagnostics follow its version: a compiler upgrade may report new problems, which the check will show before the upgrade lands.
