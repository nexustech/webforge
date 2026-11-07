---
id: edit-panel
title: The Edit panel
summary: Change the selected section or element's content and options, on every device or just one.
related: [styling, sections, elements, editing-on-the-page]
updated: 2026-11-06
---

# The Edit panel

The **Edit** panel, the first tab of the right column, shows the options of whatever you've selected. It has up to three tabs:
- **Content:** words, pictures, links, icons and lists of items.
- **Style:** layout, colours, sizes, spacing and animation. See [Styling](styling.md).
- **Advanced:** only in Advanced mode. See [Advanced options](#advanced-options).

In Content mode, only the Content tab is shown.

## Finding an option

- **Search options**, at the top, finds an option by name, opens its group and highlights it.
- Options sit in groups, such as *Text*, *Image*, *Spacing* and *Appearance*. Click a group's title to fold or open it. Ctrl+Enter (Cmd+Enter on a Mac) on a title opens or folds every group.
- A group's title turns the highlight colour when something in it has been changed from the usual.

## Lists of items

Sections such as a Gallery, an FAQ or Pricing hold a list of items. In the Content tab:
- **Add** puts a new item at the end;
- the arrows move an item up or down;
- the bin deletes it.

You can also select an item on the page and edit it there.

## Resetting

- Right-click an option's name and choose **Reset to Default**, or **Reset to Theme's Look** where the option comes from the theme.
- Right-click a group's title and choose **Reset Group to Defaults**.
- On a Mac, Cmd+Esc resets the option or group you're on.

## Copying a group to another item

Point at a group's title for **Copy**, **Paste** and **Reset** buttons. Copy a group, such as *Spacing*, select another item, and paste it there. It's one step you can undo.

## Different on each device

Many options can be different on Desktop, Tablet and Mobile. Columns side by side on a computer can sit one under another on a phone, for example.

- Desktop's setting applies everywhere unless you change it for a smaller device.
- To change an option for Tablet or Mobile only, switch the canvas to that device and change it there.
- A **dot** beside the option shows its state:
  - **grey:** this device uses Desktop's setting;
  - **highlight colour:** it has its own setting. Click the dot to go back to Desktop's.
- The small arrow beside an option shows its setting on every device at once.

## Where a value comes from

Some options show where their value comes from, such as *Theme's look for Button*. Click it to see that part of the [theme](themes.md).

## Advanced options

In Advanced mode, the **Advanced** tab adds:
- **CSS classes**, with suggestions as you type and **Browse classes…** to look through them all by kind. {appName} warns about a class it doesn't know and suggests the nearest one.
- **Anchor ID:** a name for linking straight to this item, such as `opening-times`. Links to a section make one for you.
- **Attributes:** extra HTML attributes such as `data-…`, `aria-…`, `role` or `title`.
- **The item's CSS:** the HTML and CSS {appName} writes for this item, to read and copy. For CSS of your own, use [Custom Code](custom-code.md).
