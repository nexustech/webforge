import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadNodeResources } from "@webforge/pipeline/node";
import { sampleSite, tempDirFactory } from "@webforge/test-utils";
import { describe, expect, it } from "vitest";
import { runExport } from "./run-export.js";

const tempDir = tempDirFactory("webforge-run-export-");

describe("runExport", () => {
  it("builds the site and writes it to the destination", async () => {
    const destination = join(tempDir(), "site");

    const outcome = await runExport(
      { type: "export", snapshot: sampleSite(), destination },
      loadNodeResources,
    );

    expect(outcome).toMatchObject({ type: "exported", pages: 2, files: 12, warnings: 0 });
    expect(readFileSync(join(destination, "about.html"), "utf8")).toContain(
      "A family bakery since 1998.",
    );
  }, 60_000);

  it("reports a build failure by code without writing anything", async () => {
    const destination = join(tempDir(), "site");
    const site = sampleSite();
    const broken = {
      ...site,
      pages: [{ ...site.pages[1], path: "index" } as (typeof site.pages)[number]],
      media: [],
      layout: { header: [{ type: "Carousel", props: { id: "c" } }], footer: [] },
    };

    const outcome = await runExport(
      { type: "export", snapshot: broken, destination },
      loadNodeResources,
    );

    expect(outcome).toEqual({ type: "failed", code: "build-failed", detail: "unknown-component" });
    expect(existsSync(destination)).toBe(false);
  });

  it("reports a folder with other files", async () => {
    const destination = tempDir();
    writeFileSync(join(destination, "notes.txt"), "mine");

    const outcome = await runExport(
      { type: "export", snapshot: sampleSite(), destination },
      loadNodeResources,
    );

    expect(outcome).toEqual({
      type: "failed",
      code: "folder-not-empty",
      detail: "folder-not-empty",
    });
  }, 60_000);

  it("reports anything unexpected as a failed build", async () => {
    const outcome = await runExport(
      { type: "export", snapshot: sampleSite(), destination: tempDir() },
      async () => {
        throw new Error("resources missing");
      },
    );

    expect(outcome).toEqual({ type: "failed", code: "build-failed", detail: "unexpected" });
  });
});
