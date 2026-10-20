# @webforge/publish

Publishers (Folder/ZIP, FTP/FTPS/SFTP, Netlify) and manifest diffing ([research 08](../../research/stack/08-publishing.md), [architecture §6–7](../../spec/01-architecture.md#6-key-interfaces)).

**Status:** spec/04 item 0.2: the `Publisher` interface, manifests, diffing, upload order, and the Netlify publisher. FTP/FTPS and SFTP follow (item 0.3).

## Public API
Import the package as `@webforge/publish`, never its internal files.

| Export | What |
|---|---|
| `Publisher<D>` | `test(dest)` and `publish(build, dest, signal)`, which yields `PublishEvent`s. `D` holds the destination settings stored in the `.wforge` file; credentials go to the publisher when it is created, never into `D` |
| `PublishError`, `PublishErrorCode`, `throwIfCancelled` | Failures by code (`unauthorized`, `not-found`, `rate-limited`, `rejected`, `network`, `cancelled`, `failed`); the app translates each code. Messages never contain credentials or site content |
| `manifestOf`, `sha1`, `Manifest`, `manifestSchema`, `sitePathSchema` | What was published: path → SHA-1 digest. The schema validates manifests read back from a server; its paths can't point outside the site folder |
| `diffManifest(previous, next)` | Files to upload (new or changed), unchanged files, and files to remove (only ones the previous publish listed) |
| `uploadOrder(paths)` | Assets → pages → `index.html` last, so visitors never get a page whose files aren't there yet |
| `netlifyPublisher({ token })` | File-digest deploy: sends every file's SHA-1, uploads only the files Netlify doesn't have (in upload order), then waits until the deploy is live. Retries 429s (honouring `Retry-After` / `X-RateLimit-Reset`) and, for GET and PUT, network errors and 5xx |
| `netlifyClient({ token })` | The Netlify endpoints Webforge uses: user, sites, deploys, file upload, `restoreDeploy` (rollback), `listForms` (Netlify Forms). Every response is validated with zod |

## Live Netlify check
`src/netlify.live.test.ts` deploys to a real, throwaway Netlify site twice, checks that the re-deploy uploads one file, restores the first deploy, and reports whether Netlify Forms detected the form. It is skipped unless both variables are set, so CI never runs it:

```sh
NETLIFY_AUTH_TOKEN=… NETLIFY_SITE_ID=… pnpm vitest run packages/publish/src/netlify.live.test.ts
```

The token comes only from the environment; it is never logged.

## Boundaries
- Framework-free: no React, no Electron.
- Core package: coverage ≥ 90% lines / ≥ 85% branches.
