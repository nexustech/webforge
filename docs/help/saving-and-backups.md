---

id: saving-and-backups
title: Saving, copies and backups
summary: How {appName} saves your work, how to copy a site to another computer, and what happens if something goes wrong.
related: [version-history, undo-and-history, export, getting-started]
updated: 2026-11-21
---

# Saving, copies and backups

## Your site's file

Each site is one file, ending `.wforge`, wherever you chose to save it. Its pages, pictures, documents and settings are all inside. Double-click it to open the site in {appName}.

## Saving

{appName} saves as you work, so there's no Save button. It saves a moment after you stop typing, and when you switch page, switch to another program or close the window. Press Ctrl+S (Cmd+S on a Mac) to save at once.

The title bar shows **Saved**, **Saving…**, or **Not saved. {appName} will try again.**

## Opening sites

- **File › Open Site…** (Ctrl+O) opens a site's file.
- **File › Open Recent** lists the last five sites you opened. **Clear Recent** empties the list but keeps pinned sites; it never deletes a site.
- Opening another site saves the one that's open first.

## Versions

To keep your site as it is before a big change, and go back to it later, save a version: **File › Save Version…** (Ctrl+Alt+S). {appName} saves some by itself too, such as one at the start of each day you edit. See [Version History](version-history.md).

## A copy of your site as a ZIP file

**File › Save a Copy as ZIP…** saves your whole site, with its pictures, versions and settings, as one ZIP file. Use it to keep a backup somewhere safe, or to move the site to another computer. Passwords for publishing don't go in it.

**File › Open Site from ZIP…** opens such a ZIP again. {appName} asks where to save it as a new site.

This isn't your website: to make that, see [Export](export.md).

## Backups

Backups are for when your site's file is damaged; to go back to an earlier state of your site, use [Version History](version-history.md). While you work, {appName} keeps backups of your site's file on this computer: one when you open the site, then one every half hour while you edit. It keeps the last five.

If your site's file is ever damaged (for example by a sync service such as OneDrive or Dropbox), {appName} says so when you open it, and offers:

- **Restore Latest Backup**;
- **Choose a Backup…**.

The damaged file is kept beside the restored one, so nothing is lost.

## If {appName} closes unexpectedly

Your work is saved as you go, so it's still there when you open {appName} again. {appName} also saves a crash report on your computer. It contains none of your site's content or personal details, and it's never sent anywhere.

## Reporting a problem

If something goes wrong, tell us: choose **Help › Report a Problem…**. {appName} sends nothing itself. You see everything in your report first, and send it yourself.

1. Write what happened: what you did, what you expected, and what happened instead. Under it, {appName} shows what's sent with your message: its version and your computer's system, such as _Windows 10.0.26300 (x64)_. Nothing of your site goes with it.
2. To show the problem, click **Take a Screenshot of This Window**. It's a picture of {appName}'s window only, without the dialog, and it's taken only when you click. Click **Save Screenshot…** to save it as a file, then attach it to your report.
3. Click **Open a GitHub Issue**: your browser opens our report form with your message, the version and your system filled in, for you to send. Or click **Copy My Message** to paste it into a message of your own. A very long message is cut short to fit the form: {appName} says so, and you paste the rest in from **Copy My Message**.

A GitHub issue is public: anyone can read it, and you need a GitHub account to send one. Leave out personal details, such as a customer's name or address, and don't attach a screenshot that shows them.

Your message is kept, even if you close the dialog or {appName}, until you click **Clear Message**. If {appName} has closed unexpectedly, you can attach a crash report too: see below.

## Sharing a crash report

Crash reports stay on your computer: {appName} never sends one. You choose whether to share one, for example when someone helping you asks for it.

1. Choose **Help › Open Crash Reports Folder**. The folder opens on your computer.
2. Find the newest report. Each one's name starts with `crash-` and then the date and time, such as `crash-20261109-153000-main.json`.
3. Attach that file to your message or report, or drag it in.

A report says which version of {appName} you have, what kind of computer it runs on, and where in {appName} the problem happened. It has no words or pictures from your sites, no file names from your computer, and nothing about you. It's a text file, so you can open it to see for yourself.

{appName} keeps the last 20 reports for up to 30 days, and deletes older ones by itself.

## What {appName} counts on your computer

{appName} also keeps a usage summary on your computer, beside the crash reports: how often you use its parts, what went wrong and how long things took. For example, how many sites you started, how many times you exported, and which kinds of sections you added. It holds only counts, times and the names {appName} gives its own parts, so none of your words, pictures, file names or web addresses can be in it, and nothing about you.

{appName} never sends it. It helps the people testing {appName} tell us what to improve, if they choose to send it with their report.
