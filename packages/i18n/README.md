# @webforge/i18n

UI strings (English for the MVP) and the `t()` lookup used by every user-facing string. Wording comes from the glossary in [`research/product/01-terminology.md`](../../research/product/01-terminology.md): Site → Page → Section → Element.

## Public API
- `t(key, params?)`: returns the string for `key`, replacing `{placeholder}`s with `params`.
- `MessageKey`, `MessageParams`: types for keys and params. Unknown keys are type errors.

```ts
import { t } from "@webforge/i18n";

t("app.version", { version: "1.2.0" }); // "Version 1.2.0"
```

## Boundaries
- Framework-free: no React, no Electron. Used by both the main process and the renderer.
- No hard-coded UI strings elsewhere: add a key to `src/en.ts` instead.
