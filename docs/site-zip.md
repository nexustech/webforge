# A site's ZIP

*File › Save a Copy as ZIP…* saves the open site as one ZIP file (4.7, F-SITE-5): everything in its `.wforge` file, as plain JSON and the original files, for a backup or for moving the site to another computer. *File › Open Site from ZIP…* opens it again as a new site, saved where the person chooses, with nothing lost: the same pages, Media, versions and settings. It isn't the website: *Export Site…* makes that, as a folder or a ZIP of HTML files.

The code is `packages/storage/src/site-zip.ts`; `packages/storage/test/site-zip.test.ts` checks the round trip on generated sites (fast-check) and on the format 1 fixture. Keep this page in step with them.

## Layout

```
manifest.json                       what the ZIP holds, and where
site/<id>.json                      the site's documents (the working copy)
versions/<version id>/<id>.json     a version's documents, where they differ from one written before
media/<media id>/<file name>        each Media item's original file, as it was imported
files/<sha-256>                     other files the documents name, such as bundled code (3.9)
```

- Ids in entry names are percent-encoded (`site/page%3Ahome.json` for `page:home`), so every name unpacks on Windows, macOS and Linux. A Media file keeps its name, with the characters a file name can't have replaced by `-`.
- JSON entries are indented with two spaces. The documents are the ones `@webforge/model` defines (`SITE_DOCUMENT_KINDS`), in the site format they were saved in; opening the site migrates them as opening a `.wforge` does.
- A document a version shares with the working copy, or with another version, is written once; the manifest points every user at that entry.
- Entries the manifest doesn't list are ignored. Every entry has the same date, so the same site always makes the same ZIP.
- No ZIP64: at most 65,535 entries and 4 GB, as with an exported site's ZIP. A larger site can't be saved as a ZIP (`too-large`).

## `manifest.json`

| Field | What it holds |
|---|---|
| `format` | `"webforge-site-zip"`: a ZIP without it isn't a site's |
| `version` | The layout's version, now `1`. A ZIP of a later one comes from a newer app, which the person is asked to update to |
| `formatVersion` | The `.wforge` format the site was saved in |
| `name` | The site's name, which the new site takes |
| `documents` | The working copy: `{ id, kind, path }` for each document |
| `media` | `{ mediaId, path, mime, width?, height?, originalName, sha256 }` for each Media item's original |
| `files` | `{ path, mime, sha256 }` for each other file the documents name by its SHA-256 |
| `versions` | Newest first: `{ id, name, kind, createdAt, documents }`, `kind` being `manual` or `auto` |
| `settings` | `{ editorMode, exportChoices, siteCheckIgnored }`: Design or Content mode, the last export's choices, what Site Check ignores |

## Opening one

A ZIP the person chooses is untrusted, as a `.wforge` file is (ADR 0003). `readSiteZip` checks it before the save dialog asks where the new site goes:

1. Its size and entries, from the ZIP's directory, before anything is unpacked: no more than a ZIP holds.
2. The manifest: a site's, of a layout this app reads (else `not-a-site-zip` or `newer-format`), valid in every field (else `damaged`).
3. Only the entries the manifest lists are unpacked. Each file's bytes must match its SHA-256, each document must be one of a site's, and the working copy and every version must make a site this app opens (`damaged`, or `newer-format` for a newer site format).

The new site is then filled in its new file before it opens: the files and Media, the documents, the versions (oldest first, so they list in the same order), and the settings. Its project id and creation time are its own, as a new file's are.
