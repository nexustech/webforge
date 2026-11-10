# {appName} Help

The user help for {appName}: what each feature does and how to use it, in the words people see in the app. For now these are Markdown pages in the repository. Later the app bundles them and opens them from its Help menu, the start screen's _Help_ tab and _Help for this element_ (plan item 5.4b). The plan for that, and for keeping these pages current, is [research/product/15](../../research/product/15-help-and-documentation.md).

The pages describe `main` as it is. Each page's `updated` date says when it was last checked against the app.

## Contents

**Start here**

- [Getting started](getting-started.md): the start screen, the quick start, your first site and updates
- [Templates and example sites](templates.md)
- [The editor](the-editor.md): where everything is, Design and Content mode, Simple and Advanced mode, devices and zoom
- [Glossary](glossary.md): the words {appName} uses, and what each one means

**Building pages**

- [Editing on the page](editing-on-the-page.md): select, type, move, copy and delete
- [The Add panel](add-panel.md)
- [Sections](sections.md) and [Elements](elements.md): everything you can add
- [Layers](layers.md)
- [The Edit panel](edit-panel.md): options, different on each device, resetting
- [Styling](styling.md): Appearance, hover effects, entrance animations, _Style this…_, copying a look
- [Header, Footer and shared sections](header-and-footer.md)
- [Links](links.md)
- [Pages and the menu](pages.md), with Page Settings
- [One-page sites](one-page-sites.md): a whole site on one page, with a menu that scrolls to each section

**Your site's look and content**

- [Themes, colours and fonts](themes.md), with Theme Studio
- [Media](media.md): pictures and documents
- [Forms](forms.md)
- [Site Settings](site-settings.md)

**Checking and going live**

- [Preview](preview.md), on this computer and on your phone
- [Site Check](site-check.md)
- [Export](export.md)
- [Publish](publish.md): publish destinations and publishing to your web host

**Your work**

- [Find and Replace](find-and-replace.md): change a word everywhere on your site at once
- [Undo and Undo History](undo-and-history.md)
- [Version History](version-history.md): save versions, preview, restore, publish one again or open one as a new site
- [Saving, copies and backups](saving-and-backups.md)
- [Settings](settings.md): {appName}'s own preferences
- [Keyboard shortcuts](keyboard-shortcuts.md)
- [Custom Code](custom-code.md): Advanced mode
- [AI apps](ai-apps.md): let an AI app on this computer work on your site

## Writing a help page

These rules keep the pages readable for people who've never made a website, and ready for the app to show.

- **Who it's for:** a small-business owner, not a developer. Use the glossary's words ([research/product/01](../../research/product/01-terminology.md)): Site → Page → Section → Element, Theme vs Template, Publish vs Export. Never use component, breakpoint, deploy, asset or viewport. Technical words belong only on the Advanced-mode parts.
- **The app's name** is written `{appName}`, as in every UI message (`docs/branding.md`). The app fills it in.
- **The app's own words:** quote labels exactly as the UI shows them, in **bold** for buttons, menus and options, and _italics_ for choices in a list. Copy them from `packages/i18n/src/en/`.
- **Keys:** write Windows keys, with the Mac's in brackets the first time on a page ("Ctrl+P (Cmd+P on a Mac)"). Where a key differs between them, say so.
- **Only what exists on `main`:** if a feature is partly built, say what works today and what's coming, in a line (see [Publish](publish.md)). Don't describe plans.
- **Markdown:** use headings, paragraphs, lists, tables, links and `code` only. No raw HTML or images yet: the in-app viewer will show a strict subset. Link to other pages by file name (`themes.md#fonts`).
- **Front matter:** every page starts with these fields:
  - `id`: the file name without `.md`, which never changes once the app links to it;
  - `title` and a one-line `summary`;
  - `components`: the site component types the page explains, for _Help for this element_;
  - `related`: other pages' ids;
  - `updated`: the date the page was last checked against the app;
  - optionally `status: partial`, for a feature that's only partly there.
- **Keeping it current:** a PR that changes what people see, or how something works, updates the page in the same PR and its `updated` date. A new site component is added to a page's `components` and given a heading.
- **Checked:** `pnpm help-check`, part of `pnpm check`, fails when front matter doesn't parse, an `id` is repeated or isn't its file's name, a link or `#anchor` between pages doesn't resolve, a page links outside `docs/help/`, a `related` page isn't there, a component type is on no page or on two, a page spells out the app's name, or raw HTML or a picture appears.
