---
id: site-check
title: Site Check
summary: What Site Check looks for, what each finding means, and how to fix it.
related: [export, pages, media, forms, site-settings]
updated: 2026-11-06
---

# Site Check

**Site Check** looks over your whole site as you work and lists anything to fix before your website goes live. It's in the bottom panel; show or hide it with Ctrl+J (Cmd+J on a Mac).

Findings come in three kinds:
- **Must fix:** your website won't work properly. Export waits until these are fixed.
- **Should fix:** visitors or search engines will notice.
- **Tips:** worth doing when you have a moment.

Each check shows a dot: green when all is well, amber or red when something needs a look. Click a finding to go to the page and item it's about. Some findings have a **Fix** button that does it for you. You can **Ignore** anything except a Must fix; **Show ignored items again** brings ignored ones back.

## Must fix

| Check | What it means | What to do |
|---|---|---|
| **Page names** | A page's file name is one Windows keeps for itself, such as `con` | **Fix** renames it |
| **Home page** | The site has no home page | Choose one with a page's **Set as Home Page** |
| **Files from other websites** | Your code loads a file from another website, so your site won't work without it | **Download and Bundle** keeps a copy with your site, or, in Advanced mode, allow the address in Custom Code |

## Should fix

| Check | What it means | What to do |
|---|---|---|
| **Broken links** | A link goes to a page or file that's been deleted | Change or remove the link |
| **Placeholder text** | Some of the template's sample text is still there | Replace it with your own |
| **Page titles** | A page has no title | **Fix** uses the page's first heading |
| **Forms** | A form has nowhere to send messages | **Fix** opens Site Settings › Forms. See [Forms](forms.md) |
| **Missing images** | A picture was deleted from Media but is still placed on a page | Choose another picture, or remove it |
| **Alt text** | A picture has no description for people who can't see it | Add **Alt text** in [Media](media.md) |
| **Colour contrast** | Some text is hard to read on its background | Choose a darker or lighter colour |
| **Large images** | A picture is over 4000 pixels wide or tall | Use a smaller copy: it loads faster |

## Tips

| Check | What it means |
|---|---|
| **Large downloads** | A linked document is over 10 MB, which is slow to download on a phone |
| **Underlined text** | Underlined text that isn't a link, which visitors may try to click |

## Being found

This group is about helping people find your site through search engines. Each finding is marked Must fix, Should fix or Tip.

| Check | What it means | What to do |
|---|---|---|
| **Web address** | Your site has no web address, so it has no sitemap and no picture when shared | **Fix** opens Site Settings › Web address |
| **Search engines** | Your site is hidden from search engines | **Fix** opens Site Settings › Search engines |
| **Page descriptions** | A page has no description, so search engines pick words from it | **Fix** opens [Page Settings](pages.md#page-settings) |
| **Different titles** | Two pages have the same title, so search results can't tell them apart | Give each page its own title |
| **Different descriptions** | Two pages have the same description | Give each page its own |
| **Main heading** | A page has no main heading, or more than one | Keep one Large heading, or a Hero, per page |
| **Business details** | Your address, phone number or opening hours are missing | **Fix** opens Site Settings › Contact & hours |
| **Google Business Profile** | A reminder to set up your free Google listing, which matters most for local businesses | Click **Done** once you have |
| **Google Search Console** | A reminder to check how people find your site on Google | **Fix** opens Site Settings › Search engines to paste its code. Click **Done** once you have |
