---
id: publish
title: Publish
summary: Put your website on your web host or on Netlify, and update it with one click whenever you change something.
related: [export, site-check, site-settings, version-history]
updated: 2026-11-08
---

# Publish

**Publish** puts your website on your web host, or on Netlify, for you, and after that sends only what changed. Where it goes is called a **publish destination**: your web host's address, your user name and the folder it serves, or your Netlify site. Set it up once, then publish with one click.

Click **Publish** in the title bar, choose **File › Publish…**, or press Ctrl+U (Cmd+U on a Mac) when you're not typing text.

## Adding your web host

Click **Add Destination**, choose **FTP, FTPS or SFTP…**, then fill in the details from your web host's control panel:
- **Name:** anything that helps you recognise it. Leave it empty to use the host's name.
- **Control panel:** *cPanel* or *Plesk* fills in the usual settings for you. If you're not sure, choose *Another, or I don't know*.
- **Connection:**
  - *FTPS (encrypted)* or *SFTP (encrypted)*: use one of these if your host offers it.
  - *FTP (not encrypted)*: sends your password unprotected, so {appName} asks you to confirm.
- **Host**, such as `ftp.example.com`, and the **Port**. Leave the port empty for the usual one.
- **User name**, and sign in with **A password** or, for SFTP, **A private key file**.
- **Folder:** the folder your host serves your website from, such as `/public_html`.
- **Web address:** your site's address. If Site Settings has none yet, {appName} fills it in there too.

The first time you test or save an SFTP destination, {appName} shows the host's key and asks you to confirm it's your host.

## Adding Netlify

[Netlify](https://www.netlify.com) hosts websites for you, and has a free plan. Click **Add Destination**, choose **Netlify…**, then:
1. **Sign in to Netlify.** Make a *personal access token* on Netlify (in **User settings › Applications › Personal access tokens**), paste it into **Personal access token**, and click **Connect**. Where it's offered, **Sign In with Netlify** opens Netlify in your browser instead: approve {appName} there, then come back.
2. **Choose the Netlify site** to publish to, or **A new site**. A new site's name becomes part of its address, such as `rosas-bakery.netlify.app`. Leave it empty and Netlify makes one up.
3. **Name** it if you like, then click **Save Destination**. If Site Settings has no web address yet, {appName} fills in the Netlify site's.

If the site you choose has Netlify's **visitor access** turned on, {appName} warns you: visitors are asked to log in to Netlify instead of seeing your site. Turn it off in the site's settings on Netlify if your site is for everyone.

Once your site has a Netlify destination, [forms](forms.md) can send their messages with **Netlify Forms**.

## Publishing

Click **Publish** beside a destination. {appName}:
1. Runs [Site Check](site-check.md). If anything is *Must fix*, nothing is sent: Site Check opens to show what to fix first.
2. Builds your site, compares it with what's on your host, and sends only new and changed files. A notice shows how far it's got; **Cancel** stops it before the next file, and your live site keeps working.
3. Removes files your site no longer has. It only ever removes files it published itself, so anything else on your host is left alone.

If the folder already has another site that {appName} published, it asks before replacing it.

When it's done, **Your site is live** says where visitors can see it, and how many files were sent, unchanged and removed. **Open Site** opens it in your browser and **Copy Link** copies its address. A new site can take a few minutes to appear.

Each publish is kept in [Version History](version-history.md) as *Published*. To put an earlier version back on your host, use its **Republish…** there: see [Publishing an earlier version](version-history.md#publishing-an-earlier-version).

Where your text uses `{year}`, your published site shows the year you published it in. In a new year, [Site Check](site-check.md#tips) reminds you to publish again.

### If publishing doesn't work

{appName} says what went wrong and what to do, such as checking the user name, password or folder in **Edit**, or publishing again once your internet connection is back. Publishing again sends whatever didn't arrive.

## Testing, changing and removing

Each destination has:
- **Publish**.
- **Test Connection:** says whether {appName} can sign in and reach the folder, or what's wrong.
- **Edit**.
- **Remove:** {appName} forgets the destination and its password. Nothing on your host changes.

A site can have up to 20 destinations.

## Your passwords

Passwords, and Netlify sign-ins, are kept safe by your computer's own password store, never in your site's file. **Publish** and **Test Connection** wait until the destination's password is saved on this computer. So they don't travel with a copy of your site, and you'll type them again on another computer.
