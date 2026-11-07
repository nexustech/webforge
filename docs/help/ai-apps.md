---
id: ai-apps
title: AI apps
summary: Let an AI app on this computer, such as Claude, read and change the site you have open.
related: [undo-and-history, version-history, site-check]
updated: 2026-11-07
status: partial
---

# AI apps

You can let an AI app on this computer, such as Claude Desktop, work on the site you have open: ask it to rewrite a page's text, add a section or check the site. Each change it makes is a step in [Undo History](undo-and-history.md), named after the app, so you can undo it like your own.

This is off until you turn it on. When it's on, only apps on this computer that you've added can connect; nothing on the internet or on another computer can.

## Turning it on

Choose **File › AI apps…** (or search for it in **Search Commands…**) and tick **Let AI apps connect**. Untick it to cut off every app at once.

## Adding an app

1. Click **Add AI app**, give it a **Name** such as "Claude Desktop", and click **Add**. Its changes will be named after it.
2. {appName} shows an **Address** and a **Key**. Copy both into the app now, with **Copy the address** and **Copy the key**: you won't see the key again, and it stops working if the app doesn't use it within 5 minutes.
3. In the app's settings for MCP servers, add one at that address, with the header `Authorization: Bearer` followed by the key. Your AI app's own help says where those settings are.

The key is cleared from the clipboard a minute after you copy it.

A simpler way to connect Claude Desktop is coming in a later version.

## Your AI apps

**Your AI apps** lists each app as *Connected*, *Not connected* or *Waiting for its key*. While one is connected, an icon in the title bar says so; click it to open AI apps.

To stop an app reaching your sites, click **Remove *name*** beside it. To use it again, add it again with a new key.

## What an app can do

An app can read your site's pages, settings and theme, run [Site Check](site-check.md) and open the [Preview](preview.md). It can add, change, move and delete sections and elements, change text, add pages and change the theme.

Some changes ask you first, with **Allow**:
- changes that reach every page: the theme, a new page with a menu entry, the Header or Footer, or a shared section;
- changing where visitors' money or details go, such as a Buy button's payment link, even on one page.

Before an app's first change, {appName} saves a version of your site, *Before app's changes*, in [Version History](version-history.md).
