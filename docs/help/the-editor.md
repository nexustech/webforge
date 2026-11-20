---

id: the-editor
title: The editor
summary: Where everything is in the editor window, and its modes and views.
related: [editing-on-the-page, add-panel, layers, edit-panel, keyboard-shortcuts]
updated: 2026-11-20
---

# The editor

When a site is open, the editor fills the window, and the window's title names the site, as the taskbar and the window switcher show it.

- **Title bar:**
  - the menus, **File**, **Edit**, **View**, **Site** and **Help** (on a Mac they're in the menu bar at the top of the screen). **Site** holds what sets up the whole site: **Site Settings…**, **Theme…**, **Theme Studio…** and, in Advanced mode, **Stylesheet**; then **Site Check** and **Version History**, which open their panels. Each menu lists its items in groups. **File:** opening a site; saving a version or a copy; previewing, exporting and publishing; settings; closing. **View:** searching commands and moving about the window; the panels, with **Undo History**; the device and outlines; zoom; the interface's size; appearance and modes. **Edit:** undo, the clipboard, arranging, notes and find, with three submenus between them: **Style**, **Select** and **Shared Section**. Point at a submenu, or press the right arrow key on it, to open it; the left arrow key closes it. In a window narrower than about 1280 px, the menus fold into one **Menu** button, three lines, to leave room for the rest: click it, then the menu you want, which opens beside it with the same items;
  - **New** and **Open**;
  - whether your work is saved;
  - **Undo** and **Redo**;
  - the command search;
  - the **Design | Content** switch;
  - buttons to show or hide the side panels;
  - [Site Check](site-check.md)'s button, showing what it found, such as _5 to fix · 13 tips_ or _No problems_. In a window narrower than about 1200 px it shows only what most needs doing, such as _5 to fix_, or _13 tips_ when there's nothing to fix; hover over it for the whole count. Click it to open Site Check;
  - **Preview**, **Export** and **Publish**, with **Publish** filled in colour. In a window narrower than about 1200 px, **Preview** and **Export** show only their icons, an eye and a down arrow; hover over one to see its name. **Publish** and Site Check's count keep their words at every width.
- **Left column:** the [Add](add-panel.md) panel, [Undo History](undo-and-history.md), [Version History](version-history.md) and the [Assistant](assistant.md) as tabs, with [Layers](layers.md) underneath. These four tabs show icons: a square with a plus for Add, a clock with an arrow for Undo History, a box with an arrow for Version History and sparkles for the Assistant. Hover over one, or move to it with the keyboard, to see its name and what it's for.
- **Middle:** your page, as visitors will see it. Above it are the canvas toolbar and a line showing where the selected item sits on the page.
- **Right column:** the [Edit panel](edit-panel.md) for whatever you've selected, with tabs beside it for **Site** ([Pages](pages.md) and the menu), [Media](media.md) and [Theme](themes.md).
- **Bottom panel:** [Site Check](site-check.md). Show or hide it with Ctrl+J (Cmd+J on a Mac).

Before a site is open, on the start screen, the title bar has only the menus, **New** and **Open**. **File › Close Site** goes back there, the site saved.

A button or menu item you can't use at the moment is greyed out, and most say why: hover over the button, or look under the item in a menu or in the command search. Undo says there's nothing to undo, for example, Paste Style asks you to copy a style first, and the Edit menu's Duplicate, Delete and moves ask you to select an element first.

## Moving the panels

- Drag the edges between columns to make a column wider or narrower. The side columns start at 300 px, wide enough for every field in the Edit panel; a width you've chosen stays.
- Collapse a side column with its button in the title bar. It leaves a strip of panel icons; click one to open the column again on that panel.
- **View › Reset Panels** puts everything back as it was.
- **In a small window** (narrower than about 1100 px), the side columns take turns, so your page stays big enough to read. Until you change the panels yourself, the editor opens in a small window with the left column as its strip, and opening one side column folds the other. Dragging a column wider still works, and once you've changed the panels, your layout is kept.

## Using the keyboard

You can do everything in the editor without a mouse.

- **F6** moves to the next part of the window: the title bar, the left panels, the page, the bottom panel and the right panels, in that order. **Shift+F6** goes back. Each part remembers where you were in it.
- **Tab** moves between the buttons and options in a part. In a row of tabs, use the arrow keys. A button you move to shows its tooltip, as it does when you hover over it: its name, its shortcut if it has one, and why it's greyed out if it is. **Esc** hides the tooltip.
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
- a **CSS** tab in **Style This…**;
- **Include developer files** when you export.

Switch with **View › Use Advanced Mode**, or in [Settings](settings.md#interface). The mode is yours, not the site's: it doesn't change your site.

## Devices and zoom

Your site adapts to the visitor's screen. Use **Desktop**, **Tablet** and **Mobile**, at the top right of the canvas, to see and edit each size (Ctrl+1, Ctrl+2 and Ctrl+3; Cmd on a Mac). Hover over a toolbar button to see its name and its shortcut, if it has one.

On the left of the canvas toolbar:

- **Zoom:** zoom in or out, or choose a zoom level. _Fit_ fits the page to the window.
- **Rotate:** swaps a device's width and height.
- **View:** turn on outlines, spacing, element names, or extra space at the bottom of the page. These only change the editor. Ctrl+Shift+O (Cmd+Shift+O on a Mac) shows or hides the outlines, and Ctrl+Shift+N the element names, as **View › Show Outlines** and **Show Element Names** do.
- **The size box:** type any width, or choose a device. **Add Device…** adds a screen size of your own, such as your own phone's. Manage those in [Settings › Devices](settings.md#devices).

In a narrow window the toolbar makes room for Desktop, Tablet and Mobile, which always stay:

- the size shows as a screen icon; click it for the device list, or hover over it to see the size;
- the width box moves into the toolbar's **View** menu as **Canvas Width…**;
- then zoom in, zoom out and **Rotate** move there too.

You can also drag the canvas's left or right edge to change the width. It snaps to each device's width; hold Alt to place it freely.

Changes you make while viewing Tablet or Mobile can apply to that device only. See [The Edit panel](edit-panel.md#different-on-each-device).

## Making everything bigger or smaller

The zoom above changes only the page on the canvas. To make all of {appName} bigger or smaller (its menus, panels and text, the Help window too), choose a **Text size** in [Settings](settings.md#interface), or use the **View** menu:

- **Zoom In Interface** (Ctrl+Alt+=)
- **Zoom Out Interface** (Ctrl+Alt+−)
- **Reset Interface Zoom** (Ctrl+Alt+0), back to 100%

On a Mac, use Cmd+Option. On some keyboards Ctrl+Alt with a key types a character instead, such as } on a German keyboard: use the View menu there. It goes from 80% to 150%, and {appName} remembers it next time you open it. It never changes your site, or how it looks to visitors.

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

**Help › About {appName}** shows {appName}'s icon and the version you have. {appName} is made with open-source software. **Help › Open-Source Licences**, or **Open-Source Licences** in **Help › About {appName}**, lists every part of it that comes with {appName}, the fonts included, each with its version and licence. Click one to read its licence, or type in **Find a package or licence** to find one. **Chromium's Licences** opens the licences of Chromium, which {appName} runs on, in your web browser.
