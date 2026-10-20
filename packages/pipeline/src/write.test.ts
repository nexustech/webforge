import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils";
import { describe, expect, it } from "vitest";
import { EXPORT_MARKER, WriteError, writeSiteFolder } from "./write.js";

const tempDir = tempDirFactory("webforge-pipeline-");
const encode = (text: string) => new TextEncoder().encode(text);

function site(version: string): Map<string, Uint8Array> {
  return new Map([
    ["index.html", encode(`<p>${version}</p>`)],
    ["assets/css/site.css", encode("body{}")],
  ]);
}

describe("writeSiteFolder", () => {
  it("creates the folder with the site's files and the export marker", async () => {
    const destination = join(tempDir(), "my-site");

    await writeSiteFolder(site("v1"), destination);

    expect(readFileSync(join(destination, "index.html"), "utf8")).toBe("<p>v1</p>");
    expect(readFileSync(join(destination, "assets/css/site.css"), "utf8")).toBe("body{}");
    expect(existsSync(join(destination, EXPORT_MARKER))).toBe(true);
  });

  it("writes into an existing empty folder", async () => {
    const destination = tempDir();

    await writeSiteFolder(site("v1"), destination);

    expect(readdirSync(destination).sort()).toEqual([EXPORT_MARKER, "assets", "index.html"]);
  });

  it("replaces a previous export completely and leaves no temporary folders", async () => {
    const parent = tempDir();
    const destination = join(parent, "my-site");
    await writeSiteFolder(new Map([...site("v1"), ["old.html", encode("old")]]), destination);

    await writeSiteFolder(site("v2"), destination);

    expect(readFileSync(join(destination, "index.html"), "utf8")).toBe("<p>v2</p>");
    expect(existsSync(join(destination, "old.html"))).toBe(false);
    expect(readdirSync(parent)).toEqual(["my-site"]);
  });

  it("refuses a folder with someone else's files and leaves it untouched", async () => {
    const destination = tempDir();
    writeFileSync(join(destination, "tax-return.pdf"), "important");

    await expect(writeSiteFolder(site("v1"), destination)).rejects.toMatchObject({
      name: "WriteError",
      code: "folder-not-empty",
    });
    expect(readdirSync(destination)).toEqual(["tax-return.pdf"]);
  });

  it("lists the files it wrote in the export marker", async () => {
    const destination = join(tempDir(), "my-site");

    await writeSiteFolder(site("v1"), destination);

    expect(JSON.parse(readFileSync(join(destination, EXPORT_MARKER), "utf8"))).toEqual({
      generator: "Webforge",
      files: ["assets/css/site.css", "index.html"],
    });
  });

  it("refuses an earlier export the user has added files to, and keeps them", async () => {
    const destination = join(tempDir(), "my-site");
    await writeSiteFolder(site("v1"), destination);
    writeFileSync(join(destination, "assets", "google1234.html"), "verification");

    await expect(writeSiteFolder(site("v2"), destination)).rejects.toMatchObject({
      code: "folder-not-empty",
    });
    expect(readFileSync(join(destination, "assets", "google1234.html"), "utf8")).toBe(
      "verification",
    );
    expect(readFileSync(join(destination, "index.html"), "utf8")).toBe("<p>v1</p>");
  });

  it("refuses a folder whose marker Webforge did not write", async () => {
    const destination = tempDir();
    writeFileSync(join(destination, EXPORT_MARKER), "not json");

    await expect(writeSiteFolder(site("v1"), destination)).rejects.toMatchObject({
      code: "folder-not-empty",
    });
  });

  it("refuses a destination that is a file", async () => {
    const destination = join(tempDir(), "site.html");
    writeFileSync(destination, "x");

    await expect(writeSiteFolder(site("v1"), destination)).rejects.toBeInstanceOf(WriteError);
  });

  it("keeps the previous export when writing the new one fails", async () => {
    const parent = tempDir();
    const destination = join(parent, "my-site");
    await writeSiteFolder(site("v1"), destination);
    // "a" as a file and as a folder: the second write cannot succeed.
    const broken = new Map([
      ["a", encode("file")],
      ["a/b.html", encode("child")],
    ]);

    await expect(writeSiteFolder(broken, destination)).rejects.toMatchObject({
      code: "write-failed",
    });
    expect(readFileSync(join(destination, "index.html"), "utf8")).toBe("<p>v1</p>");
    expect(readdirSync(parent)).toEqual(["my-site"]);
  });
});
