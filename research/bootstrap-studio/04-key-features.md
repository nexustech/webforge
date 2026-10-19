# Bootstrap Studio — Key Features

Compiled from the in-app documentation index (43 topics embedded in `static.js`), UI strings in the bundle, the v8.0 release announcement, and the structure of your own designs.

## Editor
- **Drag-and-drop** from a Component panel (built-in components + user **Library** + favourites + online community packages)
- **Stage** with device-width switching (Bootstrap breakpoints xs→xxl) and per-breakpoint options
- **Inline text editing** directly on the canvas (bold/italic/link/colour etc.)
- **Options panel**: typed, context-sensitive controls per component. Bootstrap utilities (colour, spacing, alignment, display, flex) are exposed as dropdowns, so users rarely type a class name
- **Overview panel**: DOM tree with move/duplicate/hide/delete toolbar, locking, labels, comments
- **Styles / CSS editing**: visual rule editor over a structured CSS model, with per-declaration toggles, media-query (breakpoint) aware
- **Code editors** (CodeMirror) for HTML, CSS, SASS/SCSS, JS. **Custom Code** component for raw HTML; open files in **external editors** (VS Code etc.)
- **Command Palette** (Ctrl+P, fuzzy search) and **Emmet**-style quick insertion
- **Linked Components**: reusable navbar/footer kept in sync across pages, with "Find Linked Copies"
- Undo/redo history; reopen closed design
- **Check For Issues** dialog (v8: extract inline styles into classes)

## Design-wide
- **Themes**: default Bootstrap, Bootswatch themes, and premium/template themes. Bootstrap theme variables are customisable (Bootstrap Settings)
- **Templates**: 23 Bootstrap 5 starter templates (agency, SaaS "Freshify", "App Toolkit" dashboard, blog, portfolio…)
- **Assets**: pages (with folders), CSS, SCSS, JS, fonts (Google Fonts / Web Fonts), images (import, srcset/WebP handling), icon sets (10+ libraries, font or SVG)
- **Placeholders**: site-wide tokens (brand name, description) reused in components
- **SEO & social**: per-page title/meta, Open Graph, sitemap.xml, robots.txt, ads.txt, canonical links, favicons, **PWA** manifest
- **View Transitions** between pages (v8)

## Rich components
Animations (Animate.css / AOS), Charts (Chart.js), Swiper sliders, Lottie, Google Maps / OpenStreetMap, video embeds, date picker, input masks, form validation, multilevel dropdown, sidebar navigation, **Smart Forms** (contact forms that work on static hosting, backed by their server email relay)

## CMS-like features ("Reflow")
- **Blog**: Collections, posts, Authors and Tags (`PageCollection`, `TagCollection`, `AuthorCollection`), generated into static pages
- **E-commerce**: product components fed by a store API/CMS endpoint (`getEcommerceAPIEndpoint`, `getEcommerceCMSEndpoint`), Stripe payments
- Note: this is *designer-side* content management inside the app, not an end-user CMS on the live site

## Preview, export, publish
- **Live preview** in any browser, including phones on the same network, with automatic CSS hot-reload / page reload
- **Export** to a static folder: minify HTML/CSS/JS, choose asset layout, run a post-export **Export Script**
- **Publish** to bss.design hosting (subdomain or custom domain, password protection, custom 404), **SFTP**, or GitHub Pages (docs)

## AI Assistant (v8.0, Feb 2026)
- Chat panel next to Overview. It can edit the design, create pages, write copy and code, generate images, read URLs and give SEO advice
- Bring your own key: OpenAI, Anthropic, Google, OpenRouter or local models via Ollama
- Works by editing the HTML/CSS/JS source with SEARCH/REPLACE diffs, then re-importing

## Platform and distribution
- Windows, macOS and Linux, from one Electron codebase
- Per-user installer (electron-builder NSIS on Windows), background auto-update with download progress and "confirm" strategy option
- Paid licence (lifetime + time-limited update entitlement), device activation, plus an offline "Lab edition" key
- Same codebase powers **Mail Studio** (email builder), showing how far the component/context architecture generalises
