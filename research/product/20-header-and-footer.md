# The Header and Footer: what they can hold

**Status:** ✅ Decided 2026-11-20 ([§5](#5-decisions)): HF-1, HF-2 and HF-4 are adopted (6 days), and on 23 Nov HF-5, HF-8 and HF-9; HF-3, HF-6 and HF-7 are not taken for now. Planned as PH5-5, before v1.0: 5.37–5.39 ([#1236](https://github.com/nexustech/webforge/issues/1236)–[#1238](https://github.com/nexustech/webforge/issues/1238)). **24 Nov 2026:** HF-10, a content width for the Header and Footer ([§4](#added-on-24-nov-2026-the-contents-width)), is adopted, with sites saved before kept at _Full_ ([#1401](https://github.com/nexustech/webforge/issues/1401)).

**Date:** 2026-11-20

**The question,** from the product owner, after planning [Webforge's own website](../../docs/testing/own-website-with-claude-code.md): the Header and Footer are limited. What do competitors do, and what should we offer?

## 1. What we have

Read from `packages/site-components/src/catalogue/layout.tsx` and the help page [Header and Footer](../../docs/help/header-and-footer.md).

|                    | Header                                                                                     | Footer                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| **Holds**          | The site's name as text, and the menu                                                      | One text, the menu's links (in _Columns_), and _Cookie settings_ when the consent banner is on |
| **Layouts**        | _Name left, menu right_, _Centred_, _With a button_                                        | _Centred_, _Columns_                                                                           |
| **Options**        | Stay at the top when scrolling; change style when scrolling; highlight the section in view | none                                                                                           |
| **A button**       | The menu's last link, in _With a button_ only                                              | none                                                                                           |
| **A logo**         | ❌ no picture at all                                                                       | ❌                                                                                             |
| **Other elements** | ❌ none can be added                                                                       | ❌                                                                                             |
| **On one page**    | Hidden in Page Settings                                                                    | Hidden in Page Settings                                                                        |
| **On phones**      | The menu folds into a button                                                               | The same content, stacked                                                                      |

Beside them: the **Announcement bar** above the Header and **Contact buttons** after the Footer, one of each for the site.

The shortfalls a small business meets first: no logo; no phone number or "Book now" in the Header unless it is the menu's last link; no social icons; and a Footer that can't hold an address, opening hours, a second list of links (Privacy, Terms) or a newsletter form.

## 2. What others do

From their documentation on 2026-11-20 (links in [Sources](#sources)); none was run.

| Product                                                                 | Header                                                                                                                         | Footer                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| **Wix, Wix Studio**                                                     | A free container: any element, shown on all pages                                                                              | The same; any section can be made global |
| **Webflow, Framer, WordPress block themes, Bootstrap Studio, Pinegrow** | Free: a component, template part or master that holds anything                                                                 | The same                                 |
| **Shopify**                                                             | A group of sections the merchant adds to and reorders; the announcement bar is one                                             | The same                                 |
| **Squarespace 7.1** (from a tutorial; its own page wasn't reachable)    | A fixed layout with elements switched on or off (button, social icons), layout presets, fixed or transparent, a tab for phones | Ordinary sections                        |
| **Hostinger**                                                           | Fixed, with options: sticky, transparent, a button, social icons, a bar above                                                  | Not found                                |
| **Webnode**                                                             | Fixed: a type chosen from a list, up to three headings and one button, social icons by a switch                                | A type chosen from a list                |

What nearly all of them offer:

1. a logo, the menu, at least one button and social icons in the Header;
2. a Header that stays at the top;
3. a menu that folds on phones, usually with settings of its own;
4. a Footer that takes freer content than the Header;
5. a way to hide or vary them on a page.

We have 2, 3 and 5. We lack 1 and 4.

The builders for our audience (Squarespace, Hostinger, Webnode) keep the Header a fixed layout with switches, and only the tools for designers make it a free container. For the Footer, even Squarespace gives ordinary sections.

## 3. Direction

- **The Header stays a layout with parts you switch on.** It has to fold into the phone menu, stay one line high and keep its keyboard order, and a free container can break all three. So: more parts and more layouts, not any element.
- **The Footer becomes a place for elements,** in columns. It has room, it stacks on phones without help, and what people want in it (address, hours, links, social icons, a newsletter form) is in the catalogue already.
- **Both stay shared and undoable** as today, and an AI app can fill them once they have fields and places (today it can't add to either).

## 4. Proposals

Sizes are rough ideal days.

| #        | Proposal                                                                                                                                                                                                                                                                                               | Why                                                                                            | Size |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---- |
| **HF-1** | **A logo in the Header:** a picture from Media in place of the site's name, or beside it, with its height as a size (S, M, L). The name stays as the picture's description, and shows when there's no picture. Site Settings holds the logo, so the Footer and a site's structured data can use it too | Every competitor has it, and it is the first thing a business asks for                         | 1.5  |
| **HF-2** | **The Header's button is its own:** a label and a link, in any layout, in place of "the menu's last link". Sites that use _With a button_ keep their button through a migration                                                                                                                        | Today's rule is hard to discover, and a "Book now" button shouldn't depend on the menu's order | 1    |
| **HF-3** | **Parts to switch on in the Header:** the phone number as a link to call, and social icons, both from Site Settings. In the phone menu they go below the links                                                                                                                                         | The two things after a logo and a button that the fixed-layout builders offer                  | 1.5  |
| **HF-4** | **The Footer takes elements, in up to four columns.** Each column holds elements from the catalogue: Text, List, Social links, Contact details, Newsletter signup, Image. It starts from a preset (_Simple_, _Columns_, _Full_), and today's two layouts migrate to the first two                      | The largest gap, and what a Footer is for                                                      | 3.5  |
| **HF-5** | **A bottom line in the Footer:** the copyright text, and links of its own (Privacy, Terms) apart from the menu, with _Cookie settings_ beside them                                                                                                                                                     | Legal links don't belong in the main menu, and today that is the only source of Footer links   | 1    |
| **HF-6** | **A see-through Header over the first section,** turning solid once the page scrolls. Offered when the page starts with a Hero that has a picture; the contrast check covers the menu over the picture                                                                                                 | Common on the sites our templates imitate; Squarespace and Hostinger have it                   | 1.5  |
| **HF-7** | **Two more Header layouts:** the logo centred with the menu split either side, and the menu below a taller logo                                                                                                                                                                                        | Cheap once HF-1 is in; gives templates more range                                              | 1    |

**Recommended:** HF-1, HF-2 and HF-4 (6 days), in that order. HF-1 and HF-2 make the Header match what every competitor's does; HF-4 is the real work and the biggest gain. Then HF-5 and HF-3. HF-6 and HF-7 are polish.

**Not proposed:** any element in the Header (see §3); a different Header for one page (hiding covers the need; a landing page can hide both); a search box (no site search yet); a language switcher (comes with sites in several languages, CC-2, v1.1); a light/dark switch (comes with dark mode for visitors, 6.11).

**What changes if adopted:** the Header's and Footer's fields, with a format migration each (HF-2, HF-4); the templates, which would use the new parts; the catalogue data for AI apps; and the help page.

### Added on 24 Nov 2026: the content's width

**The question,** from the product owner: can the Header and Footer set a width for their content, as sections can?

**What we have.** No. Each section has a **Content width** (3.21): _Narrow_, _Medium_, _Wide_ or _Full_, at most 768, 896 or 1152 px, or the page's width less the padding, with its background across the page's whole width. The Announcement bar and Contact buttons, which are also shared by every page, have the same field (_Full_ by default). The Header and Footer have no such field: their content spans the page's width less their padding, 16 px each side for the Header and 32 px for the Footer. On a 1920 px window, below sections at _Wide_, the Header's logo and the Footer's first column sit 350 to 370 px to the left of everything under them, and the menu and the last column as far to the right. On a laptop's window it hardly shows; on a large screen the site looks unfinished.

| #         | Proposal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Why                                                                                 | Size |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---- |
| **HF-10** | **Content width on the Header and the Footer,** the field sections have, with the same four choices, each set on its own. The background, the bar's style when scrolling and a sticky Header still span the page's width; on a phone nothing changes. A new site and every template start both at _Wide_, the widest capped width, so they line up with the widest content below them. Both default to _Full_, so a site saved before keeps it with no migration, as sections kept their widths in 3.21, and nothing moves until its owner changes it | The Header and Footer line up with the page between them, the way designed sites do | 2    |

**About the size:** the field is the one sections share, exported from `frame.tsx` to the Header and Footer, which aren't sections. Most of the work is in the HTML: the `<header>` is itself the bar and the `<footer>` itself the grid, so each gains an inner wrapper that holds the width. The Header's _Shrink_ style moves onto that wrapper, while the phone menu stays placed against the `<header>`. Then the Header's three layouts and the Footer's two, with and without columns, are drawn inside it, and the E2E tests that find the Footer's parts follow. Last come the templates, set to _Wide_, with their thumbnails and screenshots, the catalogue data for AI apps and the help page [Header and Footer](../../docs/help/header-and-footer.md). An AI app can set it with `updateFields` once it's a field.

**Recommended:** HF-10 as proposed. The one choice left to the product owner is what a site saved before gets: _Full_ (proposed: nothing moves when it opens, and its owner changes it if they want) or _Wide_ (it lines up at once, through a site format migration, but a published site looks different the next time it's published, without its owner having changed anything).

**Not proposed:** one width for the whole site, in the theme, that every section, the Header and the Footer follow. It would change every section's default, which differ on purpose (a text section reads better _Narrow_, a gallery _Wide_), and it's about three days. Nor a _boxed_ page, a fixed-width column with plain space either side, where no background reaches the window's edges: no template looks like that, and none of our audience has asked for it. Competitors weren't checked for this question.

## 5. Decisions

Product owner, 2026-11-20, asked which proposals to adopt: "The recommended ones".

| #    | Decision                                                                                                        |
| ---- | --------------------------------------------------------------------------------------------------------------- |
| HF-1 | ✅ **Adopted:** a logo in the Header                                                                            |
| HF-2 | ✅ **Adopted:** the Header's button is its own; the menu's last link moves into the button (owner, 22 Nov 2026) |
| HF-3 | ❌ **Not taken for now:** a phone number and social icons in the Header                                         |
| HF-4 | ✅ **Adopted:** the Footer takes elements, in up to four columns                                                |
| HF-5 | ❌ **Not taken for now:** a bottom line in the Footer. Next in line after HF-4. Adopted on 23 Nov: see below    |
| HF-6 | ❌ **Not taken for now:** a see-through Header                                                                  |
| HF-7 | ❌ **Not taken for now:** two more Header layouts                                                               |

6 days in all, in the order HF-1, HF-2, HF-4. **Planned as PH5-5** (20 Nov 2026; [the plan's §3](../../spec/04-implementation-plan.md#3-timeline), MVP §7 item 59): asked when they ship, the product owner answered "Both before v1.0", so all three join Phase 5. Stream A, after 5.30: 5.37 [#1236](https://github.com/nexustech/webforge/issues/1236) (HF-1, 1.5) → 5.38 [#1237](https://github.com/nexustech/webforge/issues/1237) (HF-2, 1), which share one site format migration if they land together; stream C, after 5.32: 5.39 [#1238](https://github.com/nexustech/webforge/issues/1238) (HF-4, 3.5). Each updates the catalogue data for AI apps, the templates where it fits and the help page.

**After run 2 of the trial** (product owner, 2026-11-23; [#1230](https://github.com/nexustech/webforge/issues/1230), [#1375](https://github.com/nexustech/webforge/issues/1375)), setting up a designed Footer took most of the person's time, and all three of its fixes were adopted:

| #    | Decision                                                                                                                                           |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| HF-5 | ✅ **Adopted:** a bottom line under the Footer's columns, for the © line and small links                                                           |
| HF-8 | ✅ **Adopted:** the Footer's **Menu links** can leave out or add pages, so a page hidden in the menu (shown as the Header's button) can stay there |
| HF-9 | ✅ **Adopted:** an Image in a Footer column can be _Small_, _Medium_ or _Large_, as the Header's logo is                                           |

About 2 days, out of plan in Phase 5's milestone: [#1375](https://github.com/nexustech/webforge/issues/1375), stream C, after [#1368](https://github.com/nexustech/webforge/issues/1368) (the _Centred_ Footer's text under its columns).

**Asked whether the Header and Footer can set a width for their content** (product owner, 2026-11-24: "Adopt, old sites Full"; [#1401](https://github.com/nexustech/webforge/issues/1401)):

| #     | Decision                                                                                                                                                                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HF-10 | ✅ **Adopted:** the Header and the Footer each get sections' **Content width**, set on its own. The background, the scroll style and a sticky Header still span the page. Every template starts both at _Wide_; a site saved before keeps _Full_, with no migration |

2 days, out of plan in Phase 5's milestone: [#1401](https://github.com/nexustech/webforge/issues/1401), stream C, at once (MVP §7 item 64).

## Sources

- Wix: <https://support.wix.com/en/article/wix-editor-customizing-your-site-footer>, <https://support.wix.com/en/article/studio-editor-using-global-sections>
- Webflow: <https://help.webflow.com/hc/en-us/articles/33961304628627>
- Squarespace (a third party's tutorial): <https://www.squareko.com/squarespace-tutorials/how-to-edit-squarespace-template-header>
- Webnode: <https://www.webnode.com/support/change-website-header/>, <https://www.webnode.com/support/add-social-networks/>
- Hostinger: <https://www.hostinger.com/support/6463972-hostinger-website-builder-how-to-edit-the-header-section/>, <https://www.hostinger.com/support/6511583-hostinger-website-builder-how-to-add-a-sticky-bar/>
- Shopify: <https://shopify.dev/docs/storefronts/themes/architecture/section-groups>
- WordPress: <https://developer.wordpress.org/themes/templates/template-parts/>
- Framer: <https://www.framer.com/help/articles/using-layout-templates/>
- Bootstrap Studio: <https://bootstrapstudio.io/docs/linked-components.html>
- Pinegrow: <https://pinegrow.com/docs/pinegrow-pro/master-pages/>
