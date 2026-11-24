# Anti-patterns

Mistakes that reviews of this codebase keep finding and that **no check catches**: not Biome, dependency-cruiser, knip, the type checker or a guard test. Each entry says what the mistake looks like here, why it hurts, what to do instead, and which review found it. Read it before writing code and while reviewing a PR.

The examples are the ones the reviews gave; most have been fixed since, and they are here to show the shape of the mistake. Finding IDs are each review's own: the extensibility review and the codebase review both use E-numbers, so those are written "ext E1" and "codebase E1". "Arch 1" is the [architecture review of 23 Oct 2026](reviews/2026-10-23-architecture-review.md), whose findings are tracked by its issues R1–R17.

**Keeping it current.** A review that finds a mistake for the second time, with no check to catch it, adds an entry. When a check starts to catch one, move it to [Now checked](#now-checked) and name the check. Seeded on 20 Nov 2026 from `docs/reviews/` (OL-17, [competitors/04](../research/competitors/04-onlook.md#76-decisions)).

## Safety and trust

### 1. A guard on one path and not on its siblings

- **Looks like:** the 50-megapixel decode limit was enforced in the import worker only, while pictures inside an opened site file went straight to the decoder (S12). The Must-fix gate lived only in the renderer's export command, so republishing a version skipped it (A6). Removing and moving an element skipped the Custom Code guard other commands had (S19).
- **Why it hurts:** the unguarded path is the one an attacker or an AI app uses.
- **Instead:** put the guard in the one function every path goes through (main's handler, a shared schema), and test each way in.
- **Found by:** [security review](reviews/2026-10-30-security-review.md) S1, S12, S19; [security review 2](reviews/2026-11-08-security-review-2.md) S31; [architecture review 2](reviews/2026-10-30-architecture-review-2.md) A6; [codebase review](reviews/2026-11-13-codebase-review.md) N1, N4.

### 2. Treating what a site file says as what the owner decided

- **Looks like:** a saved password was looked up by project and profile alone, while the host, port and protocol it would be sent to lived in the same shareable `.wforge` (S2). Publish destinations sat in the undoable, versioned document, so an undo could drop Netlify's site ID (A3). An imported `custom.css` was exported with no trust prompt (N1).
- **Why it hurts:** a file that comes back from someone else can redirect the real hosting password or put code in front of visitors.
- **Instead:** trust and secrets live in the app's own data and the keychain, never in the site file. Code from a file the owner didn't write goes behind the trust prompt. Per-site state that must not be undone stays out of the document.
- **Found by:** security review S1, S2, S3; security review 2 S32, S38; architecture review 2 A3; codebase review N1.

### 3. Unbounded work on input from outside

- **Looks like:** a lazy regular expression in the Markdown import took 25 s on 160 KB of unclosed emphasis, on the renderer's main thread (N2). A table was read before the file's structure was checked, so a crafted view froze the main process (S4). A download's size limit was checked after the whole body was in memory (S11). Recursive walkers over untrusted depth threw a `RangeError` that `safeParse` doesn't turn into a validation error (arch 1).
- **Why it hurts:** the app hangs until it is force-quit, and unsaved edits are lost.
- **Instead:** linear scans or a length cap; iterative walkers with a depth cap; limits checked while streaming; structure checks before any read; heavy work in the writer thread or a worker.
- **Found by:** codebase review N2; security review S4, S11, S12; arch 1 (R13, R14); architecture review 2 A5.

### 4. Writing a value into the document without checking it against its field

- **Looks like:** a list edit wrote the value it was given without checking the list's fields, and paste accepted any string for a select, slider or spacing field, so pasting a Section's `gap: "none"` onto Columns stored a value off its scale (A11).
- **Why it hurts:** the invalid value becomes an undo step and is autosaved.
- **Instead:** every new way to write a field value goes through `acceptsFieldValue` (`packages/site-components/src/field-values.ts`), as changes, paste, list edits and field drags do.
- **Found by:** arch 1 (R10); architecture review 2 A11.

## Structure

### 5. The same rule written again instead of imported

- **Looks like:** six copies of "how an element is named", with different handling of an empty name. Five value-equality helpers with different meanings (A18). Three abortable sleeps, one rejecting and two resolving on abort. Three file-size formatters, so one file showed two sizes in Media and in Site Check.
- **Why it hurts:** a fix lands in one copy and misses the others, and the copies decide things that matter, such as whether an edit becomes an undo step.
- **Instead:** look for the helper first (`elementName`, `sameJson` in `@webforge/model`, `sleep` in `@webforge/publish`, `sha256HexSchema`); if it's missing, add one in the lowest package that can own it.
- **Found by:** arch 1 (R10); architecture review 2 A18; codebase review D1, D2; [UI/UX audit](reviews/2026-11-14-ui-ux-audit.md) §9.5.

### 6. A model limit typed again as a number

- **Looks like:** `maxLength={200}` in a dialog and `MAX_NAME_LENGTH = 100` in two files, each repeating a limit the model's schema already sets.
- **Why it hurts:** the form and the schema drift apart, and a value the form accepts fails at the boundary.
- **Instead:** export the limit from `@webforge/model` and use it in the form.
- **Found by:** arch 1 (R10); [extensibility review](reviews/2026-10-24-extensibility-review.md) ext E12.

### 7. Adding a feature by editing a central file

- **Looks like:** `Editor.tsx` calling ten `connect*` and `register*` functions in one effect (ext E1). `startApp` growing into one closure of several hundred lines (A12, M2). The project session gaining a public method, a private twin and a registry entry for each feature (A13).
- **Why it hurts:** every area edits the same files in an order that matters, and a missed teardown (a publish left running through quit) is easy to miss in review.
- **Instead:** the registries in [extending.md](extending.md): an area registers itself and returns its own clean-up; a main feature is a `createXFeature(deps)` listed in `startApp`'s `features`.
- **Found by:** arch 1 (R8); extensibility review ext E1; architecture review 2 A12, A13; codebase review codebase E7, M2, M3.

### 8. Logic written inside a React component and tested by rendering it

- **Looks like:** the Edit panel's host held the change, list, gesture and text-session logic, grew from 484 to 882 lines between two reviews, and had a 1,187-line test that reached pure write logic through a rendered component (A10).
- **Why it hurts:** the logic is rebuilt on every render and can only be tested slowly.
- **Instead:** a module with no React in it (`createEditPanelController`), unit-tested directly, and a thin component that binds it.
- **Found by:** arch 1 (R9); architecture review 2 A10.

### 9. A catch-all branch, or a vendor's name standing in for a capability

- **Looks like:** a `switch` on an AI tool's name whose `default:` created a site from a brief, so an unknown tool quietly did that (codebase E1). `kind !== "claude"` used to mean "this client verifies the server" (codebase E3).
- **Why it hurts:** a new case takes the wrong path with no compile error.
- **Instead:** an exhaustive map checked with `satisfies`, and capabilities as named fields on the registry entry (`verifiesServer`, `savesVersionFirst`).
- **Found by:** codebase review codebase E1, E3, E4; architecture review 2 A14.

### 10. Naming a component type outside the catalogue

- **Looks like:** a Site Check rule listing Heading, Hero and Custom Code as the types that write a page's main heading (codebase E5).
- **Why it hurts:** a new section with a main heading needs an edit in another package that nothing points to.
- **Instead:** a flag on the component's definition, carried into the catalogue data, that other packages read.
- **Found by:** codebase review codebase E5; extensibility review §1.

### 11. A Puck or Tiptap selector written outside `puck-dom.ts`

- **Looks like:** `data-puck-component` typed out in seven engine files, a canvas selector in the themes package (A19), and about forty selectors hard-coded across the E2E tests (A20).
- **Why it hurts:** when Puck's markup changes on an upgrade, a feature stops working without any check failing.
- **Instead:** add the selector to `packages/engine/src/puck/puck-dom.ts`, with its assertion in `puck-dom.test.tsx`, and import it, in E2E tests too.
- **Found by:** arch 1 (R8); architecture review 2 A19, A20.

### 12. `JSON.stringify` as an equality test

- **Looks like:** page-list changes detected by comparing `JSON.stringify` output in four files; "differs from the default" decided the same way (A18).
- **Why it hurts:** the order of keys changes the answer, and the answer decides whether an undo step is made.
- **Instead:** compare references where the data is structurally shared, or use `sameJson` from `@webforge/model`.
- **Found by:** arch 1 (R9); architecture review 2 A12, A18.

## Truth

### 13. A comment, document or review stating behaviour that no test holds

- **Looks like:** four comments and a README said unused blobs are collected "at open or close", while the function that does it had no caller in the app, so every site file grew without limit (A1). A comment said a VPN's address is never used while the code took any adapter's (S9). A review said a setting was "verified" when no test read it (S15).
- **Why it hurts:** reviewers and later sessions trust the sentence.
- **Instead:** when a comment or document claims a behaviour, add the test that fails without it. When a standard isn't followed, change the code or change the standard.
- **Found by:** architecture review 2 A1, A22; security review S8, S9, S15; security review 2 S39; arch 1 (R17); codebase review codebase E2.

### 14. Code that is tested but that nothing in the app calls

- **Looks like:** the blob collector above (A1); a Netlify sign-in module that only its own test imported, and which saved a token outside the agreed record (S38); a publish-destination schema that was always empty and read by nothing (A3).
- **Why it hurts:** it reads as done, and the next item wires it up as it stands or builds on a shape that fits nothing. knip doesn't flag it, because a test uses it.
- **Instead:** wire it in the same PR, with a test at the caller, or leave it out.
- **Found by:** architecture review 2 A1, A3, A16; security review 2 S38.

## What people see

### 15. An action that can't happen and doesn't say why

- **Looks like:** disabled menu items and title-bar buttons with no reason given; a handler that returns quietly on a state it doesn't accept.
- **Why it hurts:** "why can't I click this?" is the most common dead end for someone new, and a click that does nothing looks like a broken app.
- **Instead:** the rule in [standards §4](../spec/03-engineering-standards.md#4-code-style--conventions), _Refusals_ (OL-11): every refusal says why, in words from the catalogue. A command gives its `disabledReason`; a drop or paste that isn't allowed says what is.
- **Found by:** UI/UX audit §3 fix 4, §8.3; [UX/UI review](reviews/2026-11-19-ux-ui-review.md) §5.

### 16. An internal value on screen when a lookup misses

- **Looks like:** Site Check listed "LD5wURuiGOJhw1YE on Home" for an element added since the site opened, because the description fell back to the element's ID (F1). A raw string key shown when a string was missing.
- **Why it hurts:** the person can't tell what to change, just before publishing.
- **Instead:** fall back to the kind's name in words, never an ID or a key, and test with elements added in the same sitting, nested ones and shared sections.
- **Found by:** UX/UI review F1, F15, §5; UI/UX audit §7.5.

### 17. A confirmation, or a red button, for a change Undo reverses

- **Looks like:** one colour change took two dialogs and a red button, while deleting a section asked nothing and showed "Deleted FAQ · Undo" (F4).
- **Why it hurts:** red means danger, and the dialog itself said the change could be undone.
- **Instead:** apply the change and show a toast that says how far it reached and offers Undo (LF-15). Keep confirmations, and red, for what can't be undone.
- **Found by:** UX/UI review F4, F17; UI/UX audit §9.2.

### 18. Hand-building a piece of interface that has a shared component

- **Looks like:** raw `<button>` elements beside the shared `Button`; nine hand-written empty states; the warning callout copied three times; a slider that removed the focus outline and put nothing in its place (F12); dialogs exporting their own `Field`.
- **Why it hurts:** the same control looks and behaves differently a few pixels apart, and keyboard users lose their place.
- **Instead:** the `@webforge/editor-ui` component (`Button`, the form engine, `FormDialog`); where one is missing, add it there and use it everywhere.
- **Found by:** UI/UX audit §9.5, §10; UX/UI review F12; extensibility review ext E3, E5.

## Tests

### 19. Measuring once what the app or the platform settles a moment later

- **Looks like:** the title bar's fit was measured once after a resize, while on Linux the window controls' overlay reports the room for the size before it for a moment (`small-window.spec.ts`, fixed in #1341). The canvas's tooltips were hovered before the canvas was ready (#1125). Theme Studio's accent radio was read while the studio was still laying out (#1277). A point on a new Table's row was picked before the canvas had compiled the Table's styles, so the rows grew under the pointer and left it on the Table's headings (#1350).
- **Why it hurts:** the test passes on a fast machine and fails at random on a busy CI runner, often on one OS only. Each failure costs a fix and a full re-run, and the merge queue holds every PR behind it: races like these were among the most common causes of the 32% of PR runs that failed in the week of 16 Nov 2026.
- **Instead:** wait for the condition itself, with `expect.poll` or `toPass` around the measurement, never a fixed sleep or a longer timeout. A failure on one OS only is a real bug until shown otherwise.
- **Found by:** #1347's survey of the CI failures of 9–23 Nov 2026.

### 20. A poll whose failure doesn't say what it saw

- **Looks like:** `table.spec.ts`'s outline poll returned `true` or `false`. After 30 s on macOS CI, all it said was "Expected: true, Received: false", the trace keeps no measurements, and no run here reproduced it (#1347).
- **Why it hurts:** a failure seen only in CI can't be diagnosed, so it gets a longer timeout instead of a fix.
- **Instead:** poll for a value that says what was measured, such as `"fits"` or the two boxes, and compare it with the one wanted, so the error holds the evidence.
- **Found by:** #1347.

### 21. Taking the first of Puck's outlines as the selected element's

- **Looks like:** `canvas().locator(OVERLAY).first()`, measured or clicked as the selected element's outline or bar. Puck draws an outline, with its bar, for each hovered element as well as the selected one, and keeps them in the order they were first drawn, so the first can be another element's. `table.spec.ts` measured it this way until #1350: with the Table left hovered, its outline came first in some runs, and the test said the row's outline didn't fit. The quick-action tests had found the same thing and pick the selected outline instead (`canvas-chrome.spec.ts`).
- **Why it hurts:** the test checks whichever element was outlined first, so it fails, or passes, for something it doesn't name.
- **Instead:** find the outline by what it's for: `.wf-outline[data-state="selected"]`, or `[data-wf-id="<id>"]` for one element's. To check that nothing else is outlined, count the outlines drawn and say whose each one is.
- **Found by:** #1350.

### 22. Letting a drag go on any drop preview

- **Looks like:** an E2E drag that waits for a drop preview anywhere on the canvas and then lets go. `shared-layout.spec.ts`'s drag of a Heading into the Footer's first column did so, at a point measured once before the drag. The links it aimed at are 44 × 12 px at the canvas's fitted zoom. On a busy Windows runner the preview was still in a zone the pointer had crossed on its way, or never reached the small target, and the test failed with "No drop preview where the drag ends" (PR 1356, then PR 1360). Slowed 3× with CDP CPU throttling it failed almost every time, and at 2× it always passed.
- **Why it hurts:** the drop lands in whichever zone the preview happened to be in, so the test fails at random on a slow runner, or passes having dropped somewhere it doesn't check.
- **Instead:** pass `drag()` the zone the drop is aimed at as `into`. It then lets go only once the preview is inside that zone. Give the point as a function, such as `() => lowerHalf(links)`, so it's measured again at every try. To check a drag is robust, run it with the renderer slowed: `WEBFORGE_E2E_CPU_SLOWDOWN=3` with `--repeat-each 20` (`e2e/README.md`). A miss says where the preview was and which zones were under the pointer, which is how #1393 found a place on the canvas where nothing dropped.
- **Found by:** #1336's review (PR 1360).

## Now checked

These were found by reviews too, and a check now catches each. They are listed so nobody adds them above.

| Mistake                                                          | Checked by                                                           |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| A cast to a branded ID (`as PageId`)                             | The Biome plugin `tools/biome/no-branded-id-cast.grit`               |
| The browser's `title` in place of the shared tooltip             | `pnpm ui-strings`                                                    |
| An IPC channel that touches the site without naming its session  | `apps/desktop/src/shared/ipc-sessions.test.ts`                       |
| `console` in app code                                            | Biome's `noConsole`                                                  |
| Manual memoisation, or a write to a ref or state while rendering | `pnpm react-compiler`                                                |
| One renderer area importing another's files, and import cycles   | dependency-cruiser's area rules and `tools/src/check-area-cycles.ts` |
| A panel without a story                                          | `tools/src/panel-stories.test.ts`                                    |
| `t()` called with the wrong parameters                           | The type checker (typed parameters in `@webforge/i18n`)              |
