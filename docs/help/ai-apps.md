---
id: ai-apps
title: AI apps
summary: Let an AI app on this computer, such as Claude, read and change the site you have open.
related: [undo-and-history, version-history, site-check]
updated: 2026-11-08
---

# AI apps

You can let an AI app on this computer, such as Claude Desktop, work on the site you have open: ask it to rewrite a page's text, add a section or check the site. Each change it makes is a step in [Undo History](undo-and-history.md), named after the app, so you can undo it like your own.

This is off until you turn it on. When it's on, only apps on this computer that you've added can connect; nothing on the internet or on another computer can.

## Turning it on

Choose **File › AI apps…** (or search for it in **Search Commands…**) and tick **Let AI apps connect**. Untick it to cut off every app at once.

## Connecting Claude Desktop

You need Claude Desktop installed on this computer.

1. Click **Add AI app**. **Claude Desktop** is already chosen, and named so. Click **Add**.
2. {appName} shows the app's **Key**. Click **Copy the key**: you won't see it again, and it stops working if Claude Desktop doesn't use it within 5 minutes.
3. Click **Install in Claude Desktop**. Claude Desktop opens {appName}'s extension and asks whether to install it.
4. In Claude Desktop, paste the key into **Key**, and install the extension.
5. Back in {appName}, click **Done**.

Now ask Claude about your site, or ask it to make a change.

If {appName} says **Nothing opened the extension**, Claude Desktop may not be installed. Install it, then open the file {appName} shows in its folder with Claude Desktop.

If {appName} says the key wasn't used within 5 minutes, Claude Desktop was removed from your AI apps. Add it again, and install its new extension.

### If Claude can't reach your site

Claude can reach your site only while {appName} is open and **Let AI apps connect** is ticked. If Claude says {appName} isn't answering, open {appName} and check that box.

Before it sends the key, the extension checks that it really is {appName} answering. If the check fails, Claude says {appName} didn't answer as it should, and the key isn't sent. That happens when:
- you removed Claude Desktop from your AI apps: add it again, and install its new extension;
- {appName}'s address for AI apps has changed: add Claude Desktop again, and install its new extension;
- another program is answering at {appName}'s address while {appName} is closed: open {appName}, then ask Claude again.

Each new extension is a newer version of the one Claude Desktop has, so it takes the old one's place. If Claude Desktop lists both, remove the older one in its settings.

The key is cleared from the clipboard a minute after you copy it, and Windows doesn't keep it in its clipboard history.

## Your AI apps

**Your AI apps** lists each app as *Connected*, *Not connected* or *Waiting for its key*. While one is connected, an icon in the title bar says so; click it to open AI apps.

To stop an app reaching your sites, click **Remove *name*** beside it, then **Remove**. To use it again, add it again with a new key. For Claude Desktop, remove {appName}'s extension in Claude Desktop's settings too, unless you'll add it again.

If {appName} says **{appName}'s address for AI apps has changed**, another program was using {appName}'s address while it was closed. Apps that connect directly, such as Cursor or Claude Code, might have sent it their keys, so {appName} removes them: add them again with the new address. Claude Desktop checks it's {appName} before it sends its key, so it stays, but its extension has the old address: remove it and add it again, then install its new extension. {appName} says this as it starts, until you open **AI apps**.

## Starting a new site from a description

You can ask an app to start a whole new site, such as "a site for my garage, Rapidfix Vehicle Repair, in red". The app never makes the site itself. {appName} opens **Start a site** filled in with what the app chose: the kind of business, the name, what you do, a template, its pages, the colours and any contact details. It opens on the last step, so you can check each step with **Back** and change anything.

Nothing is made until you click **Create site**. The site you have open is saved first, and the new one opens in its place. Click **Cancel** and nothing is made: the app is told you said no.

