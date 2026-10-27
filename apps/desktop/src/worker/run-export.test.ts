import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SiteSnapshot } from "@webforge/model";
import { createPipeline } from "@webforge/pipeline";
import { loadNodeResources } from "@webforge/pipeline/node";
import { siteLibrary } from "@webforge/site-components";
import { sampleSite } from "@webforge/test-utils";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { fontFacesFor } from "@webforge/themes";
import { describe, expect, it } from "vitest";
import type { ExportJob } from "../shared/export-worker-protocol.js";
import { type ExportChannel, runExport } from "./run-export.js";

const tempDir = tempDirFactory("webforge-run-export-");

/** The main process's side of an export: no stored bytes, and a signal it may abort. */
function channel(signal = new AbortController().signal): ExportChannel {
  return { readMedia: async () => undefined, signal, pipeline: createPipeline(siteLibrary) };
}

/** An export of `snapshot`, with the site's font files as the main process sends them (2.2). */
async function job(snapshot: SiteSnapshot, destination: string): Promise<ExportJob> {
  const { readFont } = await loadNodeResources();
  const fonts = await Promise.all(
    fontFacesFor(snapshot.theme).map(async (face) => ({
      file: face.file,
      data: (await readFont(face)) ?? new Uint8Array(),
    })),
  );
  return {
    type: "export",
    snapshot,
    destination,
    format: "folder",
    output: { minify: false, developerFiles: false },
    fonts,
    families: [],
  };
}

describe("runExport", () => {
  it("tells its progress through the build, then the writing (3.1)", async () => {
    const destination = join(tempDir(), "site");
    const stages: string[] = [];

    await runExport(await job(sampleSite(), destination), loadNodeResources, {
      ...channel(),
      onProgress: (progress) => stages.push(progress.stage),
    });

    expect(stages.slice(-3)).toEqual(["styles", "fonts", "writing"]);
    expect(stages).toContain("images");
    expect(stages).toContain("pages");
  }, 60_000);

  it("builds the site and writes it to the destination", async () => {
    const destination = join(tempDir(), "site");

    const outcome = await runExport(
      await job(sampleSite(), destination),
      loadNodeResources,
      channel(),
    );

    expect(outcome).toMatchObject({
      type: "exported",
      pages: 3,
      files: 16,
      warnings: [],
      warningCount: 0,
    });
    expect(readFileSync(join(destination, "about.html"), "utf8")).toContain(
      "A family bakery since 1998.",
    );
  }, 60_000);

  it("writes a ZIP file, minified and with developer files, as the person chose (3.3)", async () => {
    const destination = join(tempDir(), "my-site.zip");

    const outcome = await runExport(
      {
        ...(await job(sampleSite(), destination)),
        format: "zip",
        output: { minify: true, developerFiles: true },
      },
      loadNodeResources,
      channel(),
    );

    expect(outcome).toMatchObject({ type: "exported", pages: 3 });
    const zip = readFileSync(destination);
    // A ZIP: its local file header's signature, and the names it holds (stored as they are).
    expect(zip.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(zip.includes("developer/README.md")).toBe(true);
    expect(zip.includes("index.html")).toBe(true);
  }, 60_000);

  it("passes the build's warnings on for the report, page by page (3.3)", async () => {
    const site = sampleSite();
    const [home, ...rest] = site.pages;
    if (home === undefined) throw new Error("The sample site has no pages");
    const withBrokenLink = {
      ...site,
      pages: [
        {
          ...home,
          doc: {
            ...home.doc,
            content: [
              ...home.doc.content,
              {
                type: "Hero",
                props: { id: "gone", title: "Hi", buttonLabel: "Go", buttonLink: "old-page" },
              },
            ],
          },
        },
        ...rest,
      ],
    };

    const outcome = await runExport(
      await job(withBrokenLink, join(tempDir(), "site")),
      loadNodeResources,
      channel(),
    );

    expect(outcome).toMatchObject({
      type: "exported",
      warnings: [{ code: "broken-link", page: "index", detail: "old-page" }],
      warningCount: 1,
    });
  }, 60_000);

  it("reports a build failure by code without writing anything", async () => {
    const destination = join(tempDir(), "site");
    const site = sampleSite();
    const broken = {
      ...site,
      pages: [{ ...site.pages[1], path: "index" } as (typeof site.pages)[number]],
      media: [],
      layout: { header: [{ type: "NoSuchComponent", props: { id: "c" } }], footer: [] },
    };

    const outcome = await runExport(await job(broken, destination), loadNodeResources, channel());

    expect(outcome).toEqual({ type: "failed", code: "build-failed", detail: "unknown-component" });
    expect(existsSync(destination)).toBe(false);
  });

  it("reports a folder with other files", async () => {
    const destination = tempDir();
    writeFileSync(join(destination, "notes.txt"), "mine");

    const outcome = await runExport(
      await job(sampleSite(), destination),
      loadNodeResources,
      channel(),
    );

    expect(outcome).toEqual({
      type: "failed",
      code: "folder-not-empty",
      detail: "folder-not-empty",
    });
  }, 60_000);

  it("fails the build when the site's fonts didn't come with the job (2.2)", async () => {
    const destination = join(tempDir(), "site");

    const outcome = await runExport(
      { ...(await job(sampleSite(), destination)), fonts: [] },
      loadNodeResources,
      channel(),
    );

    expect(outcome).toEqual({ type: "failed", code: "build-failed", detail: "missing-font" });
    expect(existsSync(destination)).toBe(false);
  }, 60_000);

  it("reports anything unexpected as a failed build", async () => {
    const outcome = await runExport(
      await job(sampleSite(), tempDir()),
      async () => {
        throw new Error("resources missing");
      },
      channel(),
    );

    expect(outcome).toEqual({ type: "failed", code: "build-failed", detail: "unexpected" });
  });

  it("stops when the main process cancels, writing nothing (R15)", async () => {
    const destination = join(tempDir(), "site");
    const controller = new AbortController();
    controller.abort();

    const outcome = await runExport(
      await job(sampleSite(), destination),
      loadNodeResources,
      channel(controller.signal),
    );

    expect(outcome).toEqual({ type: "cancelled" });
    expect(existsSync(destination)).toBe(false);
  }, 60_000);

  it("names the page to rename when Windows keeps its name, writing nothing (R16)", async () => {
    const destination = join(tempDir(), "site");
    const site = sampleSite();
    const named = {
      ...site,
      pages: site.pages.map((page) =>
        page.path === "about" ? { ...page, path: "con", title: "Contact" } : page,
      ),
    };

    const outcome = await runExport(await job(named, destination), loadNodeResources, channel());

    expect(outcome).toEqual({
      type: "failed",
      code: "reserved-name",
      detail: "reserved-name",
      page: "Contact",
    });
    expect(existsSync(destination)).toBe(false);
  }, 60_000);
});
