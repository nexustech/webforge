# @webforge/commands

The command layer for AI apps (F-AI-1, plan item 4.8): typed queries that read the open site and commands that change it, each change one `HistoryManager` step labelled "AI (‹app›): …". The MCP server (4.9) and the v1.1 built-in assistant share it. Design: [architecture §6 and §9](../../spec/01-architecture.md).

## Public API
`src/index.ts` is the only entry point; import the package as `@webforge/commands`, never its internal files.

- `createCommandApi(host)` → `CommandApi`
  - `query(name, input)`: `outline`, `pageTree` (with linked copies of shared sections), `fields` (each field's kind, label, JSON Schema and value), `settings`, `theme`. Answers `{ status: "done", data }`, or `invalid` / `not-found` with a message.
  - `run(name, input, { app })`: `addNode`, `updateFields`, `editText`, `moveNode`, `removeNode`, `addPage`, `setThemeTokens` (a group of tokens named in part, such as `{ fonts: { heading } }`, keeps the values it leaves out). Answers `{ status: "done", label, id? }`, or why nothing changed: `invalid`, `not-found`, `refused`, `busy` or `declined`.
- `CommandHost`: what the commands run against. The renderer gives one over the editor session (`apps/desktop/src/renderer/ai/`); tests give their own.
- `COMMANDS`, `QUERIES`: each one's zod input schema, and a `description` for AI apps.
- `AI_TOOLS`: every query and command as an AI app's tool (4.9): its name, its description ending in `UNTRUSTED_SITE_TEXT`, and its input as JSON Schema. The MCP server lists them, and an in-app assistant would use the same ones (AIA-4).
- `CONFIRM_TIMEOUT_MS`: how long a change to more than one page waits for the person (D7).

## Rules
- Every input is checked with zod, and a field's value against its field's own schema (`@webforge/site-components/catalogue-data`), whichever command sets it; invalid input changes nothing.
- Rich text is cleaned as the editor's is (`sanitizeStoredRichText`), and a link or image to a page or file in Media the site doesn't have is `not-found`: the site never holds what no person could have set.
- `busy` while a gesture (a drag, a slider) is open, the person is typing in a text (D1), or a question is open.
- Content mode (1.26) refuses structural commands: adding, moving and removing, pages, the theme, and style fields.
- A change shown on more than one page (the Header or Footer, a shared section with several copies, the theme, a new page's menu entry) asks the person first (D7), and is `declined` after a minute.
- Every command and query has a `description`, which says what it does for an AI app: `ai-tools.test.ts` fails without one.
- Nothing for publishing, credentials, Custom Code or files outside the site; nothing logged of a request or its answer.

## Boundaries
- Framework-free: no React, no Puck, no Electron. The catalogue comes as plain data from `@webforge/site-components/catalogue-data` (`pnpm deps` checks both).