An app can't start a new site while you're in [Content mode](the-editor.md#design-and-content-mode), or while you have **Start a site** or **New Site** open yourself.

### Build a site from a description

{appName} offers apps a prompt, **Build a site from a description**, which Claude Desktop lists with its other prompts. Choose it, describe your business and the site you want, and the app works in this order:
1. it starts the site with **Start a site**, for you to check and create;
2. it makes the pages, sections, text and colours as one set of changes, which you allow once (see [Many changes at once](#many-changes-at-once));
3. it runs Site Check, and asks you for your own pictures to replace the template's;
4. it opens the [Preview](preview.md) in your browser;
5. it tells you what's still yours to do: your photos, where the contact form sends messages, and publishing.

## Pictures

An app never adds a picture itself, and {appName} downloads nothing. To use your own photos, the app asks you: {appName} shows ***app* asks you to add pictures or files**, with the app's reason, such as "Photos of your workshop and team".
- Click **Add Files…** to choose them on your computer, as **Add images or files…** in [Media](media.md#adding-files) does. They're added to Media as one step in Undo History, and the app is told which you added.
- Click **Not Now**, or choose no files, and nothing is added.

A site made from a template starts with the template's pictures. Site Check's tip **Pictures from the template** lists those your pages still show, so you and the app know which to replace.

## What an app can do

An app works on the site you have open in {appName}, and only that one. It can:
- read your site's pages, settings and theme, and the sections and elements it can add, with their options;
- add, change, move and delete sections and elements, and change text;
- add, rename, move and delete pages, and change a page's title, description, **Hide from navigation** and **Hide this page from search engines**, as [Page Settings](pages.md) does;
- change your business's details in [Site Settings](site-settings.md): its name, description, language and type, web address, contact details, opening hours, social profiles and search engine settings;
- change the theme;
- see what's in [Media](media.md), and place your pictures in elements;
- ask you to add pictures or files (see [Pictures](#pictures));
- run [Site Check](site-check.md) and open the [Preview](preview.md).

It can't change publishing, forms, analytics, Custom Code, search engines' verification codes or your site's icon: those stay yours. It never adds a picture or file itself.

Some changes ask you first, with **Allow**:
- changes that reach every page: the theme, a new page with a menu entry, deleting a page, Site Settings, the Header or Footer, or a shared section;
- changing where visitors' money or details go, such as a Buy button's payment link, even on one page. Changing your web address, phone number, email address or a social profile, or whether search engines may show your site, names the old one and the new one too.

Deleting a page asks as **Delete Page** does, and says how many pages change: links to it on other pages stop working. An app can't delete the Home page or *Page not found*.

In [Content mode](the-editor.md#design-and-content-mode), an app can change text and content only, and can't start a new site. It can change your business's name, description, contact details, opening hours and social profiles, and a page's title and description. It can't add, move, rename or delete pages, hide them, or change other settings. It can still see Media and ask you for pictures.

Before an app's first change after you open your site, {appName} saves a version of it, *Before app's changes*, in [Version History](version-history.md). It saves one for each app, however often the app reconnects, until you open the site again.

### Many changes at once

For a bigger job, such as building out your pages, an app can send its changes together, with a title such as "Build the Rapidfix site". {appName} checks every change first. If any of them can't be made, nothing changes and the app is told which one. Then it asks you once, with **Allow**, and says what the changes would do. First, set apart, any change to where visitors' payments or details go, such as a Buy button's payment link, and any change to Site Settings, each from the old value to the new one. Then:
- the pages added, deleted, renamed and moved, and those whose **Page Settings** change;
- any page it hides from navigation or from search engines, or shows again, from before to after;
- whether the theme changes;
- how many sections and elements are added, changed, moved and removed;
- the other changes that would have asked on their own, such as a change to the Header.

A long list names the first ten, and counts the rest. If the question is longer than the window, it scrolls, and **Allow** and **Cancel** stay in view.

If you allow it, {appName} saves a version of your site first, *Before app's changes:* and the title, unless it saved one before a change to every page in the last five minutes. Then it makes every change as one step in Undo History, named after the title, such as **AI (Claude Desktop): Build the Rapidfix site**. One Undo takes it all back.

In Content mode, a set of changes that holds even one change Content mode doesn't allow is refused whole.

An app reads your site's content to work on it, and what it does with it is up to the app: Claude, for example, sends what it reads to Anthropic to answer you. Only add an app you trust with your site.

ChatGPT can't connect to {appName} yet.

## For developers: other AI apps

An app that connects to an MCP server at an address, such as Claude Code, Cursor or VS Code, connects to {appName} directly.

1. Click **Add AI app**, choose **Another app**, give it a **Name** such as "Cursor", and click **Add**.
2. {appName} shows an **Address** and a **Key**. Copy both with **Copy the address** and **Copy the key**. The address is `http://127.0.0.1:<port>/mcp`, on this computer only.
3. In the app's settings for MCP servers, add an HTTP (Streamable HTTP) server at that address, with this header:

   ```
   Authorization: Bearer <key>
   ```

   For Claude Code, for example:

   ```
   claude mcp add --transport http my-site http://127.0.0.1:<port>/mcp --header "Authorization: Bearer <key>"
   ```

Unlike Claude Desktop's extension, these apps can't check who answers at the address. While {appName} is closed, another program on this computer could answer there and get the key, so turn {appName}'s server off in the app while {appName} is closed.

Some things to know:
- The port is chosen once and kept, so the address stays the same each time {appName} starts.
- Requests from web pages are refused, as is any request without an added app's key.
- The key goes only in the `Authorization` header, never in the address.
- {appName} never logs what an app sends or reads, only which tool it used.
