---

id: ai-apps
title: AI apps
summary: Let an AI app on this computer, such as Claude, read and change the site you have open.
related: [undo-and-history, version-history, site-check]
updated: 2026-11-24
---

# AI apps

You can let an AI app on this computer, such as Claude Desktop, work on the site you have open: ask it to rewrite a page's text, add a section or check the site. Each change it makes is a step in [Undo History](undo-and-history.md), named after the app, so you can undo it like your own.

This is off until you turn it on. When it's on, only apps on this computer that you've added can connect; nothing on the internet or on another computer can.

## Turning it on

Choose **File › AI Apps…** (or search for it in **Search Commands…**, or choose **Open AI Apps…** in [Settings](settings.md#ai-apps)) and tick **Let AI apps connect**. Untick it to cut off every app at once.

## Connecting Claude Desktop

You need Claude Desktop installed on this computer.

1. Click **Add AI App**. **Claude Desktop** is already chosen, and named so. Click **Add**.
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

**Your AI apps** lists each app as _Connected_, _Not connected_ or _Waiting for its key_. While one is connected, an icon in the title bar says so; click it to open AI apps.

To stop an app reaching your sites, click **Remove _name_** beside it, then **Remove**. To use it again, add it again with a new key. For Claude Desktop, remove {appName}'s extension in Claude Desktop's settings too, unless you'll add it again.

If {appName} says **{appName}'s address for AI apps has changed**, another program was using {appName}'s address while it was closed. Apps that connect directly, such as Cursor or Claude Code, might have sent it their keys, so {appName} removes them: add them again with the new address. Claude Desktop checks it's {appName} before it sends its key, so it stays, but its extension has the old address: remove it and add it again, then install its new extension. {appName} says this as it starts, until you open **AI Apps**.

## Starting a new site from a description

You can ask an app to start a whole new site, such as "a site for my garage, Rapidfix Vehicle Repair, in red". The app never makes the site itself. {appName} opens **Start a Site** filled in with what the app chose: the kind of business, the name, what you do, a template, its pages, the colours and any contact details. It opens on the last step, so you can check each step with **Back** and change anything.

Nothing is made until you click **Create Site**. The site you have open is saved first, and the new one opens in its place. Click **Cancel** and nothing is made: the app is told you said no.

An app can't start a new site while you're in [Content mode](the-editor.md#design-and-content-mode), or while you have **Start a Site** or **New Site** open yourself.

### Build a site from a description

{appName} offers apps a prompt, **Build a site from a description**, which Claude Desktop lists with its other prompts. Choose it, describe your business and the site you want, and the app works in this order:

1. it starts the site with **Start a Site**, for you to check and create;
2. it makes the pages, sections, text and colours as one set of changes, which you allow once (see [Many changes at once](#many-changes-at-once));
3. it runs Site Check, and asks you for your own pictures to replace the template's;
4. it opens the [Preview](preview.md) in your browser;
5. it tells you what's still yours to do: your photos, where the contact form sends messages, and publishing.

## Pictures

An app never adds a picture itself, and {appName} downloads nothing. To use your own photos, the app asks you: {appName} shows **_app_ asks you to add pictures or files**, with the app's reason, such as "Photos of your workshop and team".

- Click **Add Files…** to choose them on your computer, as **Add Images or Files…** in [Media](media.md#adding-files) does. They're added to Media as one step in Undo History, and the app is told which you added.
- Click **Not Now**, or choose no files, and nothing is added.

Take as long as you need to choose: the app waits. If you're still choosing after about 45 seconds, the app is told you are, and it asks again a little later for what you added. While you choose, it can't ask you for more files. If you leave the question itself unanswered for a minute, it closes, and nothing is added.

A site made from a template starts with the template's pictures. Site Check's tip **Pictures from the template** lists those your pages still show, so you and the app know which to replace.

## What an app can do

An app works on the site you have open in {appName}, and only that one. It can:

- read your site's pages, settings and theme, and the sections and elements it can add, with their options;
- add, change, move and delete sections and elements, and change text;
- add, rename, move and delete pages, and change a page's title, description, **Hide in menu** and **Hide this page from search engines**, as [Page Settings](pages.md) does. When an app renames a page of a site you've published, the page's old address keeps working, as **Rename…** does, in the same step: see [Keeping old addresses working](pages.md#keeping-old-addresses-working);
- change your business's details in [Site Settings](site-settings.md): its name, description, language and type, web address, contact details, opening hours, social profiles and search engine settings;
- change the theme, all of it or one part, such as the line spacing of your headings;
- see what's in [Media](media.md), and place your pictures in elements. It can see which picture is your logo, and a picture's main colours, which {appName} works out on your computer, to match the theme to your logo. It never sees the picture itself;
- ask you to add pictures or files (see [Pictures](#pictures));
- run [Site Check](site-check.md), and open the [Preview](preview.md) in your browser. The app is told the page's address, which works on this computer only, so it can look at its work: how the page looks at desktop and phone widths, and whether its pictures show. It sees the Preview only when it opens it in your browser, so you see it too.

It can't change publishing, forms, analytics, Custom Code, search engines' verification codes, your logo or your site's icon: those stay yours. It never adds a picture or file itself.

### Examples, never made-up facts

An AI never passes off a made-up fact as yours. If it needs one you didn't give, such as a price, an opening time or a phone number, it writes an example, and {appName} marks that text as one. {appName} also marks any text that holds such a detail it can't find in what you told it, in [Site Settings](site-settings.md) or elsewhere on your site, whether the AI said so or not. A testimonial an AI writes is always an example. [Site Check](site-check.md)'s **Examples to check** lists each, and publishing waits until you've edited it or clicked **This Is Correct**. On the page, an example has a dotted violet outline and an **Example** chip (see [Examples](editing-on-the-page.md#examples)).

Some changes ask you first, with **Allow**:

- changes that reach every page: the theme, a new page with a menu entry, deleting a page, Site Settings, the Header or Footer, or a shared section;
- changing where visitors' money or details go, such as a Buy button's payment link, even on one page, though not a link to one of your own pages that replaces no web address, email address or phone number. The question names the element, such as the plan by its name, and where the link goes now and would go: a web address, or one of your pages, files or lists by its name. Changing your web address, phone number, email address or a social profile, or whether search engines may show your site, names the old one and the new one too.

Deleting a page asks as **Delete Page** does, and says how many pages change: links to it on other pages stop working. An app can't delete the Home page or _Page not found_.

The question waits for your answer, however long you're away: walking away isn't a no. **Allow** makes the change when you come back. If you haven't answered within about 45 seconds, the app is told the change is waiting, with a number it can ask about later, so it can find out whether you allowed it without asking you to look. If it sends the same change again meanwhile, it isn't made twice. Until then, it waits to send other changes. If the app gives up within those 45 seconds, or you close the site, the question closes and nothing changes. Only **Cancel** is a no, and after one the app waits a little before it asks you again.

In [Content mode](the-editor.md#design-and-content-mode), an app can change text and content only, and can't start a new site. It can change your business's name, description, contact details, opening hours and social profiles, and a page's title and description. It can't add, move, rename or delete pages, hide them, or change other settings. It can still see Media and ask you for pictures.

Before an app's first change after you open your site, {appName} saves a version of it, _Before app's changes_, in [Version History](version-history.md). It saves one for each app, however often the app reconnects, until you open the site again.

### Working without asking

To let an app get on while you're away, let it work without asking. It then makes changes that reach every page, such as the theme, a new page in the menu or the Header, without a question. Either:

- in its question, click **Allow, and Don't Ask Again for an Hour**; or
- in **AI Apps**, under the app, choose how long in **Work without asking**: 30 minutes, an hour, 2 hours or 4 hours.

It lasts for the site you have open, and ends when you close the site, when the time runs out, or when you choose **No, ask first**. Opening the site again asks again. {appName} keeps the setting itself: it isn't saved with your site, and the app can't turn it on.

While an app works without asking, the AI apps icon in the title bar changes to a lightning bolt, and says which app. Each change is still a step in [Undo History](undo-and-history.md), named after the app, and the version _Before app's changes_ is still saved first.

Some changes ask whatever you chose:

- changing where visitors' money or details go, such as a Buy button's payment link or a form's address. A link to one of your own pages, or a section on one, doesn't ask, unless it replaces a web address, email address or phone number, such as a payment link;
- changing your web address, phone number, email address or a social profile, or whether search engines may show your site;
- starting a new site.

In Content mode, an app still can't change what Content mode doesn't allow.

### While you were away

When you come back to {appName} after an app has worked without asking, **While You Were Away** shows what it changed while you were gone, app by app and page by page. Changes that reach every page, such as the theme, are listed under **Every page**.

- Click **Show** and a page's name to go to that page.
- **Undo All of** the app's **Changes** puts your site back as it was before the first of those changes, from the last version [Version History](version-history.md) saved before it. Any other change made since is taken back too, so another app's changes listed after it go from the list. It's one step in [Undo History](undo-and-history.md), so **Undo** brings the changes back, and {appName} saves your site as it was just before, in Version History.
- **Keep** closes it, and keeps the changes.

It shows only what an app changed without asking while {appName} wasn't the window in front.

### Many changes at once

For a bigger job, such as building out your pages, an app can send its changes together, with a title such as "Build the Rapidfix site". {appName} checks every change first. If any of them can't be made, nothing changes and the app is told which one. Then it asks you once, with **Allow**, and says what the changes would do. First, set apart, any change to where visitors' payments or details go, such as a Buy button's payment link, and any change to Site Settings, each from the old value to the new one. Then:

- the pages added, deleted, renamed and moved, and those whose **Page Settings** change;
- any page it hides in the menu or from search engines, or shows again, from before to after;
- whether the theme changes;
- how many sections and elements are added, changed, moved and removed;
- the other changes that would have asked on their own, such as a change to the Header.

A long list names the first ten, and counts the rest. If the question is longer than the window, it scrolls, and **Allow** and **Cancel** stay in view.

If you allow it, {appName} saves a version of your site first, _Before app's changes:_ and the title, unless it saved one before a change to every page in the last five minutes. Then it makes every change as one step in Undo History, named after the title, such as **AI (Claude Desktop): Build the Rapidfix site**. One Undo takes it all back.

In Content mode, a set of changes that holds even one change Content mode doesn't allow is refused whole.

An app reads your site's content to work on it, and what it does with it is up to the app: Claude, for example, sends what it reads to Anthropic to answer you. Only add an app you trust with your site.

ChatGPT can't connect to {appName} yet.

## For developers: Claude Code, VS Code and other apps

Developer tools connect to {appName} directly, at an address on this computer: `http://127.0.0.1:<port>/mcp`. **Add AI App** sets up Claude Code and VS Code for you, and shows the address for any other app.

Unlike Claude Desktop's extension, these tools can't check who answers at the address. While {appName} is closed, another program on this computer could answer there and get the key. So turn {appName}'s server off in the tool while {appName} is closed: in Claude Code, with `/mcp`; in VS Code, with **MCP: List Servers** › **webforge** › **Stop Server**.

### Claude Code

You need [Claude Code](https://code.claude.com/docs/en/setup) installed.

1. Click **Add AI App**, choose **Claude Code**, and click **Add**. {appName} shows three steps, each with what it copies, and the commands for your computer's terminal. On Windows the steps say PowerShell: run them there, not in Command Prompt, which splits the add command at its spaces.
2. **Add {appName} to Claude Code:** click **Copy the add command**, and run it in a terminal (Bash or Zsh), or in PowerShell on Windows. It adds {appName}'s server, named `webforge`, to Claude Code for all your projects:

   ```
   claude mcp add --transport http --scope user webforge http://127.0.0.1:<port>/mcp --header 'Authorization: Bearer ${WEBFORGE_KEY}'
   ```

   The key isn't in it. Claude Code reads it from `WEBFORGE_KEY` each time it connects, so the key isn't in your terminal's history or in Claude Code's settings.
3. **Give that terminal the key:** in the same terminal (the same PowerShell window on Windows), click **Copy the key command** and run it. Then click **Copy the key**, paste it when the terminal waits for it, and press Return (Enter on Windows). The key doesn't show as you paste it, and it isn't typed on the command line. {appName} shows the command for your computer:
   - On a Mac or Linux:

     ```
     read -rs WEBFORGE_KEY && export WEBFORGE_KEY
     ```

   - In Windows PowerShell:

     ```
     $env:WEBFORGE_KEY = [Net.NetworkCredential]::new('', (Read-Host 'Key' -AsSecureString)).Password
     ```

4. **Start Claude Code** in that terminal (that PowerShell window on Windows) before the key runs out: {appName} shows how long it has left, from 5 minutes. When Claude Code connects, {appName} says so, without you closing anything, and in Claude Code `/mcp` lists `webforge` as connected. Then click **Done**.

If the key runs out first, {appName} says so and removes Claude Code: add it again for a new key.

`WEBFORGE_KEY` lasts as long as that terminal: set it again in each new one. If you keep it in your shell's profile instead, the key is in that file as plain text.

If Claude Code says a server named `webforge` already exists, from an earlier time you added it, remove that one first with `claude mcp remove --scope user webforge`, then run the command again.

### VS Code (GitHub Copilot)

You need VS Code with GitHub Copilot, whose agent mode uses {appName}'s tools.

1. Click **Add AI App**, choose **VS Code (GitHub Copilot)**, and click **Add**.
2. Click **Copy the key**.
3. Click **Install in VS Code**. VS Code shows {appName}'s server, named `webforge`: click **Install**.
4. When VS Code starts the server, it asks for {appName}'s key: paste it. VS Code keeps it in its own secret storage, not in its settings. If it doesn't start the server itself, choose **MCP: List Servers** › **webforge** › **Start Server** within 5 minutes of adding it.
5. Back in {appName}, click **Done**. In Copilot Chat, choose **Agent**, and ask about your site.

If {appName} says **VS Code didn't open**, VS Code may not be installed. Install it, then click **Install in VS Code** again.

If VS Code already has a server named `webforge`, from an earlier time you added it, remove that one first: **MCP: List Servers** › **webforge** › **Uninstall**.

### Other apps

1. Click **Add AI App**, choose **Another app**, give it a **Name** such as "Cursor", and click **Add**.
2. {appName} shows an **Address** and a **Key**. Copy both with **Copy the address** and **Copy the key**.
3. In the app's settings for MCP servers, add an HTTP (Streamable HTTP) server at that address, with this header:

   ```
   Authorization: Bearer <key>
   ```

Some things to know:

- The port is chosen once and kept, so the address stays the same each time {appName} starts.
- Requests from web pages are refused, as is any request without an added app's key.
- The key goes only in the `Authorization` header, never in the address.
- {appName} never logs what an app sends or reads, only which tool it used.
