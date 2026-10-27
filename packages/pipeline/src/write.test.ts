import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { describe, expect, it } from "vitest";
import { BuildError } from "./build.js";
import { EXPORT_MARKER, WriteError, writeSiteFolder } from "./write.js";

const tempDir = tempDirFactory("webforge-pipeline-");
const encode = (text: string) => new TextEncoder().encode(text);

function site(version: string): Map<string, Uint8Array> {
  return new Map([
    ["index.html", encode(`<p>${version}</p>`)],
    ["assets/css/site.css", encode("body{}")],
  ]);
}

// Real folders on disk: a busy Windows machine (antivirus, indexer) locks them for a moment, and
// writeSiteFolder retries a locked rename with growing waits, which can pass the 5 s default.
describe("writeSiteFolder", { timeout: 15_000 }, () => {
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

  it("stops when cancelled, removing what it wrote and keeping the previous export (R15)", async () => {
    const parent = tempDir();
    const destination = join(parent, "my-site");
    await writeSiteFolder(site("v1"), destination);
    const controller = new AbortController();
    controller.abort();

    await expect(writeSiteFolder(site("v2"), destination, controller.signal)).rejects.toMatchObject(
      { code: "cancelled" },
    );
    expect(readFileSync(join(destination, "index.html"), "utf8")).toBe("<p>v1</p>");
    // Its temporary folder, made before the first file, is gone.
    expect(readdirSync(parent)).toEqual(["my-site"]);
  });

  it("refuses a file whose path leads outside the folder, writing nothing (R16)", async () => {
    const parent = tempDir();
    const destination = join(parent, "my-site");

    for (const path of [
      "../outside.html",
      "/etc/passwd",
      "C:\\Windows\\x.html",
      "a/../../b.html",
    ]) {
      await expect(
        writeSiteFolder(
          new Map([
            ["index.html", encode("ok")],
            [path, encode("x")],
          ]),
          destination,
        ),
      ).rejects.toMatchObject({ code: "write-failed" });
    }
    expect(readdirSync(parent)).toEqual([]);
    expect(existsSync(join(parent, "outside.html"))).toBe(false);
  });
});

describe("the pipeline's errors (R12)", () => {
  it("show the export's own message for each code", () => {
    expect(new WriteError("folder-not-empty", "x").messageKey).toBe("export.failed.folderNotEmpty");
    expect(new WriteError("write-failed", "x").messageKey).toBe("export.failed.writeFailed");
    expect(new BuildError("missing-font", "x")).toMatchObject({
      name: "BuildError",
      code: "missing-font",
      messageKey: "export.failed.buildFailed",
    });
  });
});
