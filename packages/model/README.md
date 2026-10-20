# @webforge/model

The site's documents and their zod schemas: what the editor edits, `.wforge` stores and the export pipeline builds.

## Public API
`src/index.ts` is the only entry point; import the package as `@webforge/model`, never its internal files.

- **`SiteDoc`** and `siteDocSchema` (architecture §5): settings, theme, the shared layout, pages keyed by `PageId` with `pageOrder` and `homePageId`, media metadata, custom code and the navigation menu. The schema rejects broken structure: pages stored under another id, a page order that misses a page, no home or "Page not found" page, reserved slugs (`index`, `404`, `assets`), two pages with one path, duplicate media names or menu item ids. `createSite(options)` makes a new valid site.
- **Pages:** `PageEntry` (`kind: "page" | "not-found"`, `slug`, `folder`, `title`, `navLabel`, Page Settings, content) and `pagePath(page, homePageId)`, which gives the export path (`index`, `404`, `services/cakes`).
- **Branded ids:** `PageId`, `NodeId`, `MediaId`, `MenuItemId`, their schemas, and `newId(kind)`.
- **Site Settings** (`SiteSettings`, X3): general, web address, social, contact and opening hours, search engines, analytics, form defaults, publish destinations (never secrets), allowed external URLs.
- **Media:** `MediaMeta` (an image with alt text, focal point and crop, or a file), `ImageValue` (`{ mediaId, alt? }`) and `altTextFor`, which applies the per-use override (G15).
- **Links:** `LinkValue` (page by id with an optional anchor, e-mail, phone, URL, file).
- **Menu:** `MenuDoc` (`follows: "pages" | "custom"`) with page, link, section, button and one-level group items.
- **Per-device values:** `Responsive<T>`, `responsiveSchema(inner)` and `resolveResponsive(value, breakpoint)`.
- **Nodes:** `PageDoc`, `NodeDoc` (with the optional Layers `layerName`, `hidden` flag and `advanced` options), `LayoutDoc` (Header and Footer, C5), `Theme`, `SiteCode`.
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
