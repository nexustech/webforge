---

id: header-and-footer
title: Header, Footer, announcements and shared sections
summary: The parts that are the same on every page, an announcement bar above them, and sections you share between pages.
components: [Header, Footer, FooterColumn, MenuLinks, AnnouncementBar]
related: [pages, layers, add-panel, site-check]
updated: 2026-11-26
---

# Header, Footer, announcements and shared sections

## Header and Footer

The **Header**, at the top, and the **Footer**, at the bottom, are the same on every page. Change them on any page and every page changes. While you edit one, a line above the page says how many pages the change applies to.

**Header** options:

- **Site name:** comes from [Site Settings](site-settings.md#general).
- **Logo** (once you choose one in [Site Settings](site-settings.md#general)): _In place of the name_ or _Beside the name_. In place of the name, your site's name is the logo's description for people who can't see it. Without a logo the Header shows the name. On a dark colour or photo it shows your **Logo for dark backgrounds**, if you chose one in Site Settings.
- **Logo size:** _Small_, _Medium_ or _Large_. On phones the logo stays no taller than the menu button, so the Header stays one line high.
- **Layout:** _Name left, menu right_, _Centred_ or _Name left, menu centred_.
- **Show a button:** a button such as "Book now" or "Get a quote", in any layout: on the right on a computer, and last in the menu on phones. Give it its **Button text** and **Button link**. If your menu also links to the same page, hide that link in the [Menu](pages.md#the-menu), so it isn't there twice.
- **Background** (in the **Style** tab): _Its own_, a band above the page, or _The first section's_. With _The first section's_, the Header has no band of its own: on every page it sits on the picture, gradient or colour the page's first section opens with, and its menu takes that section's text colour. The section makes room for it, so its title is never under the menu. See [The Header on the first section](#the-header-on-the-first-section).
- **Stay at the top when scrolling:** keeps the Header in view as visitors scroll.
- **Change style when scrolling** (with _Stay at the top_ on): _Shadow_, _Shrink_, _Solid background_, _Hide when scrolling down_ or _None_. _Hide when scrolling down_ slides the Header out of view as visitors scroll down the page, leaving more of a phone's screen for your content, and brings it back as soon as they scroll up. It stays in view at the top of the page, while the menu on phones is open, and for visitors moving around with the keyboard. For visitors who ask their device for less motion it goes and comes back without sliding. With the Background at _The first section's_, only _Shadow_, _Shrink_ and _Hide when scrolling down_: the Header turns solid anyway as the page scrolls.
- **Highlight the section in view** (when your menu links to a section): as visitors scroll, the menu lights up the section they're looking at. On unless you turn it off. See [Menu links to sections](links.md#menu-links-to-sections).
- **Content width** (in the **Style** tab): _Narrow_, _Medium_, _Wide_ or _Full_, as for a [section](sections.md). It sets how wide the name, menu and button spread on a computer: at _Wide_ they line up with a Wide section's content. The Header's background, its style when scrolling and the menu on phones still fill the page's width, and phones look the same at every width. New sites start at _Wide_; a site made before this setting keeps _Full_, so nothing moves until you change it.

The Header's menu lists your pages. Change it in the [Site panel's Menu](pages.md#the-menu).

### The Header on the first section

With the Header's **Background** at _The first section's_, each page follows its own first section:

| The page opens with                                | The Header shows                                   |
| -------------------------------------------------- | -------------------------------------------------- |
| A Hero with _Image behind the text_                | The menu on the picture, in the Hero's text colour |
| A section in a colour of its own, or _Reversed_    | That colour, with no line between the two          |
| A section in the page's own colour                 | The same as with its own background                |
| No sections, or the Header hidden in Page Settings | Nothing changes                                    |

- It applies on every page, as every Header setting does. If you move another section to the top, or delete the Hero, the Header follows the new first section. It's one step to undo.
- A Header that stays at the top turns solid, in the page's colours, once the page has scrolled a little. If you chose _Solid background_ or _None_ before, it shows as _Shadow_, and your choice comes back if you change the Background to _Its own_. A Header that doesn't stay at the top scrolls away with the section.
- On phones the menu's button sits on the section, and the opened menu is solid. The [Announcement bar](#announcement-bar) stays a solid band above the Header.
- On a dark colour, or a photo under a dark overlay, the Header shows your [Logo for dark backgrounds](site-settings.md#general), if you chose one. A Header that stays at the top changes to your logo as it turns solid in the page's colours, and back at the top of the page.
- The menu is as easy to read as the section's own text: if the section's text is hard to read on its picture, {appName} warns you, and a stronger overlay helps both.
- A Hero that opens its page has a **Header** line at the top of its **Style** tab's Options: **Change in the Header** selects the Header.
- A site made before this setting keeps _Its own_, so nothing moves until you change it.

On phones the menu folds into a button. To see and edit it open, view Mobile, select the Header and turn on **Show mobile menu**.

The **Footer** has its own **Text**, a layout, and up to three columns of elements. Type `{year}` in its text, or in any text, and your website shows the year it was exported or published in, such as "© {year} Rosie's Café". Export or publish again in the new year to update it: once your site is published, [Site Check](site-check.md#tips) reminds you.

- **Layout:** _Centred_ centres its columns and its bottom line; _Columns_ spreads them to the sides. On phones the columns go one under another, in the same order.
- **Bottom line:** with columns, the Footer's text sits under them, over a thin rule, with its **Links** and _Cookie settings_ at the other end. Without columns, its text, links and _Cookie settings_ show as they always have.
- **Links:** tick the pages the bottom line links to, such as your Privacy or Terms page. They're its own, apart from your menu, in the order of your pages.
- **Content width** (in the **Style** tab): as for the Header, set on its own. It sets how wide the columns, text and bottom line spread; the background still fills the page's width. New sites start at _Wide_, and a site made before this setting keeps _Full_.
- **Start from:** select the Footer and choose _Simple_ (its text alone), _Columns_ (your menu's links over it) or _Full_ (your menu's links, your opening hours and contact details, your social links and a newsletter signup) in the toolbar under the canvas, in Design mode. It replaces the Footer's columns, on every page, at once; if they held anything, a message offers **Undo**. Your Footer text stays. **Add column** and **Remove last column** are there too.

A **Footer column** holds a **Heading**, **Text**, a **List**, **Social links**, an **Image**, **Menu links**, **Opening hours and contact** and a **Newsletter signup**. Select a column, or something in it, and click one in the [Add panel](add-panel.md), or drag it into the column. **Paste** (Ctrl+V, Cmd+V on a Mac) puts what you copied in the same place, on every page. What no column takes, such as a section, goes on the page. **Menu links** lists your menu's links and changes when your menu does. Its **Leave out** takes some of your menu's pages out of the Footer, and **Add** lists other pages after them, such as one hidden in the menu because the Header shows it as its button, or a Privacy page. The Footer has one at most. Opening hours and contact, and a Newsletter signup, fit the column: they show without their section's background and spacing, with their title as the column's title, and their Edit panel offers only the settings that show there. A Large heading in a column keeps its size, but it's never the page's main heading: each page keeps its own. An **Image** in a column has a **Size** of _Small_, _Medium_ or _Large_, as high as the Header's logo at that size, in place of its Width and Shape: your logo there matches the Header's.

You can't move, duplicate or delete the Header or Footer. To leave one off a page, use the page's [Page Settings](pages.md#page-settings) (_Hide the Header on this page_), or click its eye in [Layers](layers.md).

## Announcement bar

An **Announcement bar** is a thin strip of news above the Header, such as "Closed 24–26 December". Click **Announcement bar** in the Add panel (under **Basic**) and it goes above the Header on every page. Click it again to select the one that's there: a site has one.

- **Text:** click the bar's text on the canvas to change it.
- **Link:** makes the text a link, to a page or anywhere else.
- **Show until:** the bar's last day. After it, visitors no longer see the bar. Leave it empty to show the bar until you delete it.

The bar is in your theme's dark colour, and has a close button for visitors. Closing it hides it for the rest of their visit, on every page, until you change its text. Its colours, space inside and look are in the **Style** tab, as for any section.

To remove the bar, select it and press Delete. A page whose Header is hidden (in its Page Settings) hides the bar too: clicking **Announcement bar** there adds one to that page only. If you drag the Announcement bar onto a page instead, it shows on that page only.

Your site hides the bar once the page has opened, so a visitor who closed it, or a bar past its last day, still shows for a moment on each page. Visitors whose browser runs no scripts see the bar without its close button, even after its last day. Delete the bar once it's out of date: [Site Check](site-check.md) reminds you.

## Contact buttons

**Contact buttons** (under **Contact** in the Add panel) go after the Footer on every page, the way the Announcement bar goes above the Header. Click them again to select the ones that are there: a site has one set. On your site they stay at the bottom left of the screen, with room left for them at the end of the page so they never cover the Footer; on the canvas they show after the Footer, so you can select them. What each button does is in [Sections](sections.md#contact-buttons). To remove them, select them and press Delete. A page whose Footer is hidden hides them too: clicking **Contact buttons** there adds them to that page only.

## Shared sections

A **shared section** is a section stored once and placed on several pages, such as an offer or a "Book now" banner. Edit any copy and every copy changes.

- **Share a section:** right-click it and choose **Save as Shared Section…**, then give it a name.
- **Place another copy:** click it in the Add panel's **Shared sections** group. Or copy it and use **Paste as Linked Copy** (Ctrl+Shift+V, Cmd+Shift+V on a Mac).
- **Make one copy separate:** right-click it and choose **Detach from Shared Section**. That copy becomes an ordinary section; the others stay shared.
- **Rename or delete a shared section:** use its **…** menu in the Add panel. Deleting it leaves every copy on its page as an ordinary section.

All of these are also in **Edit › Shared Section**, for the selected section.

In Layers, linked copies show a link icon. While you edit one, a line above the page says how many copies and pages the change applies to.
