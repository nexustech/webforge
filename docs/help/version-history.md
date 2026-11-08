---
id: version-history
title: Version History
summary: Save a version of your whole site, and go back to it, preview it, publish it again or open it as a new site.
related: [undo-and-history, saving-and-backups, publish, settings]
updated: 2026-11-08
---

# Version History

A **version** is a copy of your whole site as it was at one moment: every page, picture and setting. Save one before a big change, and you can always go back to it, even after closing {appName}. Versions are kept inside your site's file.

[Undo](undo-and-history.md) takes back your last few steps since you opened the site. Version History goes back further, to any version you or {appName} saved.

## Opening Version History

**Version History** is a tab in the left column, beside **Add** and **Undo History**. It lists the site's versions, newest first, each with its name, when it was saved and a small picture of the page. A version that has been [published](publish.md) also says where and when it last was, such as "Published to My host, 7 Nov 2026, 09:15".

## Saving a version

Choose **File › Save Version…**, press Ctrl+Alt+S (Cmd+Alt+S on a Mac), or click **Save Version…** at the top of the panel. Give it a **Version name** that says what it was, such as "Before the new menu", and click **Save Version**. Without a name it's listed as *Untitled version*.

Versions you save yourself are always kept, until you delete them.

## Versions {appName} saves for you

{appName} also saves a version, marked *Saved by {appName}*:
- **Start of the day:** before your first change on each day you edit the site.
- **Before:** before a change that reaches every page, such as deleting a page, named after it ("Before: Delete Page"). At most one every five minutes.
- **Before theme changes:** before you first change the theme.
- **Before a restore:** before you go back to another version.
- **Published:** the site as it was when you [published](publish.md) it.
- **Before *app*'s changes:** before an [AI app](ai-apps.md) first changes your site after you open it, and when you allow an app's [many changes at once](ai-apps.md#many-changes-at-once), named after them.

{appName} keeps the last 20 of these for each site and deletes older ones. Change how many in **Settings › Version History › Versions kept**, from 5 to 100. The version your live site came from is always kept: the newest *Published* one, and any version you published again since.

## What you can do with a version

Click **…** beside a version:
- **Preview:** opens the version in your browser, as it was. You can look but not change it, and the site you're editing doesn't change.
- **Restore…:** every page goes back to how it was then. {appName} asks first, and saves a version of the site as it is now before it restores. The restore is one step you can [undo](undo-and-history.md).
- **Republish…:** puts the version on your web host again, in place of what's there, without changing the site you're editing. See [Publishing an earlier version](#publishing-an-earlier-version).
- **Open as New Site…:** saves the version as a separate site, with its own file, and opens it. Its publish destinations aren't copied.
- **Delete…:** deletes the version, after asking. This can't be undone, but your site itself doesn't change.

## Publishing an earlier version

If something went wrong on your live site, you can put an earlier version back there while you fix the site.

Click **…** beside the version, then **Republish…**. Your [publish destinations](publish.md) open: click **Republish** beside the one to publish it to. {appName} checks the version as it [checks a publish](publish.md#publishing), then sends it. When it's done, **Your site is live**, and the version says where and when it was published.

On Netlify, a version published there before goes back as it was: Netlify keeps your earlier publishes, so {appName} asks it to put that one back, and nothing needs sending. If Netlify no longer has it, {appName} sends the version as usual.

A version with anything [Site Check](site-check.md) says to fix before publishing, such as a script from another website, can't be republished. {appName} says how many things to fix: restore the version, fix them in Site Check, then publish.

## Space used

The bottom of the panel shows how much space versions use. **Clean Up** removes what nothing in your site, its versions or Undo needs any more, and gives that space back to your computer. Undo still works afterwards.
