# Product Terminology

**Status:** ✅ Glossary agreed 2026-10-19 (decisions T1–T4 below)
**Goal:** names that **non-technical users already know** from the tools they've used (Wix, Squarespace, Canva, Adobe Express, Google Sites, Hostinger, WordPress). Avoid developer and designer jargon (component, breakpoint, viewport, deploy, asset, class, DOM, render).

## How other tools name things

| Concept | **Wix** | **Squarespace** | **Canva Websites** | **Adobe Express** (web pages) | **Google Sites** | **Hostinger** | **WordPress** (Site Editor) | **Webflow / Framer** (pro) | **Bootstrap Studio** |
|---|---|---|---|---|---|---|---|---|---|
| The whole thing | Site | Site / Website | Website (design) | Web page | Site | Website | Site | Site / Project | Design |
| A page | Page | Page | Page | Page (single) | Page | Page | Page | Page | Page |
| Full-width band of content | **Section** (Add Section) | **Section** | **Section** | **Section** | Section (layouts) | **Section** | Group / Pattern | **Section** | Section (component) |
| Item inside a section | **Element** (Add Elements) | **Block** (Add Block) | Element | Element / "assets" | **Content block** | **Element** | **Block** | Element | Component |
| Top / bottom of every page | **Header / Footer** | Header / Footer | (section) | — | Header / Footer | Header / Footer | Template parts: Header/Footer | Header/Footer (sections) | (Linked components) |
| Reusable, synced piece | "Show on all pages" | — | — | — | — | Global colours/fonts | **Synced pattern** | **Component** (was Symbol) | **Linked Component** |
| Saved for reuse | **My Designs** | **Saved Sections** | — | — | — | — | Pattern | Component / Library | Library |
| Site-wide look (colours, fonts) | **Site Design** (theme) | **Site Styles** | Brand Kit / Styles | **Themes** | **Themes** | Website styles (colours & fonts) | **Styles** (Global Styles) | Variables / Styles | Themes |
| Starting design | **Template** | **Template** | **Template** | Template / Theme | Theme | **Template** | Theme / Template | Template | Template |
| Page list & menu | **Pages & Menu** | **Pages** (Main navigation / Not linked) | Pages | — | **Pages** | Pages and navigation | Navigation | Pages | Pages (Design panel) |
| Add things | **Add Elements / Add Section** | **Add Section / Add Block** | Elements | + (Add) | **Insert** | Add section / Add element | Inserter (+) | Add / Insert | Component panel |
| Structure tree | **Layers** | — | Layers (Position) | — | — | — | List view | Navigator / Layers | Overview |
| Selected item's options | Settings / Design buttons | Edit (Content, Design) | Toolbar | — | Toolbar | Settings | Block settings / Styles | Settings / Style panel | Options panel |
| Device views | Desktop / Mobile editors | Desktop / Mobile view | Desktop / Mobile | Preview | Preview (devices) | Desktop / Mobile | Desktop / Tablet / Mobile | Breakpoints | Device sizes |
| Raw code | Embed code (Custom Code) | **Code block** | — | — | Embed | **Embed code** | Custom HTML block | **Custom Code** | Custom Code |
| Go live | **Publish** | Publish (Save) | **Publish** | Share → Create link | **Publish** | Publish | Publish | Publish | Export / Publish |
| Check before live | **Preview** | Preview | Preview | Preview | **Preview** | Preview | Preview | Preview | Preview |
| Previous versions | **Site History** | — | Version history | — | **Version history** | — | Revisions | Backups / Versions | Backups |
| Site details (URL, SEO, social) | **Settings** | **Settings** | Website settings | — | Settings | Settings / SEO | Settings | Site settings | Design settings |
| Images & files | **Media** | Assets / Images | Uploads | — | Images | Gallery / Media | **Media Library** | Assets | Images (Design panel) |

### Patterns across consumer tools
1. **Site → Page → Section → Element** is the dominant hierarchy (Wix, Canva, Adobe Express, Hostinger, Framer). Squarespace and WordPress say **Block** instead of Element.
2. **Header / Footer** are universally understood.
3. **Theme** (look) and **Template** (starting site) are both familiar and must stay **distinct**.
4. **Publish** and **Preview** are universal. "Export" is understood but secondary.
5. **"Component", "Symbol", "Breakpoint", "Navigator", "Class"** appear only in designer/developer tools (Webflow, Framer, Bootstrap Studio). Avoid them in Webforge's main UI.
6. **Version history / Site history** is the familiar name for going back in time; **Undo** is universal.

## Proposed Webforge glossary

