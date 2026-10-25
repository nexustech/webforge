import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { heroPhoto, tempDirFactory } from "@webforge/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createImportJobs } from "./store-import.js";

// The storage writer's two steps (R13b): preparing reads, checks and hashes a file without
// touching the site; storing writes what was prepared.

const tempDir = tempDirFactory("webforge-store-import-");

/** A writer that records what it is asked to store. */
function recordingWriter() {
  const put = vi.fn((_asset: unknown, hash?: string) => hash ?? "");
  return { put, close: vi.fn(), open: vi.fn(() => ({ put, close: vi.fn() })) };
}

describe("createImportJobs", () => {
  it("prepares without opening the site, then stores the prepared bytes with their hash", async () => {
    const writer = recordingWriter();
    const jobs = createImportJobs(writer.open);
    const photo = join(tempDir(), "shop.jpg");
    writeFileSync(photo, heroPhoto());

    const prepared = await jobs.prepare(7, "shop.jpg", { path: photo });

    expect(prepared).toMatchObject({ status: "prepared", media: { kind: "image" } });
    expect(writer.open).not.toHaveBeenCalled();
    const target = { sitePath: "site.wforge", mediaId: "shop", originalName: "shop.jpg" };
    expect(jobs.store(7, target)).toEqual({ status: "stored" });
    expect(writer.open).toHaveBeenCalledWith("site.wforge");
    expect(writer.put).toHaveBeenCalledWith(
      expect.objectContaining({ mediaId: "shop", mime: "image/jpeg", originalName: "shop.jpg" }),
      prepared.status === "prepared" ? prepared.hash : "",
    );
    // Stored once: the bytes are gone.
    expect(jobs.store(7, target)).toEqual({ status: "failed" });
  });

  it("forgets what it discards, and stores nothing it didn't prepare", async () => {
    const writer = recordingWriter();
    const jobs = createImportJobs(writer.open);
    await jobs.prepare(1, "shop.jpg", { data: heroPhoto() });

    jobs.discard(1);

    const target = { sitePath: "site.wforge", mediaId: "shop", originalName: "shop.jpg" };
    expect(jobs.store(1, target)).toEqual({ status: "failed" });
    expect(jobs.store(2, target)).toEqual({ status: "failed" });
    expect(writer.open).not.toHaveBeenCalled();
  });

  it("skips a folder, and a file that is gone", async () => {
    const jobs = createImportJobs(recordingWriter().open);
    const folder = join(tempDir(), "Photos");
    mkdirSync(folder);

    expect(await jobs.prepare(1, "Photos", { path: folder })).toEqual({ status: "skipped" });
    expect(await jobs.prepare(2, "gone.jpg", { path: join(folder, "gone.jpg") })).toEqual({
      status: "skipped",
    });
  });

  it.skipIf(process.platform === "win32")(
    "skips a pipe without waiting for something to write to it",
    async () => {
      const pipe = join(tempDir(), "photo.jpg");
      execFileSync("mkfifo", [pipe]);
      const jobs = createImportJobs(recordingWriter().open);

      // Opening it to read would wait for a writer that never comes.
      expect(await jobs.prepare(1, "photo.jpg", { path: pipe })).toEqual({ status: "skipped" });
    },
    5_000,
  );
});
