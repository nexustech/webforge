# 0008. A roomier canvas: maximised window, narrower side columns, one panel per column

- Status: Accepted
- Date: 2026-10-21
- Related: [UI1 editor layout](../../research/product/04-editor-look-and-feel.md#1-layout), [spec/04 item 1.2](../../spec/04-implementation-plan.md) (#18), 1.13 (Add panel), 1.14 (Edit panel), 1.18 (Pages panel)

## Context
UI1 laid the window out like Bootstrap Studio: 300 px side columns, each split 60/40 into a top and a bottom slot, in a 1280 × 800 window.

As Phase 1 filled the columns (Undo History on the left, Edit and Pages on the right), the canvas shrank:
- At 1280 px the canvas was about 290 px wide: two 300 px columns, plus Puck's own left sidebar until the Add panel (1.13) and Layers (1.24) replace it.
- Puck zoomed the page down to 22.5% to fit, which is unusable.
- That zoom also pushed Puck's action bar off the canvas.

Webforge is for non-technical small-business owners. For them, the page they are building is the point, and panels are secondary.

## Decision
The product owner decided on 2026-10-21:

1. **The window starts maximised** on Windows and macOS.
   - Once the person un-maximises, resizes or moves it, the main process remembers that in the preferences (`window`), the same way panel sizes are remembered.
   - Saved bounds are used only while they are on a connected screen. Otherwise the window opens centred at its last size.
2. **Side columns are narrower:** 240 px by default instead of 300 px.
   - They're still resizable, collapsible and remembered.
   - They stay between 200 and 360 px, and the canvas keeps at least 40% of the width.
3. **Each side column shows one panel at a time, as tabs.**
   - A column's top-slot panels come first, then its bottom-slot panels. On the right, for example: Edit, then Site (Pages).
   - Opening Pages hides Edit, and the other way round.
   - The slots stay in the panel registry as an order (top before bottom) rather than a vertical split, so areas register panels as before.
   - The title bar's column toggles and the View menu still show and hide whole columns.

## Consequences
- The canvas is at least about 800 px wide in an un-maximised 1280 px window, and much wider when maximised.
- Two panels in the same column can't be seen side by side. If that's needed later, a column could get an optional split again.
- Remembered top/bottom split sizes from before are no longer used.
- Window sizing is OS-specific, and Windows/macOS CI is paused (billing), so the e2e check runs locally on Windows. On Linux without a window manager, maximising may do nothing, so that check skips there.
- Areas that want their panel to come forward, such as the Edit panel when an element is selected, need a way to select a column's tab. That's a follow-up for the panel registry.
