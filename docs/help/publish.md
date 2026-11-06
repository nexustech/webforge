---
id: publish
title: Publish
summary: Set up where {appName} puts your website on the internet.
related: [export, site-check, site-settings]
updated: 2026-11-06
status: partial
---

# Publish

**Publish** will put your website on your web host for you, and update only what changed each time. Today you can set up and test where it goes, called a **publish destination**. Publishing itself is coming in a later version. Until then, [export](export.md) your site and upload it with your host's own tools.

Click **Publish** in the title bar, choose **File › Publish…**, or press Ctrl+U (Cmd+U on a Mac) when you're not typing text.

## Adding your web host

Click **Add Destination**, then fill in the details from your web host's control panel:
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

## Testing, changing and removing

Each destination has:
- **Test Connection:** says whether {appName} can sign in and reach the folder, or what's wrong.
- **Edit**.
- **Remove:** {appName} forgets the destination and its password. Nothing on your host changes.

A site can have up to 20 destinations.

## Your passwords

Passwords are kept safe by your computer's own password store, never in your site's file. So they don't travel with a copy of your site, and you'll type them again on another computer.
