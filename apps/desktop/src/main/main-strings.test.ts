import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { english } from "@webforge/i18n/components";
import { isMessageKey } from "@webforge/i18n/main";
import { describe, expect, it } from "vitest";
import { MAIN_RUNTIME_KEYS } from "./main-strings.js";

// Main's catalogue (#1317): the strings main shows and nothing else, so its start-up loads only
// those (`e2e/app/main-start.spec.ts`). Made from the keys the files of main and of the shared code
// that read `@webforge/i18n/main` name, and those main builds at run time (`MAIN_RUNTIME_KEYS`).

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

/** The keys main's catalogue holds: each named, a plural's forms, and those built at run time. */
function mainKeys(): string[] {
  const keys = new Set<string>(["app.name", ...MAIN_RUNTIME_KEYS]);
  for (const code of readers()) {
    for (const [, key = ""] of code.matchAll(KEY_LIKE)) {
      if (Object.hasOwn(english, key)) keys.add(key);
      for (const form of FORMS) {
        if (Object.hasOwn(english, `${key}.${form}`)) keys.add(`${key}.${form}`);
      }
    }
  }
  return [...keys].filter((key) => Object.hasOwn(english, key)).sort();
}

/** `text` as Biome writes a string: in double quotes, or single ones when it has a double. */
const quoted = (text: string) =>
  text.includes('"') && !text.includes("'")
    ? `'${JSON.stringify(text).slice(1, -1).replaceAll('\\"', '"')}'`
    : JSON.stringify(text);

/** A key's line, as Biome breaks one longer than 100 characters. */
function entry(key: string): string {
  const text = english[key as keyof typeof english];
  const line = `  ${JSON.stringify(key)}: ${quoted(text)},`;
  return line.length <= 100 ? line : `  ${JSON.stringify(key)}:\n    ${quoted(text)},`;
}

/** Main's catalogue's source, as `pnpm main-strings` writes it. */
const source =
  () => `// Main's strings (#1317), made by \`pnpm main-strings\` from the keys that main's and the shared
// code's files name and those main builds at run time (apps/desktop/src/main/main-strings.ts).
// Don't edit: the English is en/'s, which this copies.

/** The English messages main shows: its menus, dialogs, notifications and errors. */
export const main = {
${mainKeys().map(entry).join("\n")}
} as const;
`;

describe("main's strings (#1317)", () => {
  it("are main's keys, as en/ has them: after changing main's strings, run `pnpm main-strings`", async () => {
    await expect(source()).toMatchFileSnapshot("../../../../packages/i18n/src/en/main.ts");
  });

  it("hold every key main builds at run time", () => {
    expect(MAIN_RUNTIME_KEYS.filter((key) => !isMessageKey(key))).toEqual([]);
  });
});
