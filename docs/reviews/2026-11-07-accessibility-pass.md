# Editor accessibility pass (5.5)

7 November 2026, on `main` after 5.4b. Plan item 5.5 (#80): a keyboard-only walkthrough of the core flows, focus order, labels and screen-reader spot checks, and fixes for what it found. Acceptance: the core flows can be completed with the keyboard alone.

## How it was checked

- **Keyboard:** each core flow worked through with the keyboard alone in the built app: from the start screen to an open site, moving around the window, selecting and editing on the page, the Edit panel, adding a section, Undo, the right-click menu, Layers, and the main dialogs (Settings, Export, Publish, Search Commands).
- **axe (WCAG 2.1 A and AA)** on the window itself, not only on the site in the canvas: the start screen, the editor, and each of those dialogs open. `canvasAxe` already checks the site inside the frame; the new `windowAxe` (`e2e/app/window-axe.ts`) checks the editor's own controls and the frame element.
- **Labels and roles:** what a screen reader announces, read from the accessibility tree through the tests' role queries (each part of the window is a named region, the page's frame is named, dialogs are named). No screen reader (NVDA, VoiceOver) was run; see *Not covered*.

Both checks are now E2E tests, `e2e/app/accessibility.spec.ts`, so they keep holding.

## What worked already

- The menu bar is the first Tab stop; menus open and move with the arrows.
- On the page: the arrows select (↑ ↓, Ctrl+↑ for the container, Ctrl+↓ inside), Enter edits text, Esc stops, Shift+F10 or the menu key opens the right-click menu, Delete deletes, Ctrl+Z undoes.
- Layers: the arrows move through the tree, F2 renames, Shift+F10 opens the menu.
- The Add panel: Enter on a section or element adds it after the selection.
- Tab lists (the right column's Edit, Site, Media and Theme) use the arrow keys between tabs, as a tab list should.
- Dialogs trap the focus, start on their first field, and close with Esc.

## What it found, and the fixes

| # | Found | Fix |
|---|---|---|
| 1 | Getting from one part of the window to another took a long run of Tab presses (the page alone has dozens of stops in its toolbars), and from the page there was no way out but Tab. | **F6 and Shift+F6** move between the parts of the window, as in Office and VS Code: the title bar, the left panels (or their strip of icons), the page, the bottom panel and the right panels. Each part remembers where the focus was in it. View › Next and Previous Part of the Window, so they're in the menus and in Search Commands. (`shell/regions.ts`) |
| 2 | F6 and F1 didn't work in a text field, on a button, or while typing on the page: the shortcut keys without Ctrl are left to a focused control, and the page's text stops the keys it gets from going further. | A command can be marked to work **everywhere**; F6, Shift+F6 and F1 are, and listen before any control does. A dialog still keeps its keys. (`shortcut-standard.ts`, `commands.ts`) |
| 3 | **Closing a dialog lost the focus**: Esc or Cancel in Settings, Publish, Search Commands, and every dialog opened by a shortcut, a command or a menu, put the focus on the window's body, so the keyboard started again from the menu bar. Radix gives it back to the dialog's trigger button, and these dialogs have none. | Every dialog and confirmation gives the focus back to what had it when it opened (`useReturnFocus`, in editor-ui's `DialogContent` and `AlertDialogContent`). A dialog that places the focus its own way still does. |
| 4 | axe: the page's frame had no name (`frame-title`), so a screen reader announced an unnamed frame. | The frame is named "Page you're editing: *site*". (`canvas-frame.ts`) |
| 5 | axe: Puck's loading spinner stays in the window, invisible, after the page has loaded, with an `aria-label` on an element that can't have one (`aria-prohibited-attr`). | Hidden once the canvas is ready. (`layout-styles.ts`) |

## Not covered

- **A screen reader run** (NVDA on Windows, VoiceOver on macOS) through the same flows. The names and roles are checked, but not how a reader announces changes (a section added, an element selected, a save). Worth a session with each before the beta, with someone who uses one daily if we can find them.
- **Drag and drop has no keyboard equivalent beyond the commands** (Move up and Move down, Cut and Paste, Add after the selection). Those cover every move, so this is a convenience, not a gap.
- **Theme Studio and the Media library** were checked with axe through their stories (`pnpm visual`) but not walked through by keyboard here.
