---

id: export
title: Export
summary: Save your website as files, or one ZIP file, to put on any web host.
related: [publish, site-check, preview, site-settings, saving-and-backups]
updated: 2026-11-06
---

# Export

**Export** saves your website as a folder of files, or a single ZIP file, that you can upload to any web host. You can also open the files straight from your computer. The website loads nothing from anywhere else, so it works anywhere.

Click **Export** in the title bar, choose **File › Export Site…**, or press Ctrl+E (Cmd+E on a Mac).

## What happens

1. If your site contains code that came from somewhere else, {appName} asks whether to keep it. See [Custom Code](custom-code.md#code-from-somewhere-else).
2. If [Site Check](site-check.md) has anything under **Must fix**, {appName} stops and shows it. Fix those first.
3. If your site has no web address yet, {appName} offers to add one. You can export without it, but search engines and shared links work better with one.
4. Choose how to save it:
   - **Save as:** _A folder_, or _A ZIP file_. A ZIP file is one file, easy to email or upload.
   - **Make the files smaller:** leaves out spacing and comments, so pages load a little faster but are harder for a person to read.
5. Choose where to save it. You can keep working while {appName} builds your site.

When it's done, {appName} shows how many pages and files it made. It also lists anything **worth a look**, such as a broken link or a form with nowhere to send. For a folder, click **Open Site** to see it in your browser; for a ZIP file, **Show ZIP File** shows where it was saved.

## Exporting again

Export into the same folder to update it. {appName} only writes into an empty folder or one it exported before (with no other files added since), so it never mixes your site with other files. If something goes wrong part-way, the previous export stays as it was.

## What's in it

- An `.html` file for each page. The Home page is `index.html`, and the Page not found page is `404.html`.
- Your pictures, in sizes for every screen, and the documents your pages link to.
- Your theme's styles and fonts.
- The files search engines and browsers look for: `robots.txt`; a sitemap (when the site has a web address and lets search engines show it); your site icon in every size.
- With **Help AI tools read your site** on, `llms.txt` and a plain-text copy of each page.

Hidden sections and elements are left out, and so are pictures and documents that no page uses. Your site's file, its versions and your passwords never go into an export.

In Advanced mode, **Include developer files** adds a `developer` folder with the source of your site's styles, its theme and a README, for a web developer.

## Not the same as a copy of your site

Export makes your **website**. To save a copy of your **site** itself, to open again in {appName} or on another computer, use **File › Save a Copy as ZIP…**. See [Saving, copies and backups](saving-and-backups.md).
