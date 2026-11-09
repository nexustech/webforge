---

id: custom-code
title: Custom Code
summary: Add your own HTML, CSS or JavaScript, and what {appName} asks when code comes from somewhere else.
components: [CustomCode]
related: [elements, site-settings, edit-panel, export]
updated: 2026-11-06
---

# Custom Code

Most sites never need code. When you do (for a widget a booking service gave you, say, or a style {appName} doesn't offer), Advanced mode lets you add your own. Turn it on with **View › Use Advanced Mode**.

Your code goes into your website exactly as you write it. {appName} can't check it, so a mistake in it can break your pages.

## The Custom Code element

The **Custom Code** element, in the Add panel's **Advanced** group, places your own HTML on a page, wherever you put it. The editor shows the HTML without its scripts, styles or anything from the web; your website runs them. Use [Preview](preview.md) to see it working.

## Code for every page

**File › Settings…**, then **Custom Code** under _This site_ (or **Custom Code…** in Search Commands), holds code for the whole site. It's there in Advanced mode, or once the site has code:

- **Stylesheet (custom.css):** CSS of your own.
- **Script (custom.js):** JavaScript of your own. It never runs in the editor.
- **HTML in every page's head**, and **HTML at the end of every page**.
- **Allowed outside addresses:** your website loads nothing from other websites, so it works from any folder or host. If your code must load a file from another website, add that website's `https://` address here. Otherwise [Site Check](site-check.md) lists the file as a Must fix, and can keep a copy of it with your site instead.

## Code from somewhere else

Code runs for everyone who visits your website. Before you preview or export a site whose code was written somewhere other than in {appName} on this computer, {appName} asks first. That includes code in a site someone sent you, or code you pasted in. It lists each piece of code and offers:

- **Keep the code:** you trust where it came from. {appName} won't ask about it again on this computer.
- **Leave it out:** builds your site without it, this time.
- **Review:** shows you the code first.

Code you type into {appName} yourself never needs this.
