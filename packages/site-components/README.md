# @webforge/site-components

The sections and elements users put on their pages: their fields, daisyUI 5 markup, the static renderer used by exports, and the `webforge.js` behaviours exported sites need. Why daisyUI: [research 05](../../research/stack/05-site-components.md). How exports use it: [ADR 0005](../../docs/adr/0005-export-pipeline-spike.md).

## Public API
`src/index.ts` is the main entry point; import the package as `@webforge/site-components`, never its internal files. `@webforge/site-components/catalogue-data` is the second: the catalogue as plain data, without React (below).

- **Library contract:** `ComponentLibrary`, `ComponentDef` (label, fields, defaults, `render`, optional `behaviours`) and `FieldDef` (`text`, `richtext`, `select`, `slot`, `media`). Helpers: `textValue`, `stringValue`, `optionValue`, `slotComponent`.
- **`RenderContext`:** what components may need from outside their props: site navigation, page links and resolved images. `EDITOR_RENDER_CONTEXT` is the canvas version (no navigation, links go nowhere, no images yet).
- **Navigation and links:** `navigationFor(site, page, prefix, …)` gives the Header's menu items with URLs relative to the page, and `hrefFor(link, …)` where a link field goes (F-ED-17, F-ED-18). Both are pure, for the export pipeline and the canvas alike (moved from the pipeline, R16).
- **Catalogue:** `siteLibrary` (Header, Footer, Section, Hero, FAQ, FAQ item, Heading, Text), `starterPage()` and `starterLayout(siteName)`.
- **Static rendering:** `renderNodesToHtml(nodes, library, context)` renders a page or the Header/Footer to HTML without editor wrappers. Rich text is sanitised (`sanitizeRichText`). `walkNodes`, `mediaUsedBy` and `behavioursUsedBy` inspect a tree. `UnknownComponentError` is thrown for a type the library lacks.
- **Catalogue as data** (`@webforge/site-components/catalogue-data`, 4.8): `CATALOGUE`, each component's label, place, fields and defaults as zod-checked JSON (`catalogue-data.json`, written from `siteLibrary` by `pnpm catalogue-data`; a test fails when it is stale), and `fieldValueSchema(field)`, the zod schema of a field's value. The command layer for AI apps (`@webforge/commands`) reads it.
- **Behaviours:** `BEHAVIOUR_SCRIPTS`, the readable classic scripts behind `webforge.js` (currently the Header's mobile menu).

```ts
const html = renderNodesToHtml(page.content, siteLibrary, context);
```

## Conventions
- Each component keeps a `site-<name>` class (`site-section`, `site-text`…) as a stable hook for tests and for developers reading the export.
- Style options are design tokens (Padding: Small/Medium/Large → `py-8/16/24`), never free values.
- Interactive parts use native HTML first (`<details>` for the FAQ); `webforge.js` adds ARIA state and keyboard handling where HTML can't (the mobile menu).

## Boundaries
- Must not import editor packages (engine, editor-ui, history, storage, publish).
- Components must render with `renderToStaticMarkup` without browser globals (no DOM types in this package).
