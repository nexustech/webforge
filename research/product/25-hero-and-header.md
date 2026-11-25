# The Hero and the Header as one piece

**Status:** 🟡 For decision ([§6](#6-proposals)): HH-1…HH-8 proposed, none planned. HH-1 would take the place of HF-6, which was not taken on 20 Nov 2026. [§7](#7-the-owners-journey), added 25 Nov 2026, walks through what the owner does and sees.

**Date:** 2026-11-24

**The question,** from the product owner: what do competitors offer for the hero and the navigation bar? Some let the two be one piece, the menu sitting on the hero's picture or colour. Should Webforge?

## 1. What we have

Read from `packages/site-components/src/catalogue/sections.tsx` and `layout.tsx`, and the help pages [Sections](../../docs/help/sections.md) and [Header and Footer](../../docs/help/header-and-footer.md).

|                        | Hero                                                                                                                            | Header                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Layouts**            | _Image beside the text_, _Centred, image below_, _Image behind the text_, _Text only_                                           | _Name left, menu right_, _Centred_, _Name left, menu centred_                                                     |
| **Holds**              | A title, a text, one button, one image                                                                                          | The name or logo, the menu, a button of its own (HF-1, HF-2)                                                      |
| **Background**         | The theme's second surface colour; behind the text, the picture under the theme's Neutral colour at 70%, which can't be changed | Always the page's own colour, with a shadow                                                                       |
| **Height**             | As tall as its content; _Image behind the text_ is at least 28 rem                                                              | One line (two in _Centred_ on wide screens)                                                                       |
| **Text position**      | _Centre_ or _Left_; always in the middle from top to bottom                                                                     | n/a                                                                                                               |
| **When scrolling**     | n/a                                                                                                                             | Stays at the top or not; then _Shadow_, _Shrink_, _Solid background_ (see-through, blurred, until then) or _None_ |
| **Joined to the Hero** | ❌ The Header is a band of its own above the page's first section, on every page                                                | ❌                                                                                                                |

Three things stand out. The Header always has its own solid band, so a page that opens with a picture or a dark Hero starts with a white strip above it. The Hero's picture has none of the **Overlay** settings every other section's background picture has. And the Hero has one button, one height and no say in where its text sits from top to bottom.

## 2. Three ways to make them one piece

Every product that joins the two does it in one of three ways.

| Way                                  | What the visitor sees                                                                                      | Who                                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **A. The Header over the picture**   | The Header has no background and sits on the first section's picture or video                              | Squarespace, Hostinger, Wix, Shopify's Horizon, Durable, Nicepage, Mobirise, Astra, Kadence, GeneratePress |
| **B. The Header on the same colour** | The first section has a plain colour, and the Header takes it, so there is no line between them            | Squarespace, Hostinger (the same switch as A); most of Pinegrow's demo sites                               |
| **C. The Hero holds the menu**       | The first section is the Header: one block with the logo, the menu and the hero's content, edited together | Webnode, GoDaddy, Weebly, Google Sites, Blocs, Bootstrap's Cover example                                   |

A and B are one feature seen with two kinds of background: "the Header shows the first section's background". Squarespace and Hostinger treat them so. C is a different model: the menu belongs to a section, so each page has its own or shares a copy.

## 3. What others do

From their documentation and, for Shopify, the themes' source, on 2026-11-24 (links in [Sources](#sources)); none was run. Jimdo's and GoDaddy's help pages refused to load, so both are thin, and Carrd has no header at all without custom CSS.

### Builders for owners

| Product                   | Joined how, and where it's switched on                                                                                                                                  | Keeping the menu readable                                                              | When scrolling                                                           | The hero itself                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Squarespace 7.1**       | A and B, for the whole site, as the Header's background style: solid, a fade into the first section, or the first section's own background. No switch for one page      | With no picture, the Header takes the first section's colours (from tutorials)         | Fixed or not; fixed can hide on the way down and come back on the way up | Any section: height in three sizes or the whole screen, picture or video behind, overlay strength, focal point (from tutorials)           |
| **Hostinger**             | A and B, one switch for the whole site: the Header takes each page's first section's background, which is also its way to give pages different Header colours           | Not documented                                                                         | A separate sticky switch                                                 | Not covered                                                                                                                               |
| **Wix** (Studio, Harmony) | A, as "overlap the next section" on a Header that stays, fades or disappears; not offered on one that scrolls with the page. Transparency is a fill opacity set by hand | Nothing automatic                                                                      | Stay, disappear or fade out; a colour of its own once scrolled           | Free layout                                                                                                                               |
| **Shopify Horizon**       | A, per kind of page (home, product, collection), each with its own text colour and a switch to invert the logo                                                          | The text colour and the inverted logo; hovering the menu brings the solid colours back | Always, on the way up, or never; solid as soon as it sticks              | Picture or video, a second one for phones, five heights and a custom one, overlay colour and gradient, text placed both ways, two buttons |
| **Shopify Dawn**          | Not offered                                                                                                                                                             | n/a                                                                                    | Never, always, on the way up, or with a smaller logo                     | Overlay 0–100%, three heights, nine text positions, up to two buttons                                                                     |
| **Durable**               | A, on the hero: a switch that joins the banner to the Header                                                                                                            | The banner's overlay, darker or lighter                                                | A sticky switch                                                          | Seven styles with a slideshow, picture or video, overlay, height as content or screen, text placed both ways                              |
| **Webnode**               | C: the Header's type is the bar alone, the bar with a heading, or the bar with content; the bar's background and the section's are set apart                            | The picture's filter and colour overlay                                                | A sticky switch                                                          | Minimum height, alignment, content width                                                                                                  |
| **GoDaddy**               | C: the Header and the hero are one section, drawn by the theme                                                                                                          | An overlay slider                                                                      | Not found                                                                | Picture, video or slideshow; three heights; a grid for the text's position                                                                |
| **Square Online, Weebly** | A by setting the Header's background to nothing (users report it misaligns); Weebly's older editor picks a header type per page (tall, short, landing, none)            | Not documented                                                                         | Scroll settings exist; unnamed in the docs                               | Full-height banners, slideshows, video                                                                                                    |
| **Google Sites**          | C: a header type per page (cover, large banner, banner, title only)                                                                                                     | A navigation colour: transparent, white or black                                       | Not found                                                                | The four heights, and an anchor for the picture                                                                                           |

### Tools for designers, and desktop apps

| Product                                          | Joined how                                                                                                                                                           | Notes                                                                                                                                                                   |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Astra, Kadence** (WordPress themes)            | A, as a named setting: on for the whole site, off for kinds of page, and each page can override. A second logo and a second set of colours for the see-through state | The most complete. Kadence: the sticky state's colours replace the see-through ones; hide on the way down; shrink. The page's content isn't moved down: padding by hand |
| **GeneratePress Premium**                        | A, as "merge with content", for chosen pages, on wide screens only if wanted                                                                                         | The only product with a setting that adds the Header's height to the hero's top padding                                                                                 |
| **Nicepage**                                     | A: the Header overlaps the first block, turns see-through and can invert its text. One Header for the site                                                           | A shrinking sticky Header too                                                                                                                                           |
| **Mobirise**                                     | A: the menu block has three switches, sticky, see-through and collapsed                                                                                              | Heroes with picture or video behind, parallax, overlay, full screen                                                                                                     |
| **Blocs**                                        | C: hero blocks come with a see-through menu inside them                                                                                                              | A menu shared by the site over a hero is awkward (forum): it works only inside the first block                                                                          |
| **WordPress block themes**                       | C in some patterns: the menu inside a cover picture. No setting                                                                                                      | A known contrast problem in submenus and the phone menu (Trac 65323)                                                                                                    |
| **Webflow, Framer, Elementor, Elements, Sitely** | Built by hand: position, layers, an interaction or script for the change on scrolling                                                                                | Sitely hides the Header on the way down as a setting. Framer's own tutorial shows a floating bar that appears after the hero                                            |
| **Bootstrap Studio, Pinegrow, Bootstrap**        | Built by hand with classes; the solid-after-scrolling change is a script. Bootstrap's Cover example is C                                                             | Separate Header and Hero blocks in the libraries                                                                                                                        |

### Pinegrow's feature screenshots

The product owner pointed at <https://pinegrow.com/#features>. Its twelve screenshots show Pinegrow editing seven demo sites, and the page itself is an eighth example. They are the best evidence here of what a designed site does today, since they were made to look good, not to show a setting.

| Site                                     | The Header and the hero                                                                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A festival** (the page's main picture) | **A:** logo, five links in small capitals and a pill button on a full-width photograph. A small label in a pill above a very large two-colour title; two buttons, one filled, one outlined |
| **A small hotel**                        | **B:** the Header on the hero's pale blue; underlined links, an outlined pill button, and a short line of text (the town) at the right. A round badge overlaps the picture                 |
| **A flower farm**                        | **B:** the Header on the hero's coral; a label above the title, two buttons, the picture cut to an arch at the page's edge                                                                 |
| **A trekking company**                   | **B:** the Header on the hero's tint; a row of figures (years, trips, reviews) directly under it                                                                                           |
| **A swimming trip**                      | **A:** a photograph the full height of the screen, the text at the bottom left, a row of round icon buttons                                                                                |
| **A magazine, a pottery, a paint shop**  | A Header of its own in white or cream above a plain first section: the classic arrangement                                                                                                 |
| **pinegrow.com itself**                  | **A/B:** an announcement bar in a solid colour, then a see-through menu on the hero's blue gradient                                                                                        |

Five of the eight join the two. None uses C. Three details recur beside the join: **two buttons** in the hero, **a label above the title**, and text **placed low or to one side** on a tall picture.

## 4. What they share, and where they differ

1. **A one-switch join is normal** in builders for owners (Squarespace, Hostinger, Durable, Horizon, Wix) and in block-based desktop apps (Nicepage, Mobirise). Only the designers' tools leave it to hand-built positioning.
2. **It always shows the first section's background,** never a picture of the Header's own.
3. **Staying at the top is a separate switch,** and a Header that stays turns solid once the page has scrolled. Hiding on the way down and returning on the way up is common (Squarespace, Wix, Dawn, Horizon, Kadence, Sitely).
4. **Where the switch lives differs:** on the Header for the whole site (most), per kind of page (Horizon, Astra, Kadence), or on the hero (Durable).
5. **Readability is mostly left to the owner.** Only Horizon, Astra, Kadence and GeneratePress give the see-through state its own colours and logo; Nicepage has one "invert" switch; the rest rely on the picture's overlay.
6. **Hardly anyone moves the hero's content down** to clear the Header. GeneratePress has a setting; Horizon pulls the hero up and adds nothing; the others say "add padding".
7. **Phones are barely documented.** The one report is a fault: WordPress's menu inside a picture loses contrast when opened.
8. **Heroes nearly everywhere have** a height choice that includes the whole screen, an overlay strength, a position for the text, a picture or a video, and room for two buttons.

Of 1 to 3, Webforge has the switch that keeps the Header at the top, and with the _Solid background_ scroll style the change to solid once the page has scrolled, but not the join. It has none of 8.

## 5. Direction

- **Join them as A and B, with one setting on the Header. Not C.** The Header is shared by every page and edited once (C5); a menu inside a Hero would have to be copied to each page, and Blocs's and WordPress's users show where that leads. A and B give the same picture to the visitor with the Header left where it is.
- **Follow the first section, whatever it is, page by page.** A picture behind it: the Header sits on the picture. A plain colour or _Reversed_ colours: the Header takes them. No sections, or a page that hides the Header: nothing to do. This is Hostinger's and Squarespace's rule, and it needs no switch per page: a page that opens with a white Text section gets a white Header, as now.
- **We work out the colours; the owner doesn't.** The Header's text takes the first section's text colour, so it is as readable as the Hero's own title, under the same overlay. This is where the others are weakest, and where Site Check's contrast rule and the editor's warning already do the work for sections.
- **We move the content down ourselves.** The first section gains the Header's height as padding, so its title never sits under the menu. Only GeneratePress does this, and it is the first thing a non-technical owner would get wrong by hand.
- **Once the page scrolls, a Header that stays turns solid,** in the page's colours, with the scroll style it has now. The phone menu's panel is always solid, which avoids WordPress's fault.
- **The Announcement bar stays a solid band above,** as on Pinegrow's own page.
- **The Hero catches up on its own account:** an overlay it can set, a height, a second button, a place for its text. They matter more once the Header is on the picture, because the join draws the eye to the Hero.

## 6. Proposals

Sizes are rough ideal days.

| #        | Proposal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Why                                                                                                                                 | Size |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **HH-1** | **The Header joins the first section.** A **Background** setting on the Header: _Its own_ (today) or _The first section's_. With the second, on each page the Header has no band of its own: it sits on the first section's picture, gradient or colour and takes its text colours, and the section gains the Header's height as padding. A Header that stays turns solid in the page's colours once the page has scrolled 80 px, so the scroll styles _Solid background_ and _None_ aren't offered while joined. A Hero that is its page's first section shows a line in its settings that leads to this setting, and the setting's help line says it applies on every page ([§7](#7-the-owners-journey)). The phone menu's panel, the Announcement bar and a page with no sections are unchanged. The canvas draws it as the export does. Site Check's contrast rule covers the menu wherever it covers the section's text | The join five of Pinegrow's eight sites and most owner builders have; in place of HF-6, which covered pictures only                 | 3    |
| **HH-2** | **A logo for dark backgrounds.** A second picture beside the logo in Site Settings, used wherever the logo sits on a dark ground: a joined Header over a picture or a _Reversed_ section, and the Header of a dark theme. Without one, the logo is used as it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | A dark logo disappears on a photograph. Horizon, Astra and Kadence each have this; it also helps a dark theme today                 | 1    |
| **HH-3** | **The Hero's picture gets the Overlay settings** every other section's background picture has: **Overlay** (_None_ to _Very strong_) and **Overlay colour**, with the same contrast warning. Heroes saved before keep today's look, the theme's Neutral colour at 70% whatever the theme makes it, through a format migration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Today the picture is always under the Neutral colour at 70%, so every photograph looks dim. Every competitor's hero has the control | 1    |
| **HH-4** | **A height for the Hero:** _Fits its content_ (today), _Tall_ or _Whole screen_. _Whole screen_ is the window's height, less the Header when the two aren't joined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | The full-screen opening is the look a joined Header is for; Squarespace, Horizon, Durable, Mobirise and Google Sites offer it       | 0.5  |
| **HH-5** | **A second button in the Hero,** outlined, beside the first: a label and a link, empty by default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | "Book now" and "See the menu". Dawn, Horizon and every Pinegrow demo have two                                                       | 0.5  |
| **HH-6** | **A place for the Hero's text** in _Image behind the text_: _Middle_ (today) or _Bottom_, with the **Alignment** it has                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | On a tall picture, text at the bottom left leaves the picture's subject in view                                                     | 0.5  |
| **HH-7** | **One more scroll style for a Header that stays: _Hide when scrolling down_,** returning on the way up. It keeps to the top without script, and for visitors who ask for less motion it changes without sliding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Gives a phone's screen back to the page. Squarespace, Wix, Shopify, Kadence and Sitely have it                                      | 1    |
| **HH-8** | **The templates use them:** a joined Header on those that open with a picture or a coloured Hero, with new thumbnails and screenshots                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | A setting no template shows is a setting few will find                                                                              | 1    |

**Recommended:** HH-1, HH-3 and HH-4 first (4.5 days), then HH-8. HH-1 is the feature asked about; HH-3 makes the picture under the Header worth looking at and is overdue on its own; HH-4 is half a day and completes the look. HH-2 the moment a tester's logo disappears on a photograph, which it will. HH-5 and HH-6 are cheap polish. HH-7 is separate from the join and can wait.

**About HH-1's size:** the Header is drawn once for the site, so its render needs to know the page's first section and what is behind it (the render context has the first section's id already, for the first picture). The export's CSS does the join without script: the Header overlays the section and the section's padding grows by the Header's height for its layout, which the script then corrects to the real height, as it does today for links to a section. Then the three layouts, with and without HF-10's content width, each device, the canvas, the catalogue data for AI apps, stories, E2E on the exported site in three browsers, and the help page. HF-6 was sized 1.5 for pictures alone, with none of the colour-following or the padding.

**Choices for the product owner:**

1. **Where the setting lives.** On the Header for the whole site, following each page's first section (proposed; Squarespace, Hostinger), or a switch on the Hero (Durable). On the Header it is one decision and every page follows; on the Hero it must be made again on each page, and a Header that stays would change between pages.
2. **Whether a new site starts joined.** Proposed: the templates that suit it do (HH-8), and a site saved before keeps _Its own_ with no migration, as with HF-10.
3. **The name.** _The first section's_ is plain but long. Others say "transparent", which describes the mechanism, not what the owner sees, and is wrong for B.

**Not proposed:**

- **A Hero that holds its own menu (C).** See §5.
- **A switch per page or per kind of page** (Horizon, Astra, Kadence). Following the first section already varies it by page, and Page Settings can hide the Header.
- **Colours of the Header's own for the joined state.** They come from the section; a second set is the thing our audience gets wrong.
- **A video behind the Hero.** It needs a video in Media, a poster picture and a size limit, and it is the heaviest thing a page can carry. Worth its own note.
- **A slideshow Hero.** The Carousel element exists; a hero that changes under the visitor's eyes hides its message.
- **Parallax,** a blurred "glass" Header beyond today's _Solid background_ style, and a second bar that appears after the Hero (Framer's tutorial).
- **A label above the Hero's title, and a badge.** Both recur in Pinegrow's demos; they are DP-1 and DP-2 of [product/21](21-designed-page-parts.md), deferred to v1.1, and this note is one more reason for DP-1.

**What changes if adopted:** the Header's and the Hero's fields, with a format migration for HH-3; Site Settings for HH-2; the templates; the catalogue data for AI apps; the help pages [Header and Footer](../../docs/help/header-and-footer.md), [Sections](../../docs/help/sections.md) and [Site Settings](../../docs/help/site-settings.md).

## 7. The owner's journey

Added 25 Nov 2026, at the product owner's request: how the owner meets HH-1…HH-8, what they can set, and what differs from today. It assumes the proposals as written in [§6](#6-proposals), with the setting on the Header.

### A new site

The owner picks a template that opens with a picture or a coloured Hero. It arrives joined (HH-8), so there is nothing to switch on. When they change the Hero's picture, the menu sits on the new one.

### A site made before

Nothing changes until the owner asks for it.

1. They select the Header on any page. Its settings show **Background**: _Its own_ (today's look) or _The first section's_.
2. They choose _The first section's_. The canvas redraws at once: the Header's band goes and the menu sits on the Hero.
3. It is one step to undo ("Edited Header background"), and it applies to every page, as every setting of the Header does.

### Each page follows its own first section

There is no switch per page.

| The page opens with                              | The Header shows                                   |
| ------------------------------------------------ | -------------------------------------------------- |
| A Hero with its picture behind the text          | The menu on the picture, in the Hero's text colour |
| A section in a plain or _Reversed_ colour        | That colour, with no line between the two          |
| A Text section in the page's own colour          | The same as today                                  |
| No sections, or a Header hidden in Page Settings | Nothing changes                                    |

When the owner moves another section to the top, or deletes the Hero, the Header follows the new first section.

### Shaping the Hero

With the Hero selected, the owner sets the picture's **Overlay** and its colour (HH-3), a **Height** (HH-4), where the text sits (HH-6) and a second button (HH-5).

### Keeping the menu readable

The owner chooses no colours for the Header.

- The menu takes the Hero's text colour.
- The contrast warning sections have covers the menu too, in the settings and in Site Check. What it points to is a stronger overlay.
- A dark logo on a photograph is the one thing the owner must supply (HH-2).

### What the visitor sees

- A Header that stays at the top turns solid, in the page's colours, once the page has scrolled.
- A Header that doesn't stay scrolls away with the Hero.
- On a phone the menu's button sits on the picture, and the opened menu is a solid panel.

### What the owner can set, beside today

| Where         | Setting                                | Choices                                    | Today                                          |
| ------------- | -------------------------------------- | ------------------------------------------ | ---------------------------------------------- |
| Header        | **Background** (HH-1)                  | _Its own_, _The first section's_           | No setting: always a band of its own           |
| Header        | The scroll style (HH-7)                | One more: _Hide when scrolling down_       | _Shadow_, _Shrink_, _Solid background_, _None_ |
| Hero          | **Overlay**, **Overlay colour** (HH-3) | _None_ to _Very strong_, and a colour      | Fixed: the theme's Neutral colour at 70%       |
| Hero          | **Height** (HH-4)                      | _Fits its content_, _Tall_, _Whole screen_ | Fits its content                               |
| Hero          | The text's place (HH-6)                | _Middle_, _Bottom_                         | Middle                                         |
| Hero          | A second button (HH-5)                 | A label and a link                         | One button                                     |
| Site Settings | A logo for dark backgrounds (HH-2)     | A second picture                           | One logo                                       |

The Header's layouts, logo, button and stay-at-top switch are unchanged, and so are the Hero's four layouts and its alignment.

### Three gaps the journey shows

Each is now part of HH-1 in [§6](#6-proposals), within its size.

1. **Finding the setting.** The owner is looking at the Hero when they want this, and the setting is on the Header. A Hero that is its page's first section shows one line in its settings that leads to the Header's **Background**. A second switch on the Hero would give one thing two places to be set.
2. **The scroll styles while joined.** A joined Header that stays must turn solid, or the menu ends up on the page's text. So _Solid background_ is implied and _None_ can't mean "stay see-through": neither is offered while joined, which leaves _Shadow_, _Shrink_ and HH-7's _Hide when scrolling down_. A Header saved with one of the two draws as _Shadow_ while joined and keeps its choice for _Its own_.
3. **Other pages change too.** Switching it on while looking at the home page also changes a page that opens with a _Reversed_ section. The setting's help line says "on every page", and the change is one step to undo.

## 8. Limits

- Nothing was run. Hosted builders were read from help pages, Shopify's themes from their source (the setting names are ids, not the editor's labels), and several facts from tutorials or forums: Squarespace's hero options, Nicepage's and Blocs's behaviour, Bootstrap Studio and Webflow. Jimdo and GoDaddy are nearly unread.
- What a see-through Header does once it sticks is undocumented for Squarespace, Hostinger and Durable.
- Pinegrow's screenshots were read as pictures of finished sites; how each was built in Pinegrow wasn't checked. Per the rule for competitor research, they inform layout and pattern only: no code, pictures or wording are taken from them.

## Sources

- Pinegrow: <https://pinegrow.com/#features>, <https://library.pinegrow.com/bootstrap5/>
- Squarespace: <https://support.squarespace.com/hc/en-us/articles/360000667707>; tutorials: <https://www.bigcatcreative.com/blog/transparent-header-menu-squarespace>, <https://will-myers.com/articles/background-overlay-in-squarespace-71>
- Wix: <https://support.wix.com/en/article/studio-editor-adding-header-scroll-effects>, <https://support.wix.com/en/article/wix-harmony-editor-customizing-your-sites-header>, <https://support.wix.com/en/article/freezing-your-header>
- Hostinger: <https://www.hostinger.com/support/6463972-hostinger-website-builder-how-to-edit-the-header-section/>, <https://www.hostinger.com/support/8347670-hostinger-website-builder-how-to-change-the-header-section-color-on-specific-pages/>
- Shopify: <https://github.com/Shopify/horizon/blob/main/sections/header.liquid>, <https://github.com/Shopify/horizon/blob/main/sections/hero.liquid>, <https://github.com/Shopify/dawn/blob/main/sections/header.liquid>, <https://github.com/Shopify/dawn/blob/main/sections/image-banner.liquid>
- Durable: <https://help.durable.com/en/articles/15199811-add-and-customize-your-banner-section-using-different-styles>, <https://help.durable.com/en/articles/15199846-customize-your-site-header-menu>
- Webnode: <https://webnode.freshdesk.com/en/support/solutions/articles/101000430751-how-to-change-the-header>
- GoDaddy (search results only): <https://www.godaddy.com/help/change-section-layouts-20109>
- Square Online, Weebly: <https://squareup.com/help/us/en/article/7284-create-a-flexible-header>; a forum thread: <https://community.squareup.com/t5/Online-Store/How-to-extend-Main-Banner-image-to-Header/m-p/366569>
- Google Sites (a third party's guide): <https://kb.plu.edu/85331>
- Astra: <https://wpastra.com/docs/transparent-header-for-hfb/>
- Kadence: <https://docs.nexcess.com/software/kadence/theme/customize-kadence-header/>, <https://docs.nexcess.com/software/kadence/theme/prevent-transparent-header-from-overlapping-content/>
- GeneratePress: <https://docs.generatepress.com/article/merging-header-navigation-content/>
- Elementor: <https://elementor.com/help/sticky-transparent-header>
- WordPress block themes: <https://core.trac.wordpress.org/ticket/65323>
- Webflow: <https://help.webflow.com/hc/en-us/articles/33961304628627-Navbar>
- Framer: <https://www.framer.com/blog/floating-navigation-on-scroll/>
- Realmac Elements: <https://docs.realmacsoftware.com/elements/getting-started/how-to/build-a-sticky-menu.md>
- Sitely: <https://sitely.app/docs/how-to-stick-a-menu-to-the-top-of-the-page.html>
- Nicepage: <https://nicepage.com/feature/header-471804>, <https://nicepage.com/questions/37149/transparent-header>
- Mobirise: <https://mobirise.com/bootstrap-menu/>, <https://mobirise.com/help/menu-373.html>
- Blocs: <https://forum.blocsapp.com/t/transparent-nav-bar/8837>, <https://forum.blocsapp.com/t/top-menu-on-hero-background-image/17888>
- Bootstrap: <https://getbootstrap.com/docs/5.3/examples/cover/>, <https://getbootstrap.com/docs/5.3/components/navbar/>