| Webforge term | Means (internal concept) | Why this word | Avoid |
|---|---|---|---|
| **Site** | The project / `.wforge` file ("New Site…", "Open Site…") | Wix, Squarespace, Google Sites, WordPress | Project, Design, Document |
| **Page** | One HTML page | Universal | Screen, View |
| **Section** | A full-width band (Hero, Features, Contact…), a top-level Puck component | Wix, Squarespace, Canva, Hostinger, Adobe | Block (ambiguous), Component |
| **Element** | Anything inside a section (Heading, Text, Image, Button, Form, Columns…) | Wix, Hostinger, Canva, Adobe | Component, Widget, Node |
| **Columns** | Layout element that splits a section horizontally | Universal | Grid, Row/Col, Flex |
| **Form · Form field** | An element sending its fields to the form service in Site Settings, and each field in it: a line of text, an email address, a phone number, a message, a tick box or a choice from a list (S1, 2.11). The Contact form section is a ready-made form | Wix, Squarespace ("Form", "Form field") | Input, Control, Widget |
| **Add column · Remove last column** | The Columns toolbar's buttons (2.17): Add puts a new column at the end; Remove last column takes away the last one, with what's in it, whichever column is selected | Says which column goes | Remove column (which one?), Delete column |
| **Header / Footer** | Shared top/bottom of every page (C5) | Universal | Layout regions, Master page |
| **Shared section** | A section stored once and placed on several pages; edits apply everywhere (MVP, F-ED-23, GA6). A separate, later feature is a library of **saved sections** reused across sites (C5) | Plain English; Squarespace "Saved Sections" | Linked Component, Symbol, Synced pattern, Global Template |
| **AI apps** | AI apps on the user's computer (Claude, ChatGPT…) connected to Webforge through MCP (F-AI-1). UI: *Connect AI apps* | Plain English | MCP server, connector, integration |
| **File** | A non-image item in Media (PDF, Word, Excel…), linked for download with the link dialog's *File* option (F-ED-24). "Document" is avoided in the UI because specs use it for the site's data | Plain English | Resource, asset, attachment, document |
| **Theme Studio** | The larger window for editing a theme: palettes, text styles, spacing, corners (F-DS-7) | Elements | Design system, tokens |
| **Favourites** | Sections and elements the user pins at the top of the Add panel (F-ED-26) | Bootstrap Studio | Pinned components |
| **Select parent** | Select the section or element that contains the current one (F-ED-25) | Bootstrap Studio | Go up the DOM |
| **Detach** | Turn one copy of a shared section into a normal section | Wix, Squarespace | Unlink, break link |
| **Pair** (an AI app) | Connect an AI app to Webforge with a one-time code (F-AI-1) | Plain English | Authorise, register client |
| **Template** | A ready-made starting site chosen at "New Site" | Universal | Starter, Kit |
| **Theme** | Site-wide colours, fonts, corner style (daisyUI theme) | Google Sites, Adobe Express, Bootstrap Studio | Design tokens, Variables, Style guide |
| **Entrance animation** (with **Delay**) | How a section or element moves in as visitors scroll to it: Fade in, Slide up, Slide in from the left or right, Zoom in (F-DS-5, 2.12). Plays once; never for visitors who prefer less motion | Bootstrap Studio, Wix ("Entrance animation") | Scroll effect, Reveal, AOS, Transition |
| **Hover effect** | What a button (later a card) does under the pointer: Lift, Grow, Shadow (F-DS-5, 2.12) | Wix, Elementor | Hover state, Hover animation, Interaction |
| **Colours: Page colours · Reversed** | A section's colours (F-DS-3, 2.4): the page's, or the theme's light and dark colours swapped, a dark band on a light page (daisyUI's nested theme) | Plain English, says what happens on either theme | Inverse, Invert, Dark mode, Variant, Nested theme |
| **Add** panel (tabs **Sections** / **Elements**) | Component palette | Wix "Add Elements / Add Section", Squarespace "Add Block/Section" | Components, Library, Insert |
| **Layers** | Structure tree (Puck outline) | Wix, Canva, Figma, Photoshop | Overview, Navigator, DOM tree |
| **Edit panel** with tabs **Content · Style · Advanced** | Puck fields / inspector for the selected item | Common in builders (Squarespace Content/Design, Elementor-style tabs) | Properties, Options, Inspector |
| **Desktop · Tablet · Mobile** | Breakpoint views | Universal | Breakpoints, Viewports |
| **Media** | Images, video, files in the site | Wix, WordPress | Assets |
| **Fonts** | Font choices in the theme | Universal | Typefaces, Web fonts |
| **Custom Code** | Custom HTML/JS element + site code (C7) | Wix, Framer, Bootstrap Studio | Embed HTML, Raw HTML |
| **Site Settings** | URL, social links, contact details, analytics, SEO (X3) | Universal | Config, Properties |
| **Page Settings** | Per-page title, description, share image, hide header/footer | Universal | Page properties, Meta |
| **Preview** | Open the live preview (desktop, phone via QR) | Universal | Serve, Run |
| **Publish** | Upload to a host (B1) | Universal | Deploy, Upload, Push |
| **Export** | Save the site as files/ZIP | Familiar | Build, Compile |
| **Publish destination** | A publish profile (Netlify, FTP…) | Plain English | Profile, Target, Endpoint |
| **Version History** (with **Save version** and **Restore**) | Project versions (06) | Google Sites/Docs "Version history", Wix "Site History" | Snapshots, Revisions, Backups |
| **Undo History** | Undo/redo step list (03 D3) | Photoshop "History"; prefix avoids a clash with Version History | History (alone) |
| **Site Check** (**Must fix · Should fix · Tips**) | Issues panel (X5: errors / warnings / suggestions) | Friendly, non-alarming | Issues, Lint, Validation, Errors |
| **Contact form** / **Form** | Form element + submission service (B3) | Universal | Form endpoint, Backend |
| **Brand colours** | Primary/secondary/accent in the theme | Canva "Brand Kit" familiarity | Palette tokens. Colour roles in the UI (23 Oct 2026): **Brand** (daisyUI primary), **Accent** (secondary) and **Second accent** (accent), **Surface** (base-100/200/300), **Text** (base-content); the theme model keeps daisyUI's role names |

