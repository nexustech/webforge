# Webforge Codebase Review

**Date:** 13 Nov 2026 · **Commit:** `main` at `8cc32804` · **Earlier reviews:** [architecture 2](2026-10-30-architecture-review-2.md), [extensibility](2026-10-24-extensibility-review.md), [security 2](2026-11-08-security-review-2.md) · **Issues:** #974–#991, 17 of them (#976 is a pull request; Phase 5, out of plan)

The codebase is in good shape. It has no critical, high or medium security findings, no violations of the hard rules, and most components and editor areas are registered, not hard-coded. The main risks are two low-severity input-handling bugs, and extension points that still need central edits: AI clients and tools, templates, and shared window state.

**Five changes to make first:**

1. **Make Markdown parsing linear** (N2, #974). An unclosed `**` takes 25 s per 160 KB, on the editor's main thread. Fixed by #996 on 13 Nov.
2. **Put imported CSS behind the trust prompt, and close Site Check's CSS bypass** (N1, #975).
3. **Make the MCP main-tool dispatch exhaustive** (E1, #978). Any new main tool silently ran as "create a site from a brief". Fixed by #995 on 13 Nov.
4. **Make every scaffold's output pass `pnpm check`** (E2, #979), so adding a component or an IPC domain really is one command.
5. **Replace the `"claude" | "other"` pairing with an AI client registry, and give every tool one shape** (E3 and E4, #980 and #981). After that, adding an AI app is one module, not edits to about 11 files.

The rest is duplication (three copied pieces of logic and about ten repeated schemas or helpers) and five files over 850 lines. Every finding is filed as an issue (last section).

## Scope and method

The review covers the desktop app and 17 workspace packages, about 130,000 lines of non-test TypeScript.

| Area                                                     | Non-test lines   |
| -------------------------------------------------------- | ---------------- |
| `apps/desktop` (main, preload, renderer, worker)         | 71,600           |
| `site-components`                                        | 12,700           |
| `model`                                                  | 8,300            |
| `editor-ui`                                              | 8,300            |
| `engine`                                                 | 7,600            |
| `pipeline`                                               | 4,700            |
| `i18n`                                                   | 4,300            |
| `storage`, `themes`, `site-check`, `commands`, `publish` | 2,000–2,800 each |
| `history`, `templates`, `help`, `mcp-bridge`, `errors`   | under 800 each   |

- Four reviewers each read one theme, read-only: security; extensibility (AI apps, components and sections, editor panels); duplication and reuse; practices and maintainability.
- Each read the earlier reviews in this folder first, so this review lists new findings, or earlier ones still open (by their IDs, such as S39 or R10).
- Every finding was then checked in the code before it was counted. N2 was also timed.

## Security

There are no critical, high or medium findings. Two new low findings are worth fixing before the beta: imported CSS that skips the trust prompt, and Markdown that can freeze the editor. Every earlier finding's tracking issue is closed, and the fixes spot-checked here still hold. S39, the Linux keyring fallback, stays open as accepted until a Linux build ships.

| ID  | Finding                                                                                                                   | Severity       | Issue                  |
| --- | ------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------- |
| N1  | An imported site's `custom.css` exports with no trust prompt, and Site Check misses `image-set("…")` and escaped `\75rl(` | Low            | #975                   |
| N2  | Markdown import and paste are quadratic on unclosed `**`, and deep `>` nesting overflows the stack                        | Low            | #974                   |
| N3  | Windows updates install unsigned and silently on quit                                                                     | Info, accepted | Covered by #850 (0.5b) |
| N4  | Collection folders accept Windows device names (`con`, `nul`)                                                             | Info           | #977                   |

### N1: untrusted CSS

`RUNNING_PARTS` in `model/src/site-code-pieces.ts:9–12` lists head, body-end and JS, but not CSS, so `withKeptCode` never blanks `code.css` and `pipeline/src/build.ts:534` exports it as written. Site Check's `CSS_URL` in `site-check/src/external.ts:47` matches only a literal `url(`.

- **Scenario.** A third-party "starter site" carries `body { background: image-set("https://tracker.example/p.png" 1x) }`. Once published, every visitor's browser calls that host, which breaks the no-external-requests rule, and Site Check stays quiet. CSS `content:` can also swap a shown phone number or bank details.
- **Fix.** Treat CSS from a file the owner didn't write as a trusted part, at least when it contains `url`, `image-set`, `@import`, `src(` or `content:`. In `cssResources`, decode CSS escapes first and catch quoted strings in `image-set`, `-webkit-image-set` and `src()`.

### N2: Markdown that freezes the editor

`formatted()` in `model/src/markdown.ts:51–56` uses lazy `(.+?)` with look-arounds, so every unclosed `**` rescans to the end of the line. `closeQuote` (line 84) recurses once per `>` level.

| Input `"**a ".repeat(n)` | Time for the bold regex alone (Node 24) |
| ------------------------ | --------------------------------------- |
| 20 KB                    | 0.3 s                                   |
| 80 KB                    | 6.7 s                                   |
| 160 KB                   | 25 s                                    |

Import Posts (`renderer/site/import-posts.ts:51`) reads up to 200 files of 1 MB each, and a plain-text paste (`engine/src/puck/markdown-paste.ts:22`) takes whatever a web page put on the clipboard. Both run on the renderer's main thread, and a force-quit loses unsaved edits.

- **Fix.** Pair emphasis delimiters with a linear scan using a stack, or cap a paragraph at about 10,000 characters before formatting. Make quote nesting iterative with a depth cap of about 16. Add a timing regression test.

### N4: device names

`collectionFolderSchema` (`model/src/collections.ts:63–67`) refuses `assets` but not `con` or `nul`, though pages and kept addresses do (R16). A crafted file then makes export and preview fail on Windows. **Fix:** `.refine((folder) => !isDeviceName(folder))`.

### Holding well

- One IPC path, `registerIpcHandler` in `main/ipc.ts:33–62`, checks the sender frame, parses the request and the response with zod, and returns a fixed error. There is no raw `ipcMain` anywhere else.
- The `webforge-app://` responder matches the raw URL before parsing, and refuses device names, dot-segments and unlisted types.
- The editor's CSP is `default-src 'none'`, with a stricter policy for Help.
- New features reused the old protections: path schemas, `escapeHtml`, the code-trust gate, and capped file-dialog readers. Site ZIP import caps entries, size and compression ratio, so zip-slip doesn't apply.
- MCP keys are stored hashed and compared in constant time. safeStorage has no plain-text fallback, and `logFailure` logs only error codes.
- AI apps can't reach publishing, forms, analytics, code or kept addresses: `updateSettings` is a strict allow-list.

## Extensibility

Components and editor areas are already registry-driven, but adding an AI client or a template still means editing central files, and both scaffolds produce code that fails `pnpm check`. Most of the [extensibility review](2026-10-24-extensibility-review.md)'s findings (E1–E12 there) are closed. The E-numbers below are this review's own.

| To add…                                                        | Files to edit today | Main friction                                                                     | Issue      |
| -------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------- | ---------- |
| One-click setup for a new AI client (Cursor, VS Code, ChatGPT) | about 11            | `"claude" \| "other"` hard-coded in main, IPC, preload, renderer and strings      | #980       |
| An AI tool                                                     | 2–4                 | Tools are defined in four places, in three different shapes                       | #981       |
| A site component                                               | scaffolded          | The scaffold skips `catalogue-data.json` and the help page, so `pnpm check` fails | #979       |
| A section with a main heading                                  | scaffolded + 1      | Site Check's heading rule names component types itself                            | #982       |
| A template                                                     | 5, no scaffold      | `TEMPLATE_IDS`, `MANIFESTS`, strings, folder, thumbnails                          | #983       |
| An IPC domain                                                  | scaffolded          | The scaffold skips `ipc-sessions.test.ts` and anchors on a code comment           | #979, #985 |
| State shared across areas                                      | 2 central files     | `WindowContext` and `App.tsx` grow with every feature                             | #984       |

### AI apps and tools

Webforge is an MCP server and AI apps connect to it as clients. No vendor SDK is in the code, so the protocol side is vendor-neutral. The coupling is in pairing and in how tools are defined.

- **E1, latent bug (#978, fixed by #995).** `main/mcp-service.ts:97–104` switched on the main tool's name, and its `default:` ran `briefs.ask`. A fourth main tool would quietly have created a site from a brief.
- **E3, pairing is a closed choice (#980).** `AppKind` is `"claude" | "other"` in `main/ai-apps.ts:33,50`, again in `shared/ipc/mcp.ts:75`, as its own `Kind` in `AiAppsDialog.tsx:60`, plus a Claude-only channel (`mcpInstallClaude`) and preload method (`installClaude`). `ai-apps.ts:269` uses `kind !== "claude"` to mean "does this client verify the server", which is a capability, not a vendor.
- **E4, four tool sources in three shapes (#981).** `AI_TOOLS` (zod, derived from `COMMANDS`), `APP_TOOLS` (descriptions only), `REQUEST_MEDIA` (its JSON schema written again by hand in `mcp-server.ts:41–50`) and `MAIN_TOOLS` (raw JSON Schema). Routing is split between `isMainTool` and a `??` chain in `renderer/ai/area.ts:93`. "No safety version first" is `request.name === "plan"` (`mcp-service.ts:145`), and `plan-command.ts:37–83` summarises commands by a switch with `as` casts and no exhaustiveness check.

Suggested design: one registry per concern, each entry carrying its capabilities.

```ts
// main/ai-clients.ts
type AiClientKind = {
  id: string;
  labelKey: MessageKey;
  verifiesServer: boolean;
  install?(pairing: Pairing): Promise<{ outcome: "opened" | "shown" }>;
  remove?(appId: string): Promise<void>;
};
export const AI_CLIENTS = [claudeDesktop, genericMcp] as const satisfies readonly AiClientKind[];

// one tool shape for every source
type ToolDef<I extends z.ZodType> = {
  name: string;
  kind: "query" | "command";
  input: I;
  description: MessageKey;
  answeredBy: "main" | "window";
  savesVersionFirst: boolean;
  summarize?(summary: PlanSummary, input: z.infer<I>): void;
  run(input: z.infer<I>, ctx: ToolContext): Promise<AiResponse>;
};
```

The MCP server would then list `TOOLS.map(toMcp)` and route on `answeredBy`, with no name switches. The IPC enum becomes `z.enum(clientIds)` and `mcpInstall(id)` replaces the Claude-only channel. The in-app assistant (ADR 0026, #870–#873) is the other direction; a `ChatProvider` interface (`send(messages, tools, signal): AsyncIterable<Delta>`) would keep any vendor SDK inside `main/`.

### Components, sections and templates

The engine has no type switches, Puck fields derive from `FieldDef`, and toolbars register by type. The gaps are at the edges:

- **E2 (#979).** `pnpm new-component` does not pass `pnpm check`, though its docs say it does. It doesn't regenerate `catalogue-data.json` (`tools/src/new-component.ts:291–321`), and once that's done `help-check` fails because no help page names the component. Each scaffolded component also gets its own Add-panel category (`new-component.ts:62,94,126`). The field-kind checklist disagrees with itself: `docs/components.md` lists `field-group.ts`, `element-clipboard.ts`, `media-usage.ts`, `render-static.tsx` and migrations, while `apps/desktop/src/renderer/fields/field-kinds.ts:7–25` and `docs/extending.md` say "seven places".
- **E5 (#982).** Component types are named outside the catalogue: `site-check/src/rules/found.ts:150–155` (main headings: only Heading, Hero, CustomCode), `theme/studio/StudioComponents.tsx:72,246`, `ThemeStudio.tsx:68` and `commands.ts:573`. Move these to flags on the definition, such as `writesMainHeading`, `studioSample` and `themeControls`, carried into `catalogue-data`.
- **E6 (#983).** A template is five hand edits. Generate `template-index.ts` from `templates/*/` as `pnpm behaviours` does, and add `pnpm new-template <id>`.

### Panels, areas and IPC domains

- **E7 (#984).** `WindowContext` (`renderer/editor/areas.ts:65–110`) is becoming a grab-bag: `onNetlify`, `publishedYear`, `codeTrust`, `publishing`, `siteCheckIgnored`, `tips`. Five feature commits have edited it since #779, which brings back the old E1 in another form. Let areas declare typed services they provide and use, and have `connectAreas` order and check them.
- **E2 (#979).** The `ipc-domain` scaffold inserts before a comment in `main/app.ts:777` and leaves `shared/ipc-sessions.test.ts` failing until the new channel is classified. `scaffold panel` and `scaffold area` write no help stub, though HP-4 requires one.

### Keep doing

- Declarative areas with `register(ctx) → dispose`, and boundary and cycle rules in `pnpm deps`.
- `defineComponent` / `defineSection`, typed by their fields and checked when the module loads.
- `FIELD_KINDS` as an exhaustive `satisfies` map; the exhaustive worker dispatch table.
- MCP tool lists derived from zod-typed `COMMANDS` / `QUERIES`, with untrusted-text marking on every tool.
- Scaffolds that plan every edit before writing, refuse taken names, and are tested against the real files.
- Generated behaviours and catalogue data, with tests that fail when they're stale.

## Duplication and reuse

The repo is mostly DRY. Colour maths, IPC registration and failure reporting each live in one place. The real clones are three pieces of copied logic that could be fixed in one copy and missed in the other, plus lists and regexes that can drift apart.

**D1, copied logic (#987).**

1. **Drag lifecycle in the canvas handles.** `engine/src/puck/spacing-handles.tsx:311–345` and `width-handles.tsx:253–287` are about 35 identical lines; only `move()` differs. Fix: a `startGripDrag` helper in `engine/src/puck/grip-drag.ts`.
2. **The streaming ZIP writer.** `pipeline/src/zip.ts` and `storage/src/site-zip.ts` share the staging file, the fflate chain, compression level 6, `ENTRY_DATE`, the 65,535-entry limit and rename-or-remove. Fix: one `writeZipAtomically(entries, destination, { stored, signal })`.
3. **Build failures turned into outcomes.** The `BuildError` branches are the same in `worker/run-export.ts:75–100` and `worker/run-publish.ts:135–160`. Fix: `worker/build-failure.ts`.

**D2, lists and patterns that can drift (#988).**

| What                                 | Copies                                                                                                         | Where it should live                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Publish error codes                  | 3: `publish/src/publisher.ts:12–50`, `shared/ipc/publish.ts:19–32`, `shared/export-worker-protocol.ts:322–338` | A dependency-free subpath, `@webforge/publish/codes`            |
| SHA-256 hex regex `/^[0-9a-f]{64}$/` | 16 files                                                                                                       | `sha256HexSchema` in `@webforge/model`                          |
| 32-hex recent-site id                | 5                                                                                                              | `recentSiteIdSchema` in `shared/ipc/project.ts`                 |
| Font file name `*.woff2`             | 3                                                                                                              | Export from `@webforge/themes`                                  |
| `CUSTOM_COLOUR` pattern              | 2                                                                                                              | Export from model                                               |
| HTML escaping                        | 5                                                                                                              | One `escapeHtml` in model, re-exported by pipeline              |
| `isRecord`, `escapeRegExp`           | 3 each                                                                                                         | Small utilities in model                                        |
| `pageWithCopy()`                     | 2, identical                                                                                                   | `renderer/editor/show-place.ts`, or model beside `isSharedCopy` |
| Inline stroke `Icon` component       | 3 in `site-components/src/catalogue/`                                                                          | `site-components/src/stroke-icon.tsx`                           |

`hexOf` (Oklch to hex) sits in `renderer/fields/color/hex.ts`; it belongs in `themes/src/colors.ts`. The six meta read and write pairs in `storage/src/project-store.ts:1084–1206` are part of M3 (#986). Repeated test setup (`IS_REACT_ACT_ENVIRONMENT` in 21 files, copied media fixtures) is part of L4 (#991).

**Leave alone.** `model/src/format-5-themes.ts` (992 lines) and the theme in `migrations.ts:184` repeat current data on purpose: they are frozen migration snapshots.

## Programming practices and maintainability

The hard rules hold: tooling enforces them, and they have no real violations. No real `any`, no non-null `!`, no TODO or FIXME, and no hard-coded JSX strings in source. Every `@ts-expect-error` is a deliberate negative type test, every `export default` is a config file or a module shim, and each of the 23 `biome-ignore` comments gives a reason. `documentStore.set` appears only inside `history-manager.ts`. Listeners and timers are cleaned up.

| ID  | Finding                                         | Where                                                                                                             | Severity | Issue |
| --- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------- | ----- |
| M1  | Branded-id casts grew from 9 (R10) to 26        | `model/src/pages.ts:11`, `site-documents.ts:264,265,308`                                                          | Medium   | #989  |
| M2  | `startApp` is still a ~700-line closure (A12)   | `main/app.ts`: 875 lines, 89 imports                                                                              | Medium   | #985  |
| M3  | Five files over 850 lines                       | `project-store.ts` 1,287 · `edit-panel.tsx` 1,035 · `commands.ts` 906 · `main/app.ts` 875 · `LayersPanel.tsx` 871 | Medium   | #986  |
| L1  | Rejections swallowed with no log                | `FontField.tsx:82`, `export-ipc.ts:165` (deliberate, unlogged), `VersionHistoryPanel.tsx:67`                      | Low      | #990  |
| L2  | Effects that reset state on open                | `editor-ui/src/components/ui/picker.tsx:137–141`, `AiAppsDialog.tsx:111`                                          | Low      | #990  |
| L3  | Avoidable `as unknown as`                       | `history-manager.ts:234`, `mcp-bridge/src/bridge.ts:37`                                                           | Low      | #989  |
| L4  | Thin tests for IPC contracts                    | `shared/`: 33 source files, 11 tests; `preload/`: 24 and 2                                                        | Low      | #991  |
| L5  | File naming is mixed                            | renderer: 109 PascalCase, 29 kebab-case `.tsx`                                                                    | Low      | #990  |
| L6  | Errno casts instead of the errors package (A23) | `pipeline/src/write.ts:69,86`                                                                                     | Low      | #989  |

The controller extraction landed: `EditPanelHost.tsx` is down to 163 lines and `Editor.tsx` to 409. No floating promises, overuse of context or prop-drilling hotspots turned up.

## Issues

Each finding was filed in the Phase 5 milestone with a fix plan, acceptance criteria and tests: 17 issues, about 20 days, out of plan (spec/04 lists them under Phase 5's out-of-plan work).

| Order | Issue | Findings           | Severity     | Days |
| ----- | ----- | ------------------ | ------------ | ---- |
| 1     | #974  | N2 (fixed by #996) | Should fix   | 1    |
| 2     | #975  | N1                 | Should fix   | 1.5  |
| 3     | #978  | E1 (fixed by #995) | Should fix   | 0.25 |
| 4     | #979  | E2                 | Should fix   | 1.5  |
| 5     | #977  | N4                 | Nice to have | 0.25 |
| 6     | #987  | D1                 | Nice to have | 1.5  |
| 7     | #988  | D2                 | Nice to have | 1    |
| 8     | #980  | E3                 | Nice to have | 1.5  |
| 9     | #981  | E4 (after #978)    | Nice to have | 2    |
| 10    | #982  | E5                 | Nice to have | 1    |
| 11    | #985  | M2                 | Nice to have | 1.5  |
| 12    | #984  | E7                 | Nice to have | 2    |
| 13    | #986  | M3                 | Nice to have | 2    |
| 14    | #983  | E6                 | Nice to have | 1    |
| 15    | #989  | M1, L3, L6         | Nice to have | 0.5  |
| 16    | #990  | L1, L2, L5         | Nice to have | 0.5  |
| 17    | #991  | L4                 | Nice to have | 1    |

N3 has no new issue: signing in #850 (0.5b) covers it.
