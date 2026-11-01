# @webforge/model

The site's documents and their zod schemas: what the editor edits, `.wforge` stores and the export pipeline builds.

## Public API
`src/index.ts` is the only entry point; import the package as `@webforge/model`, never its internal files.

- **`SiteDoc`** and `siteDocSchema` (architecture §5): settings, theme, the shared layout, pages keyed by `PageId` with `pageOrder` and `homePageId`, media metadata, custom code and the navigation menu. The schema rejects broken structure: pages stored under another id, a page order that misses a page, no home or "Page not found" page, reserved slugs (`index`, `404`, `assets`), two pages with one path, duplicate media names or menu item ids. `createSite(options)` makes a new valid site.
- **Pages:** `PageEntry` (`kind: "page" | "not-found"`, `slug`, `folder`, `title`, `navLabel`, Page Settings, content) and `pagePath(page, homePageId)`, which gives the export path (`index`, `404`, `services/cakes`).
- **Branded ids:** `PageId`, `NodeId`, `MediaId`, `MenuItemId`, their schemas, and `newId(kind)`.
- **Site Settings** (`SiteSettings`, X3): general, web address, social, contact and opening hours, search engines, analytics, form defaults, allowed external URLs.
- **Publish destinations** (`PublishDestination`, B1, ADR 0018 §2): where a site is published to, kept beside the site document in the file's `meta` table, never undone or versioned, and never holding a secret.
- **Media:** `MediaMeta` (an image with alt text, focal point and crop, or a file), `ImageValue` (`{ mediaId, alt? }`) and `altTextFor`, which applies the per-use override (G15).
- **Links:** `LinkValue` (page by id with an optional anchor, e-mail, phone, URL, file).
- **Menu:** `MenuDoc` (`follows: "pages" | "custom"`) with page, link, section, button and one-level group items.
- **Per-device values:** `Responsive<T>`, `responsiveSchema(inner)` and `resolveResponsive(value, breakpoint)`.
- **Nodes:** `PageDoc`, `NodeDoc` (with the optional Layers `layerName`, `hidden` flag and `advanced` options), `LayoutDoc` (Header and Footer, C5), `Theme`, `SiteCode`.
- **Theme (2.1):** `ThemeTokens` and `themeTokensSchema`: daisyUI's colour roles (`COLOR_ROLES`, in OKLCH; the editor calls them Brand, Accent, Surface and Text), optional dark-section colours, heading and body fonts, corner sizes, spacing, the type scale (H1–H6, body, small), links, buttons and the shadow scale. `DEFAULT_THEME` is the light preset; format 5 turned each site's daisyUI theme name into these tokens, keeping the name as their `preset`.
- **Format versions:** `SITE_FORMAT_VERSION`, `migrateSite(raw)` (runs the `MIGRATIONS` chain from the document's version, then validates) and `SiteFormatError` (`invalid`, or `newer-format` so storage can open the site read-only). A format bump adds a step to `MIGRATIONS` and a fixture in `test/fixtures/v<n>/`; fixtures are never deleted.
- **Export:** `SiteSnapshot` and `siteSnapshotSchema` (export pipeline stage 1), and `siteToSnapshot(site, blobs)`, which builds one from a `SiteDoc` and the images' bytes.

```ts
import { siteDocSchema, siteToSnapshot } from "@webforge/model";

const site = siteDocSchema.parse(untrusted); // throws on an invalid site
const snapshot = siteToSnapshot(site, blobsByHash);
```

## Boundaries
- Framework-free: no React, no Electron, no Node or DOM APIs (`newId` uses Web Crypto through `globalThis`).
- Core package: coverage ≥ 90% lines / ≥ 85% branches.
