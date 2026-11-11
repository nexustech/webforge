---

id: find-and-replace
title: Find and Replace
summary: Find text anywhere on your site and change it everywhere at once, or one place at a time.
related: [editing-on-the-page, header-and-footer, pages, blog, site-settings, undo-and-history]
updated: 2026-11-11
---

# Find and Replace

**Find and Replace** finds a word or phrase wherever you've written it on your site, and changes it for you: everywhere at once, or one place at a time. It's handy when a name, a price or a phone number in your text changes.

Open it with **Edit › Find and Replace…**, or Ctrl+F (Cmd+F on a Mac). It opens in the bottom panel, with the cursor in **Find**.

## What it looks through

- the text on every page: headings, paragraphs, buttons, captions, questions and answers, and the rest;
- each page's **Title**, its **Name in the menu** and its **Description** (from Page Settings);
- the Header and the Footer;
- the menu's own labels: a page's when you've renamed it in the menu, and each link, section link, button and dropdown;
- shared sections, once each, however many pages show them;
- your [blog](blog.md)'s design, once, however many posts show it;
- the business details in Site Settings: **Site name**, **Description**, **Business name**, **Address** and **Note on opening hours**.

Hidden elements are searched too.

It leaves alone what a change could break: web addresses (such as a video's link), the email address and phone number in Site Settings, payment links and newsletter form settings. Text that shows a Site Settings value, such as a heading showing your business name, is found in Site Settings instead: change it there and every place showing it changes. Text in the blog's design that shows a post's title, date or summary is found in each post instead.

## Finding

Type what you're looking for in **Find**. The list shows every match, grouped by page, then the Header, the Footer, the menu, each shared section, the blog's design and Site Settings, with the words around it. At the top, it says how many it found and in how many places.

- **Match case** finds only text with the same capital letters: "Smith" but not "smith".
- **Whole words** finds only whole words: "Smith" but not "Smithson".

Click a match to go to it: {appName} shows its page and selects the element. For a page's title or description, it opens that page's **Page Settings**; for a name in the menu or a menu item, the Pages panel; for a business detail, **Site Settings**.

The list follows your changes as you work.

## Replacing

Type the new text in **Replace with**, then:

- **Replace**, beside a match, changes that one match only;
- **Replace All** changes every match on the list.

When **Replace All** changes more than one page, {appName} asks first, says how many pages will change, and saves a version of your site before it does.

Either way, it's one step in [Undo History](undo-and-history.md), named after the change ("Replaced 'Smith' with 'Smyth' in 4 places"), so **Undo** puts everything back at once.

A few things to know:

- In formatted text, a word whose letters are formatted differently, such as "Sm**ith**", isn't found. The formatting and links around a match stay as they are.
- A page's title and your site's name are never left empty: if replacing would empty them, they're skipped. So is a change that would make a field longer than it can be.
