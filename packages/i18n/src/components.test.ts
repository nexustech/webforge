import { describe, expect, expectTypeOf, it } from "vitest";
import {
  type ComponentMessageKey,
  type ComponentParamsOf,
  isComponentMessageKey,
  plural,
  t,
  template,
} from "./components.js";
import * as app from "./translate.js";

describe("@webforge/i18n/components (#1150)", () => {
  it("has the site components' strings, and the app's own", () => {
    expect(t("field.title")).toBe("Title");
    expect(t("siteText.slideOf", { n: 2, total: 5 })).toBe("2 of 5");
    expect(template("siteText.slideOf")).toBe("{n} of {total}");
    expect(t("command.about")).toBe("About Webforge");
    expect(plural("ui.picker.match", 3)).toBe(app.plural("ui.picker.match", 3));
    expect(isComponentMessageKey("field.title")).toBe(true);
    expect(isComponentMessageKey("app.name")).toBe(true);
    expect(isComponentMessageKey("field.nothing")).toBe(false);
  });

  it("keeps them out of the app's own catalogue, which main reads", () => {
    expect(app.isMessageKey("field.title")).toBe(false);
    expect(app.isMessageKey("app.name")).toBe(true);
    expectTypeOf<"field.title">().toExtend<ComponentMessageKey>();
    expectTypeOf<"field.title">().not.toExtend<app.MessageKey>();
    expectTypeOf<ComponentParamsOf<"siteText.slideOf">>().toEqualTypeOf<"n" | "total">();
    // These lines only type-check; they would fail the build if the checks broke.
    const checks = () => {
      // @ts-expect-error: the app's own t doesn't take a component's key.
      app.t("field.title");
      // @ts-expect-error: the message needs {n} and {total}.
      t("siteText.slideOf");
    };
    expect(checks).toBeTypeOf("function");
  });
});
