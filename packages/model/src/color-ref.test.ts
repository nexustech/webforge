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

  it("read one of the theme's own colours by its id, with shades and opacity (TC-1a)", () => {
    expect(parseColorRef("own-sky")).toEqual({ base: { own: "sky" } });
    expect(parseColorRef("own-sky-300")).toEqual({ base: { own: "sky" }, shade: 300 });
    expect(parseColorRef("own-moss2-950/40")).toEqual({
      base: { own: "moss2" },
      shade: 950,
      opacity: 40,
    });
    // An id may be a role's name: the prefix keeps it apart from the role.
    expect(parseColorRef("own-primary")).toEqual({ base: { own: "primary" } });
    expect(colorRefSchema.parse("own-sky-300/80")).toBe("own-sky-300/80");
    const parsed = parseColorRef("own-sky-50/5");
    expect(parsed && formatColorRef(parsed)).toBe("own-sky-50/5");
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
    // One of your colours: an id of lower-case letters and digits, a letter first, at most 24, and
    // nothing CSS reads as syntax, so neither a class nor a variable can carry anything else.
    "own-",
    "own-Sky",
    "own-1sky",
    "own-sky-blue",
    "own-sky_blue",
    "own-sky-350",
    "own-sky/85",
    "own-sky;}body{color:red",
    "own-sky)",
    "own-sky\\",
    "own-sky%20",
    "own-sky.x",
    "own-var(--x)",
    "own--sky",
    "own-sky ",
    `own-${"a".repeat(25)}`,
  ])("refuse %j", (ref) => {
    expect(parseColorRef(ref)).toBeUndefined();
    expect(colorRefSchema.safeParse(ref).success).toBe(false);
  });
});
