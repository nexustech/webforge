import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { mainCatalogueSource } from "./main-strings-keys.js";

// `pnpm main-strings` (#1317, ADR 0027), as a script, never part of the app: writes main's
// catalogue from the keys main's files name, which `biome format` then lays out.

writeFileSync(
  join(import.meta.dirname, "../../../../packages/i18n/src/en/main.ts"),
  mainCatalogueSource(),
);
