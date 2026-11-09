# @webforge/help

The help pages in `docs/help/` (5.4b, HP-2, HP-6), read, checked and searched: what the app's Help window shows, and what `pnpm help-check` checks (HP-5).

## Public API

`src/index.ts` is the entry point. `@webforge/help/pages` is the same code as one file with no relative imports, for the repository scripts Node runs directly (`tools/src/check-help.ts`).

- `parseHelpPage(text)` → `HelpPage`: a page's front matter, checked with zod (`helpFrontMatterSchema`), and its text as Markdown tokens, its headings with their anchors, its links and its words. Throws `HelpPageError` for front matter it can't use.
- `anchorFor(text, taken?)`: a heading's anchor, as GitHub makes it, so a link works on GitHub and in the app alike.
- `parseHelpContents(readme)`: the Help window's contents, from the groups in `docs/help/README.md`.
- `searchHelp(pages, query)`: the pages with every word of the query, those with it in their title first, then in their summary.
- `checkHelpPages(input)`: every problem `pnpm help-check` reports. The README's _Writing a help page_ has the rules.

## Boundaries

- Framework-free: no React, no Electron, no Node built-ins, so the renderer can use it too.
- Markdown is read with [marked](https://marked.js.org/)'s lexer only (MIT, no dependencies). The tokens are drawn by the app, never turned into HTML, and raw HTML in a page is a `help-check` failure.
