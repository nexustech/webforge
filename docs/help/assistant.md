---

id: assistant
title: The assistant
summary: Ask {appName}'s built-in assistant to change your site, and check, keep or undo what it changed.
related: [settings, undo-and-history, version-history, ai-apps]
updated: 2026-11-14
status: partial
---

# The assistant

The assistant is an AI model you can ask to change the site you have open, such as "Make the Hero's title shorter". It makes the changes itself, and each one is a step in [Undo History](undo-and-history.md) named _AI (Assistant): …_, so you can undo it like your own.

It's off until you turn it on, and {appName} shows what it sends, and to whom, before anything is sent.

## Setting it up

Open [Settings](settings.md#assistant) and click **Assistant Settings…**, or click **Set Up the Assistant…** in the assistant's panel. What you change there happens at once, without **Save**.

- **Turn On…** shows what the assistant sends and who receives it. Read it, then click **Turn On**. **Turn Off** stops it at once and deletes its key from this computer.
- **Where requests go:**
  - _OpenRouter_, an online service with many AI models. Your own OpenRouter account pays. Click **Sign In with OpenRouter…** and finish in your browser, or **Sign In with a Code…** and paste the code OpenRouter shows.
  - _Ollama on this computer_ or _LM Studio on this computer_: a model running on this computer. Nothing leaves it.
  - _Another server_: a server you name that offers AI models. Enter its **Server address**, starting with `https://`, and click **Use This Server**. If it needs a key, enter it and click **Save Key**. An address starting with `http://` on another computer is unencrypted, so no key is sent to it.
- **Model:** choose **The model that answers**. Each shows about what a reply costs, and the ones {appName} has tested say _tested_. A model that costs more than most asks first.
- **Monthly limit:** between $1 and $1,000 ($5 at first). {appName} tells you at 80%, and the assistant stops at the limit until next month.

Under **Advanced**:

- **Review changes before they're made:** off at first, so the assistant changes your site as it works. Turned on, it shows what it would change and waits for you. See [Reviewing changes first](#reviewing-changes-first).
- **Allow models that may keep requests:** off at first, so only models whose providers don't keep or train on what you send are offered. Turning it on warns you first.
- **An OpenRouter key, instead of signing in:** paste a key from your OpenRouter account and click **Save Key**.

## Each site asks first

The first time you use the assistant on a site, {appName} asks whether to use it there, and says who will receive the site's content. Click **Use on This Site** or **Not Now**. Your answer stays on this computer, never in the site file. A model on this computer doesn't ask, because nothing leaves it.

**Stop Using on This Site**, at the top of the panel, takes your yes back. **Use on This Site** gives it again.

## Rewriting text

While the assistant is on, the toolbar you see while typing has a **Rewrite…** menu.

1. Select the text to rewrite, up to 4,000 characters.
2. Choose **Friendlier**, **Shorter** or **Fix spelling and grammar**.
3. {appName} shows your text and the assistant's suggestion side by side. Nothing changes yet.
4. Click **Use This** to put the suggestion in place of your text, **Try Again** for another, or **Cancel**.

Only the selected text is sent. The suggestion is plain text: bold, italic, colours and links in the text you selected aren't kept, and {appName} says so before you use it. What you use is one step in Undo History, named _AI (Assistant): …_. Each suggestion counts towards your monthly limit.

## Writing descriptions and alt text

While the assistant is on, [Site Check](site-check.md) offers **Write One…** beside a page without a description and a picture without alt text.

- **A page's description:** the assistant writes one from the page's title and text, and {appName} shows it as a search result would.
- **A picture's alt text:** the assistant writes it from the picture's file name and the text near it. It can't see the picture itself, so check it says what the picture shows. What you use becomes the picture's alt text in [Media](media.md), wherever it's placed.

Change the text as you like, then click **Use This**, **Try Again** for another, or **Cancel**. What you use is one step in Undo History, named _AI (Assistant): …_.

## Asking for a change

The **Assistant** panel is a tab in the left column, after **Version History**: the sparkles.

1. Select the section or element you mean, if there is one: the assistant is told what's selected and which page you're on.
2. Type what you'd like in **Message the assistant**, and press Enter or click **Send**. Shift+Enter starts a new line.
3. The reply appears as it's written, with what it changed. Click **Stop** to stop it: changes it has made stay, and can be undone. A question it's waiting on closes, as if you'd clicked **Cancel**.

Each reply says what it cost, and the top of the panel shows this month's spend against your limit. **New Conversation** starts again.

While it works:

- **It reads before it changes.** It looks at your pages and their sections through the same tools AI apps use, and changes only what you asked.
- **Some changes ask you first,** as an AI app's do: one to more than one page, to Site Settings, the header or the footer, or to where visitors' money or details go. Click **Allow** or **Cancel**.
- **If you're editing,** such as typing or dragging, it waits a moment and tries once more, then tells you.
- **Before its first change in a conversation,** {appName} saves a version named _Before the assistant's changes_ in [Version History](version-history.md).
- **A reply has limits:** at most 25 reads and changes, and 12 turns of thinking. A reply that reaches one stops and says so, and so does one that reaches your monthly limit. Ask again to carry on.
- **Your site's text is only content to the assistant.** Text on your pages that reads like an instruction ("ignore the above…") isn't followed as one.

A link in a reply shows its address beside it. Clicking it opens it in your browser, and only links in that reply open.

## Checking what it changed

After a reply that changed your site, a card says how many changes it made:

- Click a change to show it on the page.
- **Links to other websites** lists any links it added, by website, so a look-alike address stands out.
- **Keep** closes the card.
- **Undo These Changes** undoes all of that reply's changes. **Redo** brings them back.

If you've made other changes since, the card can't undo them on their own. Click **Open Version History** and restore the version saved before the assistant's changes. See [Version History](version-history.md).

## Reviewing changes first

With **Review changes before they're made** on, in Assistant Settings under **Advanced**, the assistant works on a copy of your site and changes nothing on it until you say so. After its reply, a card lists what it would change, and any links to other websites by their address.

- **Apply Changes** makes them, one by one, each a step in [Undo History](undo-and-history.md) as if it had made them at once. A change that needs your OK asks first, as usual. If you've changed the page since and one of them no longer fits, that one isn't made, and the card says which.
- **Discard** drops them. Your site is as it was.

Only the last reply's changes wait: sending a new message drops the ones before, and so do **New Conversation** and opening another site.
