# @webforge/publish

Publishers (Folder/ZIP, FTP/FTPS/SFTP, Netlify) and manifest diffing ([research 08](../../research/stack/08-publishing.md), [architecture §6–7](../../spec/01-architecture.md#6-key-interfaces)).

**Status:** core in place (spec/04 item 0.2): the `Publisher` interface, manifests, diffing and upload order. The Netlify, FTP/FTPS and SFTP publishers follow.

## Public API
Import the package as `@webforge/publish`, never its internal files.

| Export | What |
|---|---|
| `Publisher<D>` | `test(dest)` and `publish(build, dest, signal)`, which yields `PublishEvent`s. `D` holds the destination settings stored in the `.wforge` file; credentials go to the publisher when it is created, never into `D` |
| `PublishError`, `PublishErrorCode`, `throwIfCancelled` | Failures by code (`unauthorized`, `not-found`, `rate-limited`, `rejected`, `network`, `cancelled`, `failed`); the app translates each code. Messages never contain credentials or site content |
| `manifestOf`, `sha1`, `Manifest`, `manifestSchema`, `sitePathSchema` | What was published: path → SHA-1 digest. The schema validates manifests read back from a server; its paths can't point outside the site folder |
| `diffManifest(previous, next)` | Files to upload (new or changed), unchanged files, and files to remove (only ones the previous publish listed) |
| `uploadOrder(paths)` | Assets → pages → `index.html` last, so visitors never get a page whose files aren't there yet |

## Boundaries
- Framework-free: no React, no Electron.
- Core package: coverage ≥ 90% lines / ≥ 85% branches.
