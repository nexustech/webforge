# A site's ZIP

*File › Save a Copy as ZIP…* saves the open site as one ZIP file (4.7, F-SITE-5): the site and its versions as plain JSON, with the original files, for a backup or for moving the site to another computer. *File › Open Site from ZIP…* opens it again as a new site, saved where the person chooses, with nothing lost: the same pages, Media, versions and choices. It isn't the website: *Export Site…* makes that, as a folder or a ZIP of HTML files.

The code is `packages/storage/src/site-zip.ts`; `packages/storage/test/site-zip.test.ts` checks the round trip on generated sites (fast-check) and on the format 1 fixture. Keep this page in step with them.

## A site package

The ZIP is a written-out **site package** (`packages/storage/src/site-package.ts`, architecture review 2, A26) plus the site's versions. Opening a version as a new site (4.6) uses the same package, without writing a ZIP. A package is:

- **the site**: one `SiteDoc`, read through `migrateSite` as a `.wforge` file's site is;
- **its Media**: the original of each Media item the site reaches, with its file name, type and dimensions;
- **its files**: the other files it names by their SHA-256, such as bundled code (3.9);
- **the project block**: what the project keeps beside the site that a round trip keeps.

What a site reaches is what `reachableBlobs()` finds in its documents, the hashes garbage collection keeps. A Media original or file that nothing in the site or its versions names isn't carried.

### The project block

A `.wforge` file keeps a few things beside the site. The package decides which of them a lossless round trip keeps:

| Kept | Why |
|---|---|
| `editorMode` | Design or Content mode, as the person left it |
| `exportChoices` | The last export's choices, so the next export asks the same |
| `siteCheckIgnored` | The Site Check findings the person chose to ignore |

| Not kept | Why |
|---|---|
| The project id and creation time | The new site's file has its own. Publishing refuses a folder another project published to (A8), so a copy that kept the original's id could publish over the original's pages without asking |
| The storage format | The new file is in this app's format |
| Backups | They copy the file the site came from, and stay beside it |
| Saved publish passwords and the trust given to a site's code | The app keeps them in its own data under the project id, never in the site (security review S1 and S2), so a copy starts with none |

## Layout

```
manifest.json            what the ZIP holds, and where
site.json                the site
versions/<id>.json       each version, a site as site.json is
media/<media id>/<name>  each Media item's original file, as it was imported
files/<sha-256>          other files the site names, such as bundled code (3.9)
```

- Ids in entry names are percent-encoded (`media/photo%3A1/shop.jpg` for `photo:1`), so every name unpacks on Windows, macOS and Linux. A Media file keeps its name, with the characters a file name can't have replaced by `-` (`safeFileName` in `@webforge/model`, as the save dialogs' names are); a name Windows keeps for a device, such as `con.jpg`, becomes `file`.
- JSON entries are indented with two spaces. `site.json` and each version are a whole site as `@webforge/model` defines it (`SiteDoc`), in this app's site format, with its `formatVersion`.
- Entries the manifest doesn't list are ignored. Every entry has the same date, so the same site always makes the same ZIP.
- No ZIP64: at most 65,535 entries. A ZIP is at most 2 GiB, and holds at most 2 GiB unpacked, the most the app reads into memory at once. A larger site can't be saved as a ZIP (`too-large`).

## `manifest.json`

| Field | What it holds |
|---|---|
| `format` | `"webforge-site-zip"`: a ZIP without it isn't a site's |
| `version` | The layout's version, now `1`. A ZIP of a later one comes from a newer app, which the person is asked to update to |
| `name` | The site's name, which the new site's file takes |
| `media` | `{ mediaId, path, mime, width?, height?, originalName, sha256 }` for each Media item's original |
| `files` | `{ path, mime, sha256 }` for each other file the site names by its SHA-256 |
| `versions` | Newest first: `{ id, name, kind, createdAt, path }`, `kind` being `manual` or `auto` |
| `project` | The project block: `{ editorMode, exportChoices, siteCheckIgnored }` |

## Opening one

A ZIP the person chooses is untrusted, as a `.wforge` file is (ADR 0003). `readSiteZip` checks it before the save dialog asks where the new site goes:

1. Its size, before it is read, and its entries, from the ZIP's directory, before anything is unpacked: at most 2 GiB in all (else `too-large`). Each entry's claimed size must be one it can have: a stored entry's is its own size, and a deflated one's at most 1,032 times its size, the most deflate shrinks data by (else `damaged`). The unpacker allocates the claimed size first, so a few KB claiming GBs is refused here.
2. The manifest: a site's, of a layout this app reads (else `not-a-site-zip` or `newer-format`), valid in every field, with each version id, Media id and entry listed once (else `damaged`).
3. Only the entries the manifest lists are unpacked. Each file's bytes must match its SHA-256, and the site and every version must be a site this app opens through `migrateSite` (`damaged`, or `newer-format` for a newer site format).

The new site is then filled in its new file before it opens, as New Site fills one (a `NewSiteFill`): the files and Media, the site, the project block, then the versions, oldest first so they list in the same order. Its project id and creation time are its own, as a new file's are.
