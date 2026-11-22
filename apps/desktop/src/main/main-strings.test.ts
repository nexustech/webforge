import { english, isMessageKey } from "@webforge/i18n/main";
import { describe, expect, it } from "vitest";
import { MAIN_RUNTIME_KEYS } from "./main-strings.js";
import { mainMessages } from "./main-strings-keys.js";

describe("main's strings (#1317)", () => {
  it("are main's keys, as en/ has them: after changing main's strings, run `pnpm main-strings`", () => {
    expect(english).toEqual(mainMessages());
  });

  it("hold every key main builds at run time", () => {
    expect(MAIN_RUNTIME_KEYS.filter((key) => !isMessageKey(key))).toEqual([]);
  });
});
