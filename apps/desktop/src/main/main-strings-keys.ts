import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { english } from "@webforge/i18n/components";
import { MAIN_RUNTIME_KEYS } from "./main-strings.js";

// Main's catalogue (#1317, ADR 0027): the strings main shows and nothing else, so its start-up
// loads only those (`e2e/app/main-start.spec.ts`). Made from the keys named by the files of main
// and of the shared code that read `@webforge/i18n/main`, and those main builds at run time
// (`MAIN_RUNTIME_KEYS`). `pnpm main-strings` writes it; `main-strings.test.ts` checks it's current.
// Neither the app nor its build imports this file.

/** Where main's code and the code it shares with the renderer are. */
const SOURCES = [join(import.meta.dirname, "."), join(import.meta.dirname, "../shared")];

/** A string that could be a key: words joined by dots. */
const KEY_LIKE = /"((?:[A-Za-z0-9_-]+\.)+[A-Za-z0-9_-]+)"/g;

/** The plural forms a base key can have, as `plural()` reads them. */
const FORMS = ["zero", "one", "two", "few", "many", "other"] as const;

/** Every source file of main's and the shared code that reads main's catalogue. */
function readers(): string[] {
  return SOURCES.flatMap((dir) =>
    readdirSync(dir, { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .map((file) => readFileSync(join(dir, file), "utf8"))
      .filter((code) => code.includes('"@webforge/i18n/main"')),
  );
}

/**
 * The messages main's catalogue holds, by key in order: each key named, a plural's forms, and
 * those built at run time.
 */
export function mainMessages(): Record<string, string> {
  const isKey = (key: string): key is keyof typeof english => Object.hasOwn(english, key);
  const keys = new Set<string>(["app.name", ...MAIN_RUNTIME_KEYS]);
  for (const code of readers()) {
    for (const [, key = ""] of code.matchAll(KEY_LIKE)) {
      keys.add(key);
      for (const form of FORMS) keys.add(`${key}.${form}`);
    }
  }
  return Object.fromEntries(
    [...keys]
      .filter(isKey)
      .sort()
      .map((key) => [key, english[key]]),
  );
}

/** Main's catalogue's source, before `biome format` lays it out. */
export function mainCatalogueSource(): string {
  const entries = Object.entries(mainMessages()).map(
    ([key, text]) => `  ${JSON.stringify(key)}: ${JSON.stringify(text)},`,
  );
  return `// Main's strings (#1317), made by \`pnpm main-strings\` from the keys that main's and the shared
// code's files name and those main builds at run time (apps/desktop/src/main/main-strings.ts).
// Don't edit: the English is en/'s, which this copies.

/** The English messages main shows: its menus, dialogs, notifications and errors. */
export const main = {
${entries.join("\n")}
} as const;
`;
}
