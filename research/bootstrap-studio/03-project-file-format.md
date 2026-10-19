# Bootstrap Studio — Project Files and Configuration Storage

## Where things live on this machine

| Path | What it is |
|---|---|
| `C:\Users\jabz_\AppData\Local\Programs\bstudio\` | **Current app (v8.0.1)**, a per-user electron-builder install (no admin rights needed) |
| `C:\Program Files\Bootstrap Studio\` | **Legacy v4 shell (2017)**, an old machine-wide install that can probably be uninstalled |
| `C:\Users\jabz_\AppData\Roaming\bstudio\` | **userData for the current app**: Chromium profile + app settings |
| `C:\Users\jabz_\AppData\Roaming\Bootstrap Studio\` | userData of the legacy shell (just `Local State` + empty `Dictionaries`) |
| `C:\Users\jabz_\Bootstrap Studio Backups\` | Automatic timestamped backups of designs |
| *anywhere the user chooses* | The actual `*.bsdesign` project files |

Note that the app forces its userData path to `%APPDATA%\<id>` (`bstudio`, or `bstudio-dev` in development) instead of Electron's default `%APPDATA%\<productName>`. That's why there are two Roaming folders.

### Contents of `Roaming\bstudio`
- `windowsize`: JSON `{mainWindow:{x,y,width,height}, editorWindow:{…}}`
- `settings` (when present): JSON, e.g. title-bar style
- `favoritePackages`: JSON tree `{"name":"Favorites","children":[…]}` of favourited library components
- `lab.key` (when present): RSA-signed offline licence
- `.updaterId`: electron-updater install id
- `Local Storage/leveldb`: most **app preferences live in browser localStorage**. Keys seen: `recent`, `lastDesignPath`, `lastPaths`, `backups`, `externalEditors`, `defaultEditor`, `editorPanel`, `session`, `templateMeta`, `firstRun`, `lastRun`, `lastRunVersion`, `version`, `recipients`, `ui5`, `uia`, and per-design UI state `design-<designId>_…`
- `Service Worker/` (51 MB): cache left over from the v4 era, when the editor was a web app
- Everything else (`Cache`, `GPUCache`, `DawnCache`, `Network`, `DIPS`…) is standard Chromium profile data

User-created **Library components** ("packages", class `LibraryPackage`) use the same JSON shape as designs (`{version, timestamp, package:{id, class, framework, name, …}}`). Their storage location wasn't confirmed: no user library items exist on this machine beyond an empty Favorites list.

## The `.bsdesign` format

**A single file: gzip-compressed JSON.** Everything, including images and fonts, is embedded as base64 data URIs. Your backups are 48 KB–318 KB compressed and 490 KB–835 KB raw.

To inspect one yourself:
```bash
gunzip -c "K2 (Backup 1685484649038).bsdesign" | python -m json.tool | less
```

### Top-level shape (format version 75, from your 2023 backups)

```jsonc
{
  "version": 75,                 // design format version (v8 app is at 87; converters migrate on open)
  "timestamp": 1685545373082,
  "design": {
    "id": "<hash>_<epoch-ms>",
    "name": "Cadence",
    "framework": "5",            // Bootstrap major version: "3" | "4" | "5"
    "settings": {
      "theme": { "id": "startup-modern", "type": "template" },
      "jqueryVersion": "", "iconSet": "tabler-icons", "lang": "en",
      "meta": [{ "type": "name", "key": "description", "content": "…" }],
      "headSettings": {}, "viewportContent": "",
      "sitemap": { "enabled": false }, "pwa": { "enabled": false },
      "favicons": [], "canonicalLinks": { "enabled": false },
      "robotsTxtContent": "", "adsTxtContent": "",
      "ecommerce": { "store": null }
    },
    "placeholders": { "brand": "Cadence", "description": "…" },   // site-wide tokens
    "assets": {
      "images": { "children": [ /* folder tree */ ] },
      "fonts":  { "children": [] },
      "css":    { "children": [ /* stylesheet files */ ] },
      "js":     { "children": [ /* script files */ ] }
    },
    "pages": { "children": [ /* page files (can be nested in folders) */ ] },
    "reflow": "2", "reflowLocale": ""
  }
}
```

### Assets are a virtual file tree
Every asset/page node shares a common header and can sit inside folders (`{name, expanded, children}`):
```jsonc
{ "name": "data-management.svg", "extension": "svg",
  "data": "data:image/svg+xml;base64,…",
  "properties": {}, "priority": 0,           // include order
  "pageBlacklist": [], "pageWhitelist": [] } // per-page inclusion of CSS/JS
