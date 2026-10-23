import { describe, expect, it } from "vitest";
import { colorRefSchema, formatColorRef, parseColorRef } from "./color-ref.js";

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

  it("read a field's own hex colour, with an opacity, in lower case", () => {
    expect(parseColorRef("[#1f6feb]")).toEqual({ base: { hex: "#1f6feb" } });
    expect(parseColorRef("[#1F6FEB]/50")).toEqual({ base: { hex: "#1f6feb" }, opacity: 50 });
  });

  it("store a ref as written, with its hex in lower case", () => {
    expect(colorRefSchema.parse("primary-300/80")).toBe("primary-300/80");
    expect(colorRefSchema.parse("[#ABCDEF]/90")).toBe("[#abcdef]/90");
    for (const ref of ["base-content", "error-950/5", "[#000000]"]) {
      const parsed = parseColorRef(ref);
      expect(parsed && formatColorRef(parsed)).toBe(ref);
    }
  });

  it.each([
    "brand",
    "primary-350",
    "primary/85",
    "base-100-300",
    "base-content-500",
    "primary-content-300",
    "primary/80/80",
    "bg-primary",
    "",
    // Hex: six digits only, in brackets, no shades, nothing else inside.
    "#1f6feb",
    "[1f6feb]",
    "[#fff]",
    "[#1f6feb80]",
    "[#1f6fe]",
    "[#1f6feg]",
    "[#1f6feb]-300",
    "[#1f6feb]/85",
    "[ #1f6feb]",
    "[#fff;}body{]",
    "[#1f6feb];color:red",
    "[var(--x)]",
    "[rgb(0,0,0)]",
    "custom-sky",
  ])("refuse %j", (ref) => {
    expect(parseColorRef(ref)).toBeUndefined();
    expect(colorRefSchema.safeParse(ref).success).toBe(false);
  });
});
