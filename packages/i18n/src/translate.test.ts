import { describe, expect, it } from "vitest";
import { t } from "./translate.js";

describe("t", () => {
  it("returns the English message for a key", () => {
    expect(t("app.name")).toBe("Webforge");
  });

  it("substitutes placeholders when params are given", () => {
    expect(t("app.version", { version: "1.2.0" })).toBe("Version 1.2.0");
  });

  it("leaves a placeholder visible when its param is missing", () => {
    expect(t("app.version", {})).toBe("Version {version}");
  });
});
