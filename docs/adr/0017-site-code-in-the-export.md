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
  - The words of the site's own code that can be classes go to Tailwind, beside the classes of the pages' markup: every word of each Custom Code element's HTML and of the page HTML, and of `custom.js` only the words in its strings and template literals, where `classList` and `className` take theirs. Its keywords and names (`static`, `table`, `visible`) would make rules for nothing.
  - A word is a run of characters between whitespace, quotes, `<`, `>`, `=` and `;`, as Tailwind's own scanner reads a file. So a class in `class='…'`, an unquoted one, or one that `custom.js` adds compiles too.
  - Tailwind makes CSS only for the words that are classes. A word of text costs nothing unless it is one (`hidden`), which costs a rule.
- **The snapshot carries the code** (`SiteSnapshot.code`), left out while all four parts are empty, so a site without code builds as before.
- **The page cache leaves the code out of its key**, since it goes into each page's document after rendering. A change to the site's own CSS renders no page and compiles nothing, as 3.2 asks of the theme's values.

- **Download and bundle** (C8, 3.9) is Site Check's *Fix* for such a file. It keeps a copy with the site, so the export loads its own.
  - **Only on the person's click, after a yes.** The confirmation says the file's licence is theirs to check. It is the editor's one download besides fonts (architecture §9).
  - **Main downloads it** (`bundle-download.ts`). The address comes from a site file, which may come from anyone, so:
    - **`https://` at every hop.** Main follows redirects itself, at most five, so a redirect to `http://` is refused.
      - The fetch is `net.request` in manual mode (`bundle-net.ts`), not `net.fetch`. In Electron 44, `net.fetch` with `redirect: "manual"` throws "Redirect was cancelled" rather than giving the 3xx, so no redirect could be followed.
      - `net.request` gives the redirect's target, which the downloader checks like any address.
      - Checked on 28 Oct 2026 against unpkg, whose `htmx.org@1` redirects to a versioned file: it downloaded through the checked hop.
    - **Never this computer or its network.** Each host is resolved before its request and refused if any address is loopback, private, link-local, carrier-grade NAT or reserved, as are `localhost` and IP addresses of those kinds.
      - This narrows DNS rebinding but can't close it, as the request resolves the host again.
      - `https://` with its certificate checked is what stands between a rebound name and a local server.
    - **At most 10 MB, however it's sent.** The body is read as a stream and cancelled past the limit, so a response with no length can't fill main's memory.
    - **A script, stylesheet, font, image, sound or video, by its type** (or its name, for `application/octet-stream`).
    - **One deadline:** 30 s a request, and 60 s for a file and the files it names.
  - **A stylesheet's own files come with it.** Its `url()`s and `@import`s, relative ones from where it came from, are fetched one level deep, five at a time, and pointed at their copies.
  - **The log names a failed download's host and reason,** never its address.
  - **The bytes go in the site file as blobs**, and the site's code lists them: `SiteCode.bundled`, each with its address, its name in `assets/vendor/` (its own name and the start of its hash), its hash and its type.
    - Adding them is one undo step. Garbage collection keeps a blob while a document names its hash, so an undone download's bytes go at the next open or close.
    - The list is optional, its absence meaning none, so the format needs no new version (ADR 0012).
  - **A kept file whose bytes the site file lacks** keeps its address, and the export report says so (`missing-kept-file`).
  - **The export writes each file to `assets/vendor/`.** It points Custom Code, the page HTML and `custom.css` at the copies: each address whole, its `//` form too, from each page's depth.
    - **Not `custom.js`.** One script serves pages at every depth, and an address in it can't be rewritten without running it. A file a script names can't be fixed this way, so Site Check offers no Fix there; it must be removed or allowed.
    - Not a frame either: a page from another website isn't a file to copy.
  - **The E2E tests stand in for the network** (`WEBFORGE_E2E_BUNDLE=1`, unpackaged only), so no test reaches another website.

## Consequences
- **Site Check's external-resource rule runs in the renderer with the others** (ADR 0016), though ADR 0016 thought it might need the rendered site. The export writes the site's own code and Custom Code's HTML as written, so the rule reads the same text.
  - It finds each file they load from another website (`packages/site-check/src/external.ts`): scripts, stylesheets, fonts, images, sounds and videos, and frames.
  - Each is *Must fix* unless Settings' Custom Code allows its address, either the address itself or a folder ending in `/`.
  - Links aren't loaded files, so they pass.
  - **Changed by #649 (security review S1):**
    - A script counts every address in its strings, including one it only sends to or goes to (`fetch`, `sendBeacon`, `location`). A site that sends its visitors' data to another website depends on it as much as one that loads a file from there.
    - Settings' allowed addresses count only once the owner has confirmed them (`allowListConfirmed` in the rule's input). The list comes with the site's file, which may come from anyone, so a file can't allow its own scripts.
  - **It is a portability check, not a safety check.** A script can build an address at run time or hide one, and code that names no other website can still do harm on the site itself. What keeps code from someone else's file from running unasked is the code trust step (#649), not this rule.
- A site without code exports byte for byte as before: no new files, no new lines.
- Custom Code's classes no longer depend on how its HTML quotes them.
- **The developer files' README** lists `custom.*.css` and `custom.*.js` when the site has them.
- Revisit esbuild if Webforge offers libraries that `custom.js` may import, and Tailwind's own scanner if the word scan misses classes people write.
