import { describe, expect, it } from "vitest";
import { colorRefSchema, parseColorRef } from "./color-ref.js";

describe("colour refs (2.1)", () => {
  it("read a role, with a shade and an opacity as Tailwind's classes do", () => {
    expect(parseColorRef("primary")).toEqual({ base: { role: "primary" } });
    expect(parseColorRef("primary-300")).toEqual({ base: { role: "primary" }, shade: 300 });
    expect(parseColorRef("primary/80")).toEqual({ base: { role: "primary" }, opacity: 80 });
    expect(parseColorRef("error-950/5")).toEqual({
      base: { role: "error" },
      shade: 950,
      opacity: 5,
    });
    expect(parseColorRef("base-content/70")).toEqual({
      base: { role: "base-content" },
      opacity: 70,
    });
    expect(parseColorRef("base-100")).toEqual({ base: { role: "base-100" } });
    expect(parseColorRef("primary-content")).toEqual({ base: { role: "primary-content" } });
  });

  it("read a custom colour, its id hyphens and all, with a shade and an opacity", () => {
    expect(parseColorRef("custom-sky")).toEqual({ base: { custom: "sky" } });
    expect(parseColorRef("custom-deep-sky-700/50")).toEqual({
      base: { custom: "deep-sky" },
      shade: 700,
      opacity: 50,
    });
    expect(parseColorRef("custom-2024")).toEqual({ base: { custom: "2024" } });
  });

  it.each([
    "brand",
    "primary-350",
    "primary/85",
    "base-100-300",
    "base-content-500",
    "primary-content-300",
    "custom-",
    "custom-Sky",
    "primary/80/80",
    "bg-primary",
    "",
  ])("refuse %j", (ref) => {
    expect(parseColorRef(ref)).toBeUndefined();
    expect(colorRefSchema.safeParse(ref).success).toBe(false);
  });
});
