# @webforge/errors

The base of the errors Webforge throws on purpose, and what logs may say about any error (standards §4).

## Public API
- **`WebforgeError<Code>`:** an abstract `Error` with a `code` (what went wrong, for code to act on and for logs) and a `messageKey` (the i18n key of the message the person sees: `t(error.messageKey)`), and the usual `cause`. Its `message` is for developers only, and is never shown or logged. Each package's own errors extend it: `ProjectFileError`, `SiteFormatError`, `BuildError`, `WriteError`, `PublishError`, `HistoryError` and others.
- **`errorCode(error)`:** what a log may say about any thrown value: its name and code (`ProjectFileError corrupt`, `Error ENOENT`, `SqliteError SQLITE_BUSY`), never its message. A name or code that isn't a short plain token is left out; a value that isn't an `Error` gives only its type.

## Boundaries
- Framework-free, with no runtime dependencies (`@webforge/i18n` only for the `MessageKey` type).
