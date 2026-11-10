---

id: stylesheet
title: The Stylesheet panel
summary: Write CSS of your own for your site, with suggestions, warnings and a live view on the page.
related: [custom-code, edit-panel, styling, site-check]
updated: 2026-11-10
---

# The Stylesheet panel

Your site's own stylesheet (`custom.css`) holds CSS you write yourself, for a look {appName}'s Style options don't give. It's an Advanced mode feature: turn that on with **View › Use Advanced Mode**.

Open it with **View › Stylesheet**, or the **Stylesheet** tab at the bottom of the window, beside Site Check. The **Open Stylesheet** link in an item's CSS tab opens it too.

## Writing CSS

What you type shows on the page as you type it. Your stylesheet comes after {appName}'s own, so your rules win where they overlap, and a new theme still changes everything you haven't styled yourself.

As you type, the panel suggests:

- your theme's variables inside `var(`, such as `var(--color-primary)`: CSS that uses them follows your theme's colours, corners and fonts;
- the classes your site uses after `.`, and every class {appName}'s styles have;
- your sections' anchors after `#`.

It underlines:

- what isn't valid CSS;
- a variable your theme doesn't have, often a typing slip;
- a file from another website, such as a font or picture: your site wouldn't work offline. [Site Check](site-check.md) can keep a copy with your site;
- a rule for a class or id nothing on your site has, faintly.

Each pause in your typing is one step for **Undo** (Ctrl+Z, Cmd+Z on a Mac), named _Edited site CSS_.

## Styling one element

Select an element on the page, then:

- **Target This Element** adds a rule for it at the end of your stylesheet, ready to type into. An element with an **Anchor ID** is styled by it (`#opening-times`). Any other element gets a class named after it, added to its **CSS classes** in the Advanced tab (`.opening-times`), and numbered (`.heading-2`) when {appName}'s styles or your site already use that name. A copy of the element, made with **Duplicate** or Copy and Paste, keeps the class, so it keeps the look too; an anchor isn't copied.
- **Move This Look to CSS** turns the element's own Style settings, such as its colours, corners and border, into a rule in your stylesheet, and clears them from its Style tab. The rule uses your theme's variables, so it still follows your theme. Settings that style a part inside the element, such as a section's title, stay in its Style tab.

Both are one step for Undo.

## The same stylesheet elsewhere

**File › Settings…**, then **Custom Code**, shows the stylesheet too, as **Stylesheet (custom.css)**, with your site's other code. See [Custom Code](custom-code.md).

[Site Check](site-check.md) lists a rule that styles nothing on your site as a Tip, and a file from another website as a Must fix.
