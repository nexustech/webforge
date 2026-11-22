# 0027. Main's strings: a catalogue of its own, made from the keys it names

- Status: Accepted (2026-11-22)
- Date: 2026-11-22
- Related: #1317, #892 (main's start-up graph), #1150 (the site components' strings left main's catalogue), `e2e/app/main-start.spec.ts`, [spec/01 §10](../../spec/01-architecture.md) (cold start)

## Context

Main called `t()` from `@webforge/i18n`, whose module holds the whole English catalogue: every area's strings, mostly the editor's own (theme, canvas, panels, templates, Site Check, publishing). Main shows a few hundred of them: menus, dialogs, storage and AI messages, Help and Diagnostics. All of the catalogue was in main's static graph, which loads and compiles before main's first line runs. Each feature that added words to the editor made main's start-up heavier, and `main-start.spec.ts`'s budget was raised for strings three times (#1256, 5.41, and close to it in PR 1312).

## Decision

1. **Main reads a catalogue of its own,** `@webforge/i18n/main`: `t`, `template`, `plural` and `isMessageKey` over `packages/i18n/src/en/main.ts`, the messages main shows and nothing else. The lookups shared by every entry are in `lookup.ts`, which holds no catalogue, so main's entry loads only its own.
2. **The catalogue is made, not written by hand:** `pnpm main-strings` copies, from `en/`, every key that a file of main's or of the shared code reading `@webforge/i18n/main` names (in quotes, so a key chosen by a condition counts), each plural's forms, `app.name`, and the keys main builds at run time. The command writes it with `apps/desktop/src/main/main-strings-cli.ts` and lays it out with `biome format`, as `pnpm font-catalogue` does, so the generator doesn't copy Biome's style. A test (`main-strings.test.ts`) fails while the catalogue's keys and messages aren't the ones the command would copy (`main-strings-keys.ts`).
3. **Keys built at run time are listed explicitly** in `apps/desktop/src/main/main-strings.ts` (`MAIN_RUNTIME_KEYS`), made by the same functions the code that builds them calls (`categoryKey`, `businessKindKey`, `templateNameKey`), so the list and the code can't drift. A test checks every one is in the catalogue.
4. **A key main doesn't hold fails to compile:** `t`'s key is typed by main's catalogue. A key from data goes through `isMessageKey`, as before.
5. **Only main's start-up reads it.** What main loads when first used (the MCP server, Report a Problem) and the renderer and the export worker keep `@webforge/i18n` or `/components`, unchanged; the site's text (`/site-text`) is untouched.
6. **`main-start.spec.ts` checks it:** no key of Theme Studio's, the editor's own, in main's static graph, and a budget lowered to the new size (1.46 MB, from 1.65 MB) plus 2%.

## Consequences

- Main's start-up graph is about 194 KB smaller, and the editor's words no longer weigh on it: a new string costs main nothing unless main shows it.
- A new string in main, or in shared code main reads, needs `pnpm main-strings` before it compiles; the test says so. The English is still written once, in `en/`; `main.ts` copies it.
- A key main builds at run time from a new pattern needs a builder in `main-strings.ts` and a line in `MAIN_RUNTIME_KEYS`; without it, `isMessageKey` says no and the code shows its fallback.
