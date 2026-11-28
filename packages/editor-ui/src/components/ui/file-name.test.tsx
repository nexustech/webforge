import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FileName, fileNameParts } from "./file-name.js";

afterEach(cleanup);

/** Names a picker meets: short, long, without an extension, a dot first, several dots, emoji. */
const NAMES = [
  "logo.png",
  "riverside-terrace-breakfast.jpg",
  "README",
  ".hidden",
  "menu.v2.final.png",
  "photo.jpeg",
  "notes.backup-copy",
  "big cake.jpg",
  "café 👩‍🍳 chef.webp",
  "a.b",
  "summer pic.jpg",
];

describe("fileNameParts (#1452)", () => {
  it("keeps the extension and the three characters before it at the end", () => {
    expect(fileNameParts("riverside-terrace-breakfast.jpg")).toEqual({
      start: "riverside-terrace-breakf",
      end: "ast.jpg",
    });
    expect(fileNameParts("menu.v2.final.png")).toEqual({ start: "menu.v2.fi", end: "nal.png" });
    expect(fileNameParts("photo.jpeg")).toEqual({ start: "ph", end: "oto.jpeg" });
  });

  it("keeps the last three characters of a name with no extension", () => {
    expect(fileNameParts("README")).toEqual({ start: "REA", end: "DME" });
    // A dot first is a hidden file's name, not an extension.
    expect(fileNameParts(".hidden")).toEqual({ start: ".hid", end: "den" });
    // A long "extension", or one with a space, is part of the name.
    expect(fileNameParts("notes.backup-copy")).toEqual({ start: "notes.backup-c", end: "opy" });
    expect(fileNameParts("v1. final draft")).toEqual({ start: "v1. final dr", end: "aft" });
  });

  it("keeps a space either side of the cut in its part", () => {
    expect(fileNameParts("summer pic.jpg")).toEqual({ start: "summer ", end: "pic.jpg" });
    expect(fileNameParts("summer pi.jpg")).toEqual({ start: "summer", end: " pi.jpg" });
  });

  it("leaves a short name whole at the end", () => {
    expect(fileNameParts("logo.png")).toEqual({ start: "l", end: "ogo.png" });
    expect(fileNameParts("a.b")).toEqual({ start: "", end: "a.b" });
    expect(fileNameParts("")).toEqual({ start: "", end: "" });
  });

  it("never cuts inside a character", () => {
    expect(fileNameParts("café 👩‍🍳 chef.webp")).toEqual({ start: "café 👩‍🍳 c", end: "hef.webp" });
    expect(fileNameParts("x👩‍🍳ab.png").end).toBe("👩‍🍳ab.png");
  });

  it.each(NAMES)("adds up to %j exactly, start then end", (name) => {
    const { start, end } = fileNameParts(name);
    expect(start + end).toBe(name);
  });
});

describe("FileName (#1452)", () => {
  it.each(NAMES)("names a choice %j exactly, once", (name) => {
    render(
      <label>
        <input type="radio" name="logo" />
        <FileName name={name} />
      </label>,
    );
    // Said once, whole: not the two parts with a space between them.
    expect(screen.getByRole("radio", { name })).toBeDefined();
  });

  it("cuts only its start, so the end always shows", () => {
    render(<FileName name="riverside-terrace-breakfast.jpg" />);
    const start = screen.getByText("riverside-terrace-breakf");
    const end = screen.getByText("ast.jpg");
    expect(start.className).toContain("truncate");
    expect(end.className).toContain("shrink-0");
    expect(end.className).not.toContain("truncate");
    // A space either side of the cut is kept, over `truncate`'s nowrap.
    expect(start.className).toContain("whitespace-pre!");
    expect(end.className).toContain("whitespace-pre");
    // What shows adds up to the name, and can't be selected: a copy is the name, once.
    const shown = start.parentElement;
    expect(shown?.getAttribute("aria-hidden")).toBe("true");
    expect(shown?.className).toContain("select-none");
    expect(shown?.textContent).toBe("riverside-terrace-breakfast.jpg");
  });
});
