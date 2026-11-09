---

id: the-editor
title: The editor
summary: Where everything is in the editor window, and its modes and views.
related: [editing-on-the-page, add-panel, layers, edit-panel, keyboard-shortcuts]
updated: 2026-11-09
---

# The editor

When a site is open, the editor fills the window.

- **Title bar:**
  - the menus (on a Mac they're in the menu bar at the top of the screen);
  - **New** and **Open**;
  - whether your work is saved;
  - **Undo** and **Redo**;
  - the command search;
  - the **Design | Content** switch;
  - buttons to show or hide the side panels;
  - **Preview**, **Export** and **Publish**.
- **Left column:** the [Add](add-panel.md) panel, [Undo History](undo-and-history.md) and [Version History](version-history.md) as tabs, with [Layers](layers.md) underneath. These three tabs show icons: a square with a plus for Add, a clock with an arrow for Undo History and a box with an arrow for Version History. Hover over one, or move to it with the keyboard, to see its name and what it's for.
- **Middle:** your page, as visitors will see it. Above it are the canvas toolbar and a line showing where the selected item sits on the page.
- **Right column:** the [Edit panel](edit-panel.md) for whatever you've selected, with tabs beside it for **Site** ([Pages](pages.md) and the menu), [Media](media.md) and [Theme](themes.md).
- **Bottom panel:** [Site Check](site-check.md). Show or hide it with Ctrl+J (Cmd+J on a Mac).

## Moving the panels

- Drag the edges between columns to make a column wider or narrower.
- Collapse a side column with its button in the title bar. It leaves a strip of panel icons; click one to open the column again on that panel.
- **View › Reset Panels** puts everything back as it was.

## Using the keyboard

You can do everything in the editor without a mouse.

- **F6** moves to the next part of the window: the title bar, the left panels, the page, the bottom panel and the right panels, in that order. **Shift+F6** goes back. Each part remembers where you were in it.
- **Tab** moves between the buttons and options in a part. In a row of tabs, use the arrow keys.
- On the page, the arrow keys select the next or previous item, **Enter** edits its text and **Esc** stops. See [Editing on the page](editing-on-the-page.md).
- **Shift+F10**, or the menu key, opens the right-click menu for what you've selected.
- **Esc** closes a dialog and takes you back to where you were.

Every key is listed in [Keyboard shortcuts](keyboard-shortcuts.md).

## Design and Content mode

The **Design | Content** switch in the title bar sets what you can change.

- **Design** (the usual): change everything.
- **Content:** change the words and pictures only. You can't add, move, delete or restyle anything, so nothing can be knocked out of place by accident. Handy when someone else updates prices or opening hours.

{appName} remembers the mode with each site.

## Simple and Advanced mode

{appName} starts in **Simple** mode. **Advanced** mode adds a few things for people who know some web code:

- the Edit panel's **Advanced** tab (CSS classes, anchor IDs and attributes, and the item's CSS);
- **Custom Code**, in the Add panel and in Settings;
- your own colours outside the theme in colour pickers;
- a **CSS** tab in _Style this…_;
- **Include developer files** when you export.

Switch with **View › Use Advanced Mode**, or in [Settings](settings.md#interface). The mode is yours, not the site's: it doesn't change your site.

## Devices and zoom

Your site adapts to the visitor's screen. Use **Desktop**, **Tablet** and **Mobile**, at the top right of the canvas, to see and edit each size (Ctrl+1, Ctrl+2 and Ctrl+3; Cmd on a Mac).

On the left of the canvas toolbar:

- **Zoom:** zoom in or out, or choose a zoom level. _Fit_ fits the page to the window.
- **Rotate:** swaps a device's width and height.
- **View:** turn on outlines, spacing, element names, or extra space at the bottom of the page. These only change the editor. Ctrl+Shift+O (Cmd+Shift+O on a Mac) shows or hides the outlines, and Ctrl+Shift+N the element names, as **View › Show Outlines** and **Show Element Names** do.
- **The size box:** type any width, or choose a device. **Add device…** adds a screen size of your own, such as your own phone's. Manage those in [Settings › Devices](settings.md#devices).

You can also drag the canvas's left or right edge to change the width. It snaps to each device's width; hold Alt to place it freely.

Changes you make while viewing Tablet or Mobile can apply to that device only. See [The Edit panel](edit-panel.md#different-on-each-device).

## Finding a command

**Search Commands…** (Ctrl+P, Cmd+P on a Mac, or click the box in the title bar) finds any command by name. It also finds a page to go to, a section or element to add, and a help page to read. Every command's keyboard shortcut is listed in [Keyboard shortcuts](keyboard-shortcuts.md), or press **?**.

## Help

**Help › {appName} Help**, or F1, opens these help pages in a window of their own, beside the editor, so you can read and work at once. Choose a page from the contents on the left, or search them all. Links between pages stay in the Help window, and **Back** returns to the page before; a link to a website opens in your web browser. The pages come with {appName}, so they work without an internet connection.

Help is also where you need it:

- a small **?** beside the Edit panel's heading, at the top of each section of [Settings](settings.md) and [Site Settings](site-settings.md), in the Export, Publish, Page Settings and Preview on Phone dialogs, when {appName} asks about code from somewhere else, and on each check in [Site Check](site-check.md) opens the help for it;
- **Help for This Element**, in the [right-click menu](editing-on-the-page.md#the-right-click-menu) on the page and in Layers, opens the help for the selected section or element;
- the start screen's **Help** tab lists the pages to start with.

**Help › Take the Tour** shows you around the editor in three short steps. See [Getting started](getting-started.md#the-tour).

### Open-source licences

{appName} is made with open-source software. **Help › Open-Source Licences**, or **Open-Source Licences** in **Help › About {appName}**, lists every part of it that comes with {appName}, the fonts included, each with its version and licence. Click one to read its licence, or type in **Find a package or licence** to find one. **Chromium's Licences** opens the licences of Chromium, which {appName} runs on, in your web browser.
