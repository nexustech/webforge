# 0017. The site's own code in the export

- Status: Accepted
- Date: 2026-10-28
- Related: #67 (3.9), F-ED-15, C7, X1, X4, [ADR 0005](0005-export-pipeline-spike.md), [research/stack/07](../../research/stack/07-export-pipeline.md)

## Context
A site has code of its own (C7, Advanced): `custom.css`, `custom.js`, HTML for every page's `<head>` and for the end of its `<body>` (the model's `SiteCode`), and Custom Code elements on its pages. 3.9 puts all of it in the export.

The plan said "esbuild bundling to classic scripts" and "a real Tailwind class scanner for Custom HTML" (ADR 0005, Finding 1). Both arrive as native binaries. The pipeline runs in a utility process that Vite bundles, inside an asar archive whose Fuses switch off running as Node, so each would have to be unpacked and shipped beside it.

## Decision
- **`custom.css`** is a file of its own, `assets/css/custom.<hash>.css`, linked after the site's stylesheet, so it wins over the theme and the utilities.
  - It isn't compiled by Tailwind, so a mistake in it can't stop the site's styles being built.
- **`custom.js`** is a file of its own too, `assets/js/custom.<hash>.js`: a classic `<script defer>` after `webforge.js`.
  - **Not wrapped in a function.** Its top-level names stay global, as a classic script's are, so a Custom Code `onclick="openMenu()"` still finds `openMenu`.
  - **Checked, not bundled.** Terser (already the pipeline's minifier) reads it as a classic script. A mistake, or an `import` or `export`, which only a module can have, gives the warning `custom-script` with its line. The script is still exported as written, since a browser reports the same mistake.
  - **No esbuild yet.** Bundling would follow `import`s, and the site's code may import nothing:
    - not an external file, which the external-resource check (3.9) stops;
    - not a library, as Webforge offers none.
    - esbuild comes with vetted offline libraries, if they do.
- **The head HTML goes last in every page's `<head>`**, after Webforge's scripts. **The body HTML goes last in its `<body>`**, after the consent banner. Both go in as the person wrote them.
- **The site's own CSS and JS go out as written, *Minify output* or not**, as Custom Code's scripts and styles already do (3.3).
- **Classes:**
  - The words of the site's own code that can be classes go to Tailwind, beside the classes of the pages' markup. That code is each Custom Code element's HTML, the page HTML and `custom.js`.
  - A word is a run of characters between whitespace, quotes, `<`, `>`, `=` and `;`, as Tailwind's own scanner reads a file. So a class in `class='…'`, an unquoted one, or one that `custom.js` adds compiles too.
  - Tailwind makes CSS only for the words that are classes. A word of text costs nothing unless it is one (`hidden`), which costs a rule.
- **The snapshot carries the code** (`SiteSnapshot.code`), left out while all four parts are empty, so a site without code builds as before.

## Consequences
- A site without code exports byte for byte as before: no new files, no new lines.
- Custom Code's classes no longer depend on how its HTML quotes them.
- **The developer files' README** lists `custom.*.css` and `custom.*.js` when the site has them.
- Revisit esbuild if Webforge offers libraries that `custom.js` may import, and Tailwind's own scanner if the word scan misses classes people write.
