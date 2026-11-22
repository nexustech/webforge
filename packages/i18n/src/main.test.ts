import { describe, expect, it } from "vitest";
import { main } from "./en/main.js";
import { t as appT, isMessageKey as isAppKey } from "./index.js";
import { isMessageKey, t, template } from "./main.js";

describe("main's strings (#1317)", () => {
  it("are the app's, word for word, the app's name filled in", () => {
    for (const key of Object.keys(main) as (keyof typeof main)[]) {
      expect(isAppKey(key), key).toBe(true);
      expect(template(key)).toBe(appT(key as Parameters<typeof appT>[0]));
    }
    expect(template("app.name")).not.toContain("{appName}");
  });

  it("holds only main's keys: not the editor's own", () => {
    expect(isMessageKey("app.name")).toBe(true);
    expect(isMessageKey("theme.studio.own.title")).toBe(false);
    expect(Object.keys(main).length).toBeLessThan(400);
  });

  it("fills placeholders as the app's lookups do", () => {
    expect(t("ai.version.before", { app: "Claude" })).toBe(
      appT("ai.version.before", { app: "Claude" }),
    );
    expect(t("app.name")).toBe(appT("app.name"));
  });
});
