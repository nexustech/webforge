# 0011. Layers is always visible, under the left column's tabs

- Status: Accepted (amends point 3 of [ADR 0008](0008-roomier-canvas-layout.md) for the left column)
- Date: 2026-10-23
- Related: #275, [spec/04 item 1.24](../../spec/04-implementation-plan.md) (#40), F-ED-11, F-ED-12, T2 in [product/01](../../research/product/01-terminology.md), [UI1 layout](../../research/product/04-editor-look-and-feel.md#1-layout)

## Context
Layers (1.24) was an Advanced-mode panel, and ADR 0008 made each side column one tab set. So:
- Simple mode, the default, had no Layers at all.
- In Advanced mode, Layers was a tab beside Add and Undo History, so it and the Add panel couldn't be seen together.

People should always see the page's structure, without switching modes or tabs.

## Decision
The product owner decided on 2026-10-23:

1. **Layers is always visible, in Simple and Advanced mode, Design and Content mode.** It is no longer an Advanced-only panel. In Content mode it is read-only: nothing can be moved or hidden there, as on the canvas.
2. **The left column is a vertical split.**
   - **Top:** the column's tabs, Add and Undo History, one at a time as before.
   - **Bottom:** Layers, always shown.
   - The splitter is resizable with the mouse and the arrow keys. It is remembered with the other panel sizes (`panelLayout["shell.left"]`), starts at UI1's 60/40, and Reset Panels restores that.
   - The column's toggle still shows and hides the whole column.
3. **The registry stays general.** Layers registers in a slot of its own, `left.lower`, which the left column shows below its tabs whenever something is in it. `advancedOnly` stays for Custom Code and the other Advanced-only panels.
4. **The right column is unchanged:** Edit, Media and Site stay one tab set (ADR 0008 point 3).

## Consequences
- The page's structure is always in view next to the Add panel or Undo History, at the cost of some height for the top tabs: 60% of the column by default.
- ADR 0008 expected that a column might need an optional split again. The left column now has one, and the right column could follow the same pattern if it ever needs to.
- A panel in `left.lower` doesn't become a tab beside Add and Undo History, so "bring a panel to the front" for Layers needs only the column to be open.
- People who used Advanced mode only to see Layers can stay in Simple mode.
