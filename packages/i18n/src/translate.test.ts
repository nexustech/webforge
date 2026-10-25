import { describe, expect, expectTypeOf, it } from "vitest";
import {
  isMessageKey,
  type MessageKey,
  type ParamsOf,
  type PluralKey,
  plural,
  t,
  template,
} from "./translate.js";

describe("t", () => {
  it("returns the English message for a key", () => {
    expect(t("app.name")).toBe("Webforge");
  });

  it("substitutes placeholders when params are given", () => {
    expect(t("app.version", { version: "1.2.0" })).toBe("Version 1.2.0");
  });

  it("leaves a placeholder visible when its param is missing at run time", () => {
    // @ts-expect-error: a missing param is a type error (B10); at run time it stays visible.
    expect(t("app.version", {})).toBe("Version {version}");
  });

  it("checks params against the message's placeholders as the code compiles (B10)", () => {
    expectTypeOf<ParamsOf<"app.version">>().toEqualTypeOf<"version">();
    expectTypeOf<ParamsOf<"app.name">>().toEqualTypeOf<never>();
    // These lines only type-check; they would fail the build if the checks broke.
    const checks = () => {
      // @ts-expect-error: the message needs {version}.
      t("app.version");
      // @ts-expect-error: a param of another name doesn't do.
      t("app.version", { release: "1" });
      // @ts-expect-error: a message without placeholders takes no params.
      t("app.name", { version: "1" });
      // A key chosen at run time from the whole catalogue can't be checked, so it takes any.
      const any = "app.version" as MessageKey;
      t(any);
      t(any, { version: "1" });
    };
    expect(checks).toBeTypeOf("function");
  });
});

describe("isMessageKey", () => {
  it("tells a key the catalogue has from one built from data that it doesn't", () => {
    expect(isMessageKey("app.version")).toBe(true);
    expect(isMessageKey("theme.preset.nonexistent")).toBe(false);
    // Only the catalogue's own keys, never the prototype's.
    expect(isMessageKey("toString")).toBe(false);
  });
});

describe("template", () => {
  it("gives the message with its placeholders left in, for code that fills them itself", () => {
    expect(template("app.version")).toBe("Version {version}");
  });
});

describe("plural (B10)", () => {
  it("picks the message for the count, filling in {count}", () => {
    expect(plural("ui.picker.match", 1)).toBe("1 match");
    expect(plural("ui.picker.match", 0)).toBe("0 matches");
    expect(plural("ui.picker.match", 3)).toBe("3 matches");
  });

  it("takes only keys with a message for one and for other", () => {
    expectTypeOf<"ui.picker.match">().toExtend<PluralKey>();
    const checks = () => {
      // @ts-expect-error: no "app.name.one" and "app.name.other".
      plural("app.name", 2);
    };
    expect(checks).toBeTypeOf("function");
  });
});