### Naming rules for UI text
1. **Plain verbs:** Add, Edit, Move, Duplicate, Delete, Hide, Publish, Restore.
2. **Name things by what users see:** "Hero section", "Image", "Button", not technical types ("daisyUI hero", "img").
3. **Undo step labels** follow *Verb + item name* (D2): "Edited Header text", "Moved Hero section", "Changed theme".
4. **Advanced** tab and **Custom Code** are where technical words may appear (CSS classes, HTML), clearly labelled as advanced.
5. **Consistency:** one term per concept everywhere (menus, tooltips, help, error messages). Maintain this glossary as the source of truth; translations follow it later.

## Bootstrap Studio → Webforge mapping (for reference)
| Bootstrap Studio | Webforge |
|---|---|
| Design (.bsdesign) | Site (.wforge) |
| Components panel | Add panel (Sections / Elements) |
| Options panel | Edit panel (Content · Style · Advanced) |
| Overview panel | Layers |
| Linked Components | Header / Footer, Shared sections (both MVP) |
| Library | Saved sections (later) |
| Themes | Themes |
| Design Settings | Site Settings |
| Backups | Version History |

## Decisions (2026-10-19)

| # | Topic | Decision | Consequence |
|---|---|---|---|
| T1 | **Primary user** | **DIY small-business owners** | Consumer vocabulary throughout (Wix/Squarespace style); no developer or designer jargon in the default UI, help or error messages |
| T2 | **Simple / Advanced mode** | ✅ **Simple by default**, Advanced one toggle away (View menu + Settings) | **Simple:** Add panel, **Layers** (always shown under Add and Undo History; [ADR 0011](../../docs/adr/0011-layers-always-visible.md), 23 Oct 2026), Edit panel (Content · Style), Pages, Theme, Media, **Undo History panel**, Preview, Publish, Version History, Site Check. **Advanced adds:** the Edit panel's *Advanced* tab (CSS classes, HTML attributes, anchor IDs), Custom Code, developer export files (X6). The mode is a per-user preference, not saved in the site |
| T3 | **Layout model** | ✅ **Structured, responsive flow/grid** (sections stacked; elements in columns/stacks). **No free positioning** | Matches Puck's model; sites always adapt to phones. Wording uses "Move up / Move down / Drag to reorder" and "Columns", never x/y coordinates |
| T4 | **Item name** | ✅ **Element** | Hierarchy: **Site → Page → Section → Element**. "Block" is not used anywhere in the UI |

## Remaining open questions
1. **Languages:** English only for MVP, with the glossary kept as the source for translations later? (Assumed yes unless decided otherwise.)

## Sources
- Wix: [Using the editor menus](https://support.wix.com/en/article/wix-editor-using-the-editor-menus) · [Header, footer and page](https://support.wix.com/en/article/wix-editor-placing-elements-in-your-header-footer-and-page) · [My Designs](https://support.wix.com/en/article/wix-editor-saving-and-reusing-customized-elements-my-designs)
- Squarespace: [Fluid Engine (sections, blocks)](https://support.squarespace.com/hc/articles/6421525446541) · [Account saved sections](https://www.beyondspace.studio/blog/how-to-use-squarespace-account-saved-sections)
- Canva: [Canva Websites overview](https://www.canva.com/help/canva-websites/)
- Adobe Express: [Create a webpage with Adobe Express](https://www.adobe.com/learn/express/web/create-webpage-with-adobe-express)
- Google Sites: [Create & edit a site](https://support.google.com/a/users/answer/9310491?hl=en)
- Hostinger: [Customise a website template](https://www.hostinger.com/support/6475646-hostinger-ai-builder-manual-mode-how-to-customize-a-website-template/)
- WordPress: [Global Styles, Patterns, Templates, Template Parts](https://www.fastcomet.com/kb/what-are-wordpress-editor-elements)
- Webflow: [Symbols evolved to Components](https://webflow.com/feature/symbols-evolved-to-components) · Framer: [Section (dictionary)](https://www.framer.com/dictionary/section)
- Bootstrap Studio: [../bootstrap-studio/04-key-features.md](../bootstrap-studio/04-key-features.md)
