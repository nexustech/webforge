import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { EXPORT_MARKER } from "./write.js";
import { writeSiteZip, zipSite } from "./zip.js";

const tempDir = tempDirFactory("webforge-zip-");

const site = (version: string) =>
  new Map([
    ["index.html", new TextEncoder().encode(`<p>${version}</p>`)],
    ["company/about.html", new TextEncoder().encode("<p>About</p>")],
    ["assets/img/shop-640.webp", new Uint8Array([0x52, 0x49, 0x46, 0x46])],
  ]);

describe("zipSite", () => {
  it("holds every file, and the export's marker listing them", () => {
    const entries = unzipSync(zipSite(site("v1")));

    expect(Object.keys(entries).sort()).toEqual([
      EXPORT_MARKER,
      "assets/img/shop-640.webp",
      "company/about.html",
      "index.html",
    ]);
    expect(new TextDecoder().decode(entries["index.html"])).toBe("<p>v1</p>");
    expect(JSON.parse(new TextDecoder().decode(entries[EXPORT_MARKER]))).toEqual({
      generator: "Webforge",
      files: ["assets/img/shop-640.webp", "company/about.html", "index.html"],
    });
  });

  it("is the same for the same site", () => {
    expect(zipSite(site("v1"))).toEqual(zipSite(site("v1")));
  });
});

describe("writeSiteZip", { timeout: 20_000 }, () => {
  it("writes the ZIP, replacing the one the person chose to replace", async () => {
    const parent = tempDir();
    const destination = join(parent, "my-site.zip");
    writeFileSync(destination, "an older one");

    await writeSiteZip(site("v2"), destination);

    const entries = unzipSync(new Uint8Array(readFileSync(destination)));
    expect(new TextDecoder().decode(entries["index.html"])).toBe("<p>v2</p>");
    // Nothing is left beside it.
    expect(readdirSync(parent)).toEqual(["my-site.zip"]);
  });

  it("stops when cancelled, leaving what was there", async () => {
    const parent = tempDir();
    const destination = join(parent, "my-site.zip");
    writeFileSync(destination, "an older one");
    const controller = new AbortController();
    controller.abort();

    await expect(writeSiteZip(site("v2"), destination, controller.signal)).rejects.toMatchObject({
      code: "cancelled",
    });
    expect(readFileSync(destination, "utf8")).toBe("an older one");
    expect(readdirSync(parent)).toEqual(["my-site.zip"]);
  });

  it("refuses a folder, and a file whose path leads outside the site, writing nothing", async () => {
    const parent = tempDir();
    const folder = join(parent, "photos.zip");
    mkdirSync(folder);

    await expect(writeSiteZip(site("v1"), folder)).rejects.toMatchObject({ code: "write-failed" });
    await expect(
      writeSiteZip(new Map([["../outside.html", new Uint8Array()]]), join(parent, "a.zip")),
    ).rejects.toMatchObject({ code: "write-failed" });
    expect(readdirSync(parent)).toEqual(["photos.zip"]);
  });
});
