import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SiteSnapshot } from "@webforge/model";
import { loadNodeResources } from "@webforge/pipeline/node";
import { sampleSite, tempDirFactory } from "@webforge/test-utils";
import { fontFacesFor } from "@webforge/themes";
import { describe, expect, it } from "vitest";
import type { ExportJob } from "../shared/export-worker-protocol.js";
import { type ExportChannel, runExport } from "./run-export.js";

const tempDir = tempDirFactory("webforge-run-export-");

/** The main process's side of an export: no stored bytes, and a signal it may abort. */
function channel(signal = new AbortController().signal): ExportChannel {
  return { readMedia: async () => undefined, signal };
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
  return { type: "export", snapshot, destination, fonts, families: [] };
}

describe("runExport", () => {
  it("builds the site and writes it to the destination", async () => {
    const destination = join(tempDir(), "site");

    const outcome = await runExport(
      await job(sampleSite(), destination),
      loadNodeResources,
      channel(),
    );

    expect(outcome).toMatchObject({ type: "exported", pages: 3, files: 16, warnings: 0 });
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