```
- **JS files** store source in `value` (+ `disabled`).
- **CSS files** store a **structured AST**, not text:
  ```jsonc
  { "name": "untitled.css", "blocks": [
      { "selector": ".gradient-background", "mediaQuery": false, "enabled": true, "system": false,
        "rules": [ { "property": "background-size", "value": "240% 240%", "enabled": true, "system": false } ] },
      { "type": "keyframes", "name": "gradient-animation", "blocks": [ … ] } ] }
  ```
  Per-rule `enabled` flags are what give the Styles panel its "toggle this declaration" checkboxes. `system` marks rules the app manages.
- SCSS files are stored as text and compiled by the main process.

### Pages hold a component tree
```jsonc
{ "name": "index.html",
  "properties": { "title": "Home - Brand", "showInSitemap": true,
                  "headSettings": { "before": {}, "after": {} } },
  "meta": [], "includeInExport": true,
  "html": { "class": "HTML", "children": [ { "class": "Body", "children": [ … ] } ] } }
```

A component node (real example, trimmed):
```jsonc
{ "class": "NavBar",
  "label": "Navbar Centered Links",          // name shown in Overview panel
  "linkID": 1,                               // Linked Component id (shared across pages)
  "properties": { "style": "navbar-dark", "position": "sticky-top",
                  "expanded": "navbar-expand-md", "fluid": false, "smartActiveState": true },
  "cssClasses": { "system": { "main": "navbar navbar-dark navbar-expand-md sticky-top" }, "parent": "" },
  "overrides": { "/": { "id": "mainNav", "class": "py-3" } },   // user attributes per sub-element path
  "flags": { "canBeMoved": true, "canBeDeleted": true, "canBeEdited": false, … },
  "customProperties": [], "masked": false, "comment": null,
  "children": [ … ] }
```

Text content is a mixed array:
```jsonc
"children": [ { "class": "InlineCharacter", "weight": "", "style": "", "link": false,
                "color": "", "bgColor": "", "strike": false, "underline": false, "sub": false, "sup": false },
              "Home" ]
```

**Component types seen in your K2 design:** HTML, Body, Header, Section, Footer, Container, Row, Column, Div, Span, Paragraph, Heading, Anchor, Button, Badge, Hr, Image, Icon, List, ListItem, NavBar, NavBarBrand, NavBarToggle, NavBarCollapse, Nav, NavItem, DefaultCard, CardBody, Form, InputText, InputEmail, InputTextarea, InlineCharacter.

### Templates
Built-in templates ship as `app/assets/templates/bstudio/<bsVersion>/<name>/template.json` plus an `images/` folder. There are 23 for BS5. The JSON keys are `context` (the design), `images`, `meta`, `widgets` and `mainNavbarID`.

## Evaluation of the format

| ✅ Good | ⚠️ Weak |
|---|---|
| Single portable file, easy to email/back up | Opaque binary blob: **no meaningful Git diffs**, and merge conflicts can't realistically be resolved by hand |
| Atomic writes + automatic timestamped backups | Embedding every image as base64 inflates size ~33% and loads all of it into memory |
| Format version + converter chain keeps old files working | Tight coupling to Bootstrap: properties *are* Bootstrap class fragments |
| Structured CSS enables the visual style editor | Per-character format markers make text verbose |
