# The Header and Footer: what they can hold

**Status:** 🟡 For decision (HF-1…HF-7). Nothing here is in the plan.

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
